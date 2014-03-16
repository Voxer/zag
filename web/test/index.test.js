var tap          = require('tap')
  , test         = tap.test
  , qs           = require('querystring')
  , http         = require('http')
  , fs           = require('fs')
  , path         = require('path')
  , EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , level        = require('level')
  , Daemon       = require('zag-daemon')
  , Backend      = require('zag-backend-leveldb')
  , MetricsWeb   = require('../app')
  , levelPath    = __dirname + "/test.db"
  , publicPath   = __dirname + "/public"
  , db           = level(levelPath)
  , webPort      = 10407
  , daemonPort   = webPort + 1
  , daemonHost   = "127.0.0.1:" + daemonPort
  , ENV          = "test"
  , metricsDaemon, metricsWeb

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
  , defaultPath: "/graph/foo"
  }).on("ready", function() { t.end() })
})

////////////////////////////////////////////////////////////////////////////////

test("GET /", function(t) {
  request("/", {method: "GET"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 302)
    t.equals(res.headers.location, "/graph/foo")
    t.notOk(body)
    t.end()
  })
})

test("GET /graph/*", function(t) {
  request("/graph/foo", {method: "GET"}, function(err, res, body) {
    if (err) throw err
    t.equals(res.statusCode, 200)
    t.equals(res.headers["content-type"], "text/html")
    t.ok(body)
    t.end()
  })
})

;["/public/index.css"
, "/public/bundle.min.js"
, "/public/bundle.js"
].forEach(function(asset) {
  test("GET " + asset, function(t) {
    request(asset, {method: "GET"}, function(err, res, body) {
      if (err) throw err
      t.equals(res.statusCode, 200)
      t.equals(res.headers["content-length"], Buffer.byteLength(body).toString())
      t.ok(body)
      t.end()
    })
  })
})


test("GET /api/channels/:id", function(t) {
  http.get("http://127.0.0.1:" + webPort + "/api/channels/foo?delta=20", function(res) {
    t.equals(res.statusCode, 200)
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

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function request(urlPath, options, callback) {
  if (options.parameters) {
    urlPath += "?" + qs.stringify(options.parameters)
  }
  var req = http.request(
  { hostname: "127.0.0.1"
  , port:     webPort
  , method:   options.method || "GET"
  , path:     urlPath
  }, function(res) { collect(res, callback) })
  .on("error", callback)
  .end(options.body)
  return req
}

function collect(stream, callback) {
  var bufs = []
  stream.on("error", callback)
  stream.on("data", function(buf) { bufs.push(buf) })
  stream.on("end", function() {
    callback(null, stream, Buffer.concat(bufs).toString())
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
