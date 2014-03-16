// Copyright 2010-2014 Voxer IP LLC. All rights reserved.

// Unsorted TODO list:
//     utilize and tune node's connection pooling
//     session invalidation on ring membership change

var node = {
        http: require('http'),
        url: require('url'),
        querystring: require('querystring'),
        net: require('net'),
        crypto: require('crypto')
    },
    Client = require("./http_client"),
    EventEmitter = require("events").EventEmitter,
    RV,
    replica_points = 200,
    heartbeat_interval = 40000,
    reconfigure_interval = 10000,
    ring = {},                   // maps hash keys to process names
    sorted_ring = [],            // array of hash keys
    routers = {},                // maps process names to {address, port, status}
    join_set = {},               // maps "address:port" to process names
    heartbeats = {},             // maps process names to http requests
    ignored = {},                // maps "address:port" to boolean
    ring_json = "",              // json string of current routers
    ring_state = new EventEmitter(),
    ring_ready = false,
    dirty = 0,
    heartbeat_timer, reconfigure_timer,
    lines = new Error().stack,
    add_router, metrics, logger, log, warn, error;

function fatal_error(why) {
    logger.error("fatal error: " + why);
    process.exit(1);
}

function hash(text) {
    var hasher = node.crypto.createHash("md5");
    hasher.update(text);
    return hasher.digest("hex");
}

// returns the routers map with only {address, port} values
function get_router_list() {
    var ret = {};

    Object.keys(routers).sort().forEach(function (router) {
        var router_obj = routers[router];

        ret[router] = {
            address: router_obj.address,
            port: router_obj.port
        };
    });

    return ret;
}

// add any new routers to our list
function merge_list(obj) {
    Object.keys(obj).forEach(function (v) {
        add_router(v, obj[v]);
    });
}

function safe_parse(body) {
    try {
        return JSON.parse(body);
    } catch (e) {
        return null;
    }
}

// send join request to another router
function outgoing_join(address, port, reason) {
    var host_port = address + ":" + port,
        request;

    log("ring outgoing_join", "host_port=\"" + host_port + "\" err=" + reason);

    request = node.http.request({
        host: address,
        port: +port,
        headers: {
            "Connection": "keep-alive"
        },
        method: "POST",
        path: '/1/rr/join?' + node.querystring.stringify({ from: RV.name, reason: reason })
    }, function (response) {
        var response_body = "";

        response.on('data', function (chunk) {
            response_body += chunk;
        });
        response.on('end', function () {
            if (response.statusCode === 200) {
                var obj = safe_parse(response_body);
                if (obj) {
                    merge_list(obj);
                } else {
                    logger.error("outgoing_join ignored due to bad JSON: '" + response_body + "'");
                }
            } else {
                fatal_error("join client to " + host_port + " returned status code " + response.statusCode);
            }
        });
        response.on("aborted", function () {
            logger.error("Response aborted from " + host_port);
        });
    });
    request.on("error", function (err) {
        logger.warn("outgoing_join error ", "host_port=\"" + host_port + "\" err=" + err);
    });
    request.end(ring_json);
}

function format_router_list() {
    var out_str = "", statuses = {}, list = Object.keys(routers);

    list.forEach(function (router) {
        statuses[routers[router].status] = [];
    });

    list.forEach(function (router) {
        statuses[routers[router].status].push(routers[router]);
    });

    Object.keys(statuses).forEach(function (status) {
        out_str += status + ": " + statuses[status].length + " ";
    });

    return out_str;
}

function get_router_statuses() {
    var list = Object.keys(routers),
        statuses = {};

    list.forEach(function (router) {
        if (!statuses[routers[router].status]) {
            statuses[routers[router].status] = [routers[router]];
        } else {
            statuses[routers[router].status].push(routers[router]);
        }
    });

    return statuses;
}

function format_statuses(statuses) {
    if (!statuses) {
        return statuses;
    }

    return Object.keys(statuses).reduce(function (str, status) {
        return str + status + ": " + statuses[status].length + " ";
    }, "");
}

function reconfigure_ring(force) {
    var start = Date.now(), duration;

    if (dirty || force) {
        sorted_ring = Object.keys(ring).sort();  // expensive.  avoid.
        ring_json = JSON.stringify(get_router_list());
        duration = Date.now() - start;
        log("reconfigure_ring", "changes_applied=" + dirty + " duration_ms=" + duration);
        metrics.histogram("ring_reconfig_time", duration);
        metrics.histogram("ring_reconfig_count", dirty);
        ring_state.emit("change", get_router_statuses());
        dirty = 0;
    }
}

function router_up(name, bootstrap) {
    var then = Date.now(),
        duration,
        new_key,
        new_hash;

    for (var i = replica_points - 1; i >= 0 ; i -= 1) {
        new_key = name + ":" + i;
        new_hash = hash(new_key);
        if (ring[new_hash]) {
            logger.warn("hash collision for " + new_key + " -> " + new_hash + " already in ring for " + ring[new_hash]);
        }
        ring[new_hash] = name;
    }

    log("ring router_up", "router=\"" + name + "\"");
    dirty++;

    if (bootstrap || ring_ready) {
        reconfigure_ring(true);
    }

    duration = Date.now() - then;
    metrics.histogram("ring_confg|router_up", duration);
}

function router_down(name) {
    var then = Date.now(),
        duration,
        new_key,
        new_hash;

    for (var i = replica_points - 1; i >= 0 ; i -= 1) {
        new_key = name + ":" + i;
        new_hash = hash(new_key);
        delete ring[new_hash];
    }

    delete routers[name];

    log("ring router_down", "router=\"" + name + "\"");
    dirty++;
    reconfigure_ring(true); // always force and update the ring

    duration = Date.now() - then;
    metrics.histogram("ring_confg|router_down", duration);

    // TODO - maybe actively tell everybody else that we think this router is down,
    //        or maybe it's better to let everybody figure it out from heartbeats.
    //        Other consistent hash rings all use that scheme, so we should at least figure out why they do it that way.
}

function update_router_status(host, new_status, why) {
    if (! routers[host]) {
        warn("update_router_status: no router " + host + " in list: " + new_status + ", " + why);
        return;
    }

    var router = routers[host],
        routers_status;

    switch (router.status) {
    case "waiting for heartbeat":
        if (new_status === "OK") {
            log("ring heartbeat good", "router=\"" + host + "\" " + why);
            router_up(host);
        } else {
            log("ring status ignore", "router=\"" + host + "\" ignoring " + new_status + " - " + why);
        }
        break;
    case "OK":
        if (new_status !== "OK") {
            warn("ring heartbeat bad", "router=\"" + host + "\" has become sad, taking down: " + why);
            // TODO - signal client_router to invalidate any sessions that point there
            router_down(host);
        }
        break;
    case "heartbeat failed":
        if (new_status === "OK") {
            warn("ring heartbeat good again", "router=\"" + host + "\" has gone from sad to happy: " + why);
            router_up(host);
        } else {
            log("ring heartbeat still sad", "router=\"" + host + "\" is still sad: " + why);
        }
        break;
    default:
        fatal_error("update_router_status: bad original status " + router.status);
    }

    if (router.status !== new_status) {
        router.status = new_status;
        routers_status = get_router_statuses();

        log("ring status change", format_statuses(routers_status));
    }
}

function launch_heartbeat(host) {
    if (! routers[host]) {
        fatal_error("launch_heartbeat: no router " + host + " in list");
    }

    var hostname = routers[host].address,
        port = routers[host].port,
        req;
    if (! heartbeats[host]) {
        heartbeats[host] = node.http.get({
            host: hostname,
            port: +port,
            agent: false,
            headers: {
                "Connection": "keep-alive"
            },
            path: "/1/rr/heartbeat?from=" + RV.name
        }, function (response) {
            var response_body = "";
            response.on('data', function (chunk) {
                response_body += chunk;
            });
            response.on('end', function () {
                heartbeats[host] = null;
                if (response.statusCode === 200) {
                    try {
                        var obj = JSON.parse(response_body);
                        update_router_status(host, obj.status, "heartbeat response");
                    } catch (err) {
                        update_router_status(host, "heartbeat failed", "parsing JSON");
                        fatal_error("heartbeat error updating status from JSON: " + err);
                    }
                } else {
                    // this should never happen except for config error. Unfortunately, due to some mysterious bug, sometimes
                    // the server responds with 404 for an otherwise perfectly valid request.
                    warn("heartbeat debug", "heartbeat to " + host + " failed with status code " + response.statusCode);
                    update_router_status(host, "heartbeat failed", "bad status code: " + response.statusCode);
                }
            });
            response.on("aborted", function () {
                heartbeats[host] = null;
                logger.error("heartbeat response aborted from " + host);
            });
        });
        heartbeats[host].on("error", function (err) {
            update_router_status(host, "heartbeat failed", err);
            heartbeats[host] = null;
        });
    } else {
        update_router_status(host, "heartbeat failed", "heartbeat request still active at next interval");
        if (heartbeats[host]) {
            heartbeats[host].abort();
        } else {
            log("ring heartbeat", "want to destroy heartbeat req, but no request: " + JSON.stringify(heartbeats[host]));
        }
        heartbeats[host] = null;
    }
}

function check_join_set(why) {
    var router_host_ports = {};
    Object.keys(routers).forEach(function (router) {
        router_host_ports[routers[router].address + ":" + routers[router].port] = router;
    });
    Object.keys(join_set).forEach(function (host_port) {
        var parts = host_port.split(':', 2);
        if (router_host_ports[host_port] === undefined) {
            outgoing_join(parts[0], parts[1], "reconnect from " + why);
        }
    });
}

function launch_heartbeats() {
    Object.keys(routers).forEach(function (host) {
        if (routers[host].self === true) {
            return;
        }

        launch_heartbeat(host);
    });

    check_join_set("heartbeat");
}

function handle_heartbeat(client) {
    client.send_header(200);
    client.res_end(JSON.stringify({
        status: "OK",
        message: "still alive, thanks for checking"
    }));
}

function remove_router(address_port) {
    Object.keys(routers).forEach(function (name) {
        var r = routers[name];
        if (r && r.address + ":" + r.port === address_port) {
            router_down(name);
        }
    });
}

// to_ignore is an array of "address:port" strings
//
function handle_ignore(client) {
    var ring_checksum = hash(ring_json),
        post_body = "";

    client.req.on('data', function join_ondata(chunk) {
        post_body += chunk.toString();
    });

    client.req.on('end', function join_onend() {
        var to_ignore,
            address_port;
        ignored = {}; // reset
        try {
            to_ignore = JSON.parse(post_body);
        }
        catch (e) {
            logger.error("handle_ignore", post_body);
            to_ignore = [];
        }
        for (var i = 0; i < to_ignore.length; i++) {
            address_port = to_ignore[i];
            ignored[address_port] = true;
            remove_router(address_port);
            if (join_set[address_port]) {
                delete join_set[address_port];
            }
        }
        client.send_header(200);
        client.res_end(ring_checksum);
    });
}

function handle_add(client) {
    var post_body = "";

    client.req.on('data', function join_ondata(chunk) {
        post_body += chunk.toString();
    });

    client.req.on('end', function join_onend() {
        var to_add,
            address_port;
        try {
            to_add = JSON.parse(post_body);
        }
        catch (e) {
            logger.error("handle_add", post_body);
            to_add = [];
        }
        for (var i = 0; i < to_add.length; i++) {
            address_port = to_add[i];
            join_set[address_port] = "add router";
        }
        check_join_set("add router");
        client.send_header(200);
        client.res_end("OK\n");
    });
}

function is_allowed(name, address_port) {
    return !routers[name] && !ignored[address_port];
}

function add_router(name, props) {
    var host_port = props.address + ":" + props.port;
    props.name = name;
    if (props.self) {
        routers[name] = props;
        router_up(name, props.self);
    } else if (is_allowed(name, host_port)) {
        props.status = "waiting for heartbeat";
        routers[name] = props;
        join_set[host_port] = name;
        launch_heartbeat(name);
        log("ring add", name + " " + host_port);
    }
}

// almost like binary search, but not quite
function hash_search(needle, haystack) {
    var high = haystack.length - 1,
        low = 0, mid, pos, value;

    while (low <= high) {
        mid = Math.floor((low + high) / 2);
        value = haystack[mid];
        if (value > needle) {
            high = mid - 1;
        } else if (value < needle) {
            low = mid + 1;
        } else {
            error("hash_search collision", needle + " returning " + mid);
            return mid;
        }
    }

    return Math.max(low, high);
}

// consistent hashing scheme to find server for a given key
function lookup(str) {
    var key = hash(str), pos, ret;

    pos = hash_search(key, sorted_ring);

    if (pos >= sorted_ring.length) { // wrap around
        ret = sorted_ring[0];
    } else {
        ret = sorted_ring[pos];
    }

    return ring[ret];
}

// handle join request from another router
function handle_join(client) {
    var post_body = "";

    client.req.on('data', function join_ondata(chunk) {
        post_body += chunk.toString();
    });

    client.req.on('end', function join_onend() {
        var obj;
        try {
            obj = JSON.parse(post_body);
            merge_list(obj);
            client.send_header(200);
            client.res_end(ring_json);
        } catch (err) {
            client.send_header(500);
            client.res_end("Error adding router list: " + err);
            logger.error("join server error body", post_body);
            logger.error("join server error", err.stack);
        }
    });
}

exports.init = function init(_RV, options, on_ready) {
    // TODO - sanity checking on self props
    RV = _RV;
    metrics = RV.metrics;
    logger = RV.logger;
    log = logger.log;
    warn = logger.warn;
    error = logger.error;

    options = options || {};
    if (options.reconfigure_interval) {
        reconfigure_interval = options.reconfigure_interval;
    }

    add_router(RV.name, {
        self: true,
        address: RV.listen.ring.address,
        port: RV.listen.ring.port,
        status: "bootstrap self"
    });

    RV.options.join.forEach(function (host_port) {
        if (host_port !== RV.listen.ring.address + ":" + RV.listen.ring.port) {
            if (join_set[host_port] === undefined) {
                join_set[host_port] = "command line";
            } else {
                logger.warn("Already have " + host_port + " in join set.");
            }
        }
    });

    heartbeat_timer = setInterval(launch_heartbeats, heartbeat_interval);

    reconfigure_timer = setTimeout(function () {
        reconfigure_ring(true);
        ring_ready = true;
        ring_state.emit("ready", get_router_statuses());
        if (on_ready) {
            on_ready();
        }
    }, reconfigure_interval);

    check_join_set("command line");
};

exports.close = function () {
    clearInterval(heartbeat_timer);
    clearTimeout(reconfigure_timer);
}

exports.filters = {
    "GET /1/rr/heartbeat":
      function incoming_heartbeat(req, res) {
          handle_heartbeat(new Client(req, res));
      },
    "POST /1/rr/join":
      function incoming_join(req, res) {
          handle_join(new Client(req, res));
      },
    "GET /ignore":
      function ignore_router(req, res) {
          handle_ignore(new Client(req, res));
      },
    "GET /add":
      function add_router(req, res) {
          handle_add(new Client(req, res));
      },
    "GET /checksum":
      function checksum(req, res) {
          var ring_checksum = hash(ring_json),
              client        = new Client(req, res);
          client.send_header(200);
          client.res_end(ring_checksum);
      },
    "GET /ping":
      function ping(req, res) {
          res.writeHead(200);
          res.end();
      }
};

exports.get = function (name) { return routers[name]; };

exports.format_statuses = format_statuses;
exports.lookup = lookup;
exports.routers = routers;
exports.join_set = join_set;
exports.state = ring_state;
