var tap          = require('tap')
  , test         = tap.test
  , qs           = require('querystring')
  , http         = require('http')
  , fs           = require('fs')
  , path         = require('path')
  , zlib         = require('zlib')
  , EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , level        = require('level')
  , Daemon       = require('zag-daemon')
  , Backend      = require('zag-backend-leveldb')
  , MetricsWeb   = require('../app')
  , levelPath    = __dirname + "/test.db"
  , publicPath   = __dirname + "/public"
  , db           = level(levelPath, {encoding: "json"})
  , webPort      = 10407
  , daemonPort   = webPort + 1
  , daemonHost   = "127.0.0.1:" + daemonPort
  , ENV          = "test"
  , metricsDaemon, metricsWeb, backend

tap.on("end", function() {
  metricsDaemon.close()
  metricsWeb.close()
  db.close()
  rmRec(publicPath)
  rmRec(levelPath)
})

test("setup", function(t) {
  metricsDaemon = Daemon(
  { host:    daemonHost
  , join:   [daemonHost]
  , db:      db
  , env:     ENV
  , backend: Backend
  })
  metricsWeb = new MetricsWeb(
  { host:        "127.0.0.1:" + webPort
  , db:          db
  , env:         ENV
  , daemons:     ["127.0.0.1:" + daemonPort]
  , backend:     Backend
  , public:      publicPath
  , defaultPath: "/graph/default-metric"
  }).on("ready", function() { t.end() })
  backend = metricsWeb.db
})

////////////////////////////////////////////////////////////////////////////////

test("GET /", function(t) {
  request("/", {method: "GET"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 302)
    t.equals(res.headers.location, "/graph/default-metric")
    t.notOk(body)
    t.end()
  })
})

test("GET /graph/*", function(t) {
  request("/graph/foo", {method: "GET"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 200)
    t.equals(res.headers["content-type"], "text/html")
    t.equals(res.headers["content-length"], Buffer.byteLength(body).toString())
    t.ok(body)
    t.end()
  })
})

test("invalid method : 405", function(t) {
  request("/graph/foo", {method: "POST"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 405)
    t.notOk(body)
    t.end()
  })
})

;["/public/index.css"
, "/public/bundle.min.js"
, "/public/bundle.js"
, "/public/favicon.ico"
].forEach(function(asset) {
  test("GET " + asset, function(t) {
    request(asset, {method: "GET", buffer: true}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.equals(res.headers["content-length"], body.length.toString())
      t.ok(body)
      t.end()
    })
  })
})

///
/// Keys
///

test("setup : keys", function(t) {
  backend.savePoints(
  { "key1":   {ts: 22, count: 55}
  , "key2":   {ts: 22, count: 3, mean: 22}
  , "key1|a": {ts: 22, count: 55}
  , "key1|b": {ts: 22, count: 3, mean: 22}
  })
  setTimeout(function() { t.end() }, 50)
})

test("GET /api/keys", function(t) {
  metricsWeb.router.mkeys.load(function(err) {
    if (err) throw err
    request("/api/keys", {}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.deepEquals(JSON.parse(body),
        [ {key: "key1", hasChildren: true,  type: "counter"}
        , {key: "key2", hasChildren: false, type: "histogram"}
        ])
      t.end()
    })
  })
})

test("GET /api/keys/:mkeys", function(t) {
  metricsWeb.router.mkeys.load(function(err) {
    if (err) throw err
    request("/api/keys/" + encodeURIComponent("key1,key2,key3"), {}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.deepEquals(JSON.parse(body),
        { key1:
          [ {key: "key1|a", hasChildren: false, type: "counter"}
          , {key: "key1|b", hasChildren: false, type: "histogram"}
          ]
        , key2: []
        , key3: []
        })
      t.end()
    })
  })
})

test("DELETE /api/keys/:mkey", function(t) {
  request("/api/keys/" + encodeURIComponent("key1|b"), {method: "DELETE"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    backend.getMetricsKeys(function(err, mkeys) {
      if (err) throw err
      for (var i = 0; i < mkeys.length; i++) {
        t.notEquals(mkeys[i].key, "key1|b")
      }
      t.end()
    })
  })
})

test("setup : update key cache", function(t) {
  metricsWeb.router.mkeys.load(function(err) {
    if (err) throw err
    t.end()
  })
})

test("DELETE /api/keys/:mkey nonexistant", function(t) {
  request("/api/keys/bogus", {method: "DELETE"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    t.end()
  })
})

test("GET /api/filter no query : 400", function(t) {
  request("/api/filter", {}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 400)
    t.notOk(body)
    t.end()
  })
})

;[{ label: "default limit"
  , qs: {q: "k"}
  , res:
    [ {key: "key1", hasChildren: true,  type: "counter"}
    , {key: "key2", hasChildren: false, type: "histogram"}
    ]
  }
, { label: "limit"
  , qs: {q: "k", limit: 1}
  , res:
    [ {key: "key1", hasChildren: true,  type: "counter"}
    ]
  }
].forEach(function(T) {
  test("GET /api/filter " + T.label, function(t) {
    request("/api/filter", {parameters: T.qs}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.deepEquals(JSON.parse(body), T.res)
      t.end()
    })
  })
})

test("GET /api/allkeys", function(t) {
  request("/api/allkeys", {}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 200)
    t.deepEquals(JSON.parse(body), ["key1", "key1|a", "key2"])
    t.end()
  })
})

///
/// Points
///

;[{ label: "no query",  qs: {} }
, { label: "no start",  qs: {end: 40} }
, { label: "no end",    qs: {start: 20} }
, { label: "bad start", qs: {start: "bad", end: 40} }
, { label: "bad end",   qs: {start: 20,    end: "bad"} }
].forEach(function(T) {
  test("GET /api/metrics/:mkey 400 : " + T.label, function(t) {
    request("/api/metrics/foo", {parameters: T.qs}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 400)
      t.notOk(body)
      t.end()
    })
  })
})

///
/// Dashboards
///

test("setup dashboards", function(t) {
  backend.setDashboard("dash1", { id: "dash1", graphs: {} }, function(err) {
    if (err) throw err
    backend.setDashboard("dash2>child", { id: "dash2>child", graphs: {} }, function(err) {
      if (err) throw err
      t.end()
    })
  })
})

test("GET /api/dashboards", function(t) {
  request("/api/dashboards", {}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 200)
    t.deepEquals(JSON.parse(body), ["dash1", "dash2>child"])
    t.end()
  })
})

test("GET /api/dashboards/:id nonexistant", function(t) {
  request("/api/dashboards/bogus", {}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 404)
    t.notOk(body)
    t.end()
  })
})

test("GET /api/dashboards/:id", function(t) {
  request("/api/dashboards/dash1", {}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 200)
    t.deepEquals(JSON.parse(body), {id: "dash1", graphs: {}})
    t.end()
  })
})

test("PATCH /api/dashboards/:id rename", function(t) {
  var body = JSON.stringify({id: "dash1b"})
  request("/api/dashboards/dash1", {method: "PATCH", body: body}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    backend.getDashboard("dash1b", function(err, dash) {
      if (err) throw err
      t.deepEquals(dash, {id: "dash1b", graphs: {}})
      backend.listDashboards(function(err, dashIDs) {
        if (err) throw err
        t.deepEquals(dashIDs, ["dash1b", "dash2>child"])
        t.end()
      })
    })
  })
})

test("PATCH /api/dashboards/:id nonexistant : 404", function(t) {
  var body = JSON.stringify({id: "bogus2"})
  request("/api/dashboards/bogus", {method: "PATCH", body: body}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 404)
    t.notOk(body)
    t.end()
  })
})

test("DELETE /api/dashboards/:id", function(t) {
  request("/api/dashboards/dash1b", {method: "DELETE"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    backend.listDashboards(function(err, dashIDs) {
      if (err) throw err
      t.deepEquals(dashIDs, ["dash2>child"])
      t.end()
    })
  })
})

test("DELETE /api/dashboards/:id nonexistant", function(t) {
  request("/api/dashboards/bogus", {method: "DELETE"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    t.end()
  })
})


///
/// Tags
///

;[{ label: "no querystring", qs: {} }
, { label: "no end",         qs: {begin: 20} }
, { label: "no begin",       qs: {                end: 40} }
, { label: "bad begin",      qs: {begin: "hello", end: 40} }
, { label: "bad end",        qs: {begin: 20,      end: "goodbye"} }
].forEach(function(T) {
  test("GET /api/tags 400 : " + T.label, function(t) {
    request("/api/tags", {parameters: T.qs}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 400)
      t.notOk(body)
      t.end()
    })
  })
})

test("GET /api/tags empty", function(t) {
  request("/api/tags", {parameters: {begin: 20, end: 40}}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 200)
    t.equals(res.headers["content-type"], "application/json")
    t.deepEquals(JSON.parse(body), [])
    t.end()
  })
})

test("GET /api/tags 1 tag", function(t) {
  backend.setTag(
  { ts:    33
  , label: "tag one"
  , color: "#0000ff"
  }, function(err) {
    if (err) throw err
    request("/api/tags", {parameters: {begin: 20, end: 40}}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      var tags = JSON.parse(body)
      t.isa(tags[0].id, "string")
      t.deepEquals(tags,
        [ { id:    tags[0].id
          , ts:    33
          , label: "tag one"
          , color: "#0000ff"
          }
        ])
      t.end()
    })
  })
})

;[{ label: "no params", qs: {} }
, { label: "no ts",     qs: {label: "foo", color: "#ff0000"} }
, { label: "no label",  qs: {ts:    23,    color: "#ff0000"} }
, { label: "no color",  qs: {ts:    23,    label: "foo"} }
, { label: "bad ts",    qs: {ts:    "abc", label: "foo", color: "#ff0000"} }
, { label: "bad color", qs: {ts:    23,    label: "foo", color: "nope"} }
].forEach(function(T) {
  test("POST /api/tags 400 : " + T.label, function(t) {
    request("/api/tags", {method: "POST", parameters: T.qs}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 400)
      t.notOk(body)
      t.end()
    })
  })
})

test("POST /api/tags create tag", function(t) {
  request("/api/tags",
  { method: "POST"
  , parameters:
    { ts:    23
    , label: "tag two"
    , color: "#ff0000"
    }
  }, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    backend.getTagRange(20, 40, function(err, tags) {
      if (err) throw err
      t.equals(tags.length, 2)
      t.equals(tags[0].label, "tag two")
      t.equals(tags[0].ts, 23)
      t.equals(tags[1].label, "tag one")
      t.equals(tags[1].ts, 33)
      t.end()
    })
  })
})

test("DELETE /api/tags/:id nonexistant : 204", function(t) {
  request("/api/tags/bogus", {method: "DELETE"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    t.end()
  })
})

test("DELETE /api/tags/:id : 204", function(t) {
  getTags(function(err, initTags) {
    if (err) throw err
    t.equals(initTags.length, 2)
    request("/api/tags/" + encodeURIComponent(initTags[0].id), {method: "DELETE"}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 204)
      t.notOk(body)
      getTags(function(err, tags) {
        if (err) throw err
        t.equals(tags.length, 1)
        t.equals(tags[0].id, initTags[1].id)
        t.end()
      })
    })
  })

  function getTags(cb) { backend.getTagRange(20, 40, cb) }
})


///
/// Tag types
///

test("GET /api/tagtypes", function(t) {
  backend.createTagType({color: "#ff0000", name: "type A"}, function(err) {
    if (err) throw err
    request("/api/tagtypes", {}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.equals(res.headers["content-type"], "application/json")
      var types = JSON.parse(body)
      t.deepEquals(types,
        [ { id:    types[0].id
          , color: "#ff0000"
          , name:  "type A"
          }
        ])
      t.end()
    })
  })
})

;[{ label: "no params", qs: {} }
, { label: "no name",   qs: {color: "#00ff00"} }
, { label: "no color",  qs: {name:  "type B"} }
, { label: "bad color", qs: {name:  "type B", color: "no good"} }
].forEach(function(T) {
  test("POST /api/tagtypes 400 : " + T.label, function(t) {
    request("/api/tagtypes", {method: "POST", parameters: T.qs}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 400)
      t.notOk(body)
      t.end()
    })
  })
})

test("POST /api/tagtypes", function(t) {
  request("/api/tagtypes",
  { method: "POST"
  , parameters:
    { color: "#00ff00"
    , name:  "type B"
    }
  }, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 204)
    t.notOk(body)
    backend.getTagTypes(function(err, types) {
      if (err) throw err
      t.equals(types.length, 2)
      t.ok(types[0].name === "type A" || types[1].name === "type A")
      t.ok(types[0].name === "type B" || types[1].name === "type B")
      t.end()
    })
  })
})

test("DELETE /api/tagtypes/:id", function(t) {
  backend.getTagTypes(function(err, types) {
    if (err) throw err
    t.equals(types.length, 2)
    request("/api/tagtypes/" + encodeURIComponent(types[0].id), {method: "DELETE"}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 204)
      t.notOk(body)
      backend.getTagTypes(function(err, types) {
        if (err) throw err
        t.equals(types.length, 1)
        t.end()
      })
    })
  })
})

///
/// Channels
///

test("GET /api/channels/:id", function(t) {
  http.get("http://127.0.0.1:" + webPort + "/api/channels/foo?delta=20", function(res) {
    t.equals(res.statusCode, 200)
    t.equals(res.headers["content-type"], "text/event-stream")
    res.pipe(new EventSource(res)).on("point", function(data) {
      var point = JSON.parse(data)
      t.isa(point.ts, "number")
      t.equals(point.empty, true)
      t.ok(point.key === "key1" || point.key === "key2")
      if (point.key === "key2") {
        res.destroy()
        t.end()
      }
    })

    modChannel("foo", {add: ["key1", "key2"]}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 204)
    })
  })
})

test("GET /api/channels/:id no delta -> 400", function(t) {
  request("/api/channels/no-delta", {}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 400)
    t.notOk(body)
    t.end()
  })
})

test("POST /api/channels/:id double remove", function(t) {
  var points = 0
    , done
  http.get("http://127.0.0.1:" + webPort + "/api/channels/bar?delta=20", function(res) {
    res.pipe(new EventSource(res)).on("point", function(data) {
      if (!done) return
      var point = JSON.parse(data)
      t.equals(point.key, "key2")
      if (done++ === 5) {
        res.destroy()
        t.end()
      }
    })

    modChannel("bar", {add: ["key1", "key2"]}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 204)
      modChannel("bar", {remove: ["key1"]}, function(err, res, body) {
        if (err) throw err
        t.equals(res.statusCode, 204)
        modChannel("bar", {remove: ["key1"]}, function(err, res, body) {
          if (err) throw err
          t.equals(res.statusCode, 204)
          done = true
        })
      })
    })
  })
})

///
/// Compression
///

test("Accept-Encoding: gzip", function(t) {
  function setup(callback) {
    var left  = 10
      , label = repeat("Q", 100)
    for (var i = 0; i < left; i++) {
      backend.setTag({ts: 25, color: "#f00", label: label}, done)
    }
    function done(err) {
      if (err) throw err
      if (--left === 0) callback()
    }
  }

  setup(function() {
    request("/api/tags",
    { parameters: {begin: 24, end: 26}
    , headers:    {"Accept-Encoding": "gzip"}
    , buffer:     true
    }, function(err, res, zbody) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.equals(res.headers["content-encoding"], "gzip")
      t.equals(res.headers["content-length"], zbody.length.toString())
      t.throws(function() { JSON.parse(zbody) })
      zlib.gunzip(zbody, function(err, body) {
        if (err) throw err
        t.equals(JSON.parse(body.toString()).length, 10)
        t.end()
      })
    })
  })
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function request(urlPath, options, callback) {
  if (!callback) throw new Error("Missing callback")
  if (options.parameters) {
    urlPath += "?" + qs.stringify(options.parameters)
  }
  var req = http.request(
  { hostname: "127.0.0.1"
  , port:     webPort
  , method:   options.method || "GET"
  , path:     urlPath
  , headers:  options.headers
  }, function(res) { collect(res, options.buffer === true, callback) })
  .on("error", callback)
  .end(options.body)
  return req
}

function collect(stream, returnBuffer, callback) {
  var bufs = []
  stream.on("error", callback)
  stream.on("data", function(buf) { bufs.push(buf) })
  stream.on("end", function() {
    var buf = Buffer.concat(bufs)
    callback(null, stream, returnBuffer ? buf : buf.toString())
  })
}

function rmRec(dir) {
  var files = fs.readdirSync(dir)
  for (var i = 0; i < files.length; i++) {
    fs.unlinkSync(path.join(dir, files[i]))
  }
  fs.rmdirSync(dir)
}

function EventSource(res) { this.writable = true }
inherits(EventSource, EventEmitter)
EventEmitter.prototype.write = function(data) {
  var lines = data.toString().split("\n")
    , event = /^event: (\w+)$/.exec(lines[0])
  if (event) {
    this.emit(event[1], lines[1].slice("data: ".length))
  }
}
EventEmitter.prototype.end = function() {}

function modChannel(channelID, data, callback) {
  request("/api/channels/" + encodeURIComponent(channelID),
  { method: "POST"
  , body:   JSON.stringify(data)
  }, callback)
}

function repeat(char, n) {
  var s = ""
  while (n-- > 0) s += char
  return s
}
