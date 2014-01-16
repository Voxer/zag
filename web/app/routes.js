var zlib             = require('zlib')
  , crypto           = require('crypto')
  , fs               = require('fs')
  , Router           = require('routes')
  , EventSource      = require('../lib/event-source')
  , DBKeyTree        = require('./models/mkeys')
  , DashboardManager = require('./models/dashboard')
  , TagTypeManager   = require('./models/tag-type')
  , Monitor          = require('./models/monitor')
  , MetricsChannels  = require('./models/channel')
  , MetricsLoader    = require('./metrics')

var st = require('st')(
  { path:        __dirname + "/../public"
  , url:        "public/"
  , passthrough: false
  })

var appHTML = fs.readFileSync(__dirname + "/../public/index.html")

module.exports = MetricsRouter

function minToMS(n) { return n * 60000 }

/// db          - Backend
/// agent       - MetricsAgent
/// defaultPath - String "/url/path"
function MetricsRouter(db, agent, defaultPath) {
  this.db          = db
  this.agent       = agent
  this.defaultPath = defaultPath
  this.router      = new Router()
  this.dashboards  = new DashboardManager(db)
  this.tagtypes    = new TagTypeManager(db)
  this.mkeys       = new DBKeyTree(db)
  this.monitor     = new Monitor(agent.pool)
  this.channels    = new MetricsChannels(agent.pool)
  this.metrics     = new MetricsLoader
    ( this.readPoints.bind(this)
    , this.writePoints.bind(this)
    , [minToMS(1), minToMS(60), minToMS(1440)])

  // Re-fetch the key tree once per minute.
  this.mkeyInterval = setInterval(this.mkeys.reload.bind(this.mkeys), minToMS(1))

  var router = this.router
  /// Views
  router.addRoute("/", this.makeRoute({GET: renderIndex}))
  router.addRoute("/graph", this.makeRoute({GET: renderApp}))
  router.addRoute("/graph/*", this.makeRoute({GET: renderApp}))
  router.addRoute("/dashboards/*", this.makeRoute({GET: renderApp}))

  /// API
  router.addRoute("/api/keys", this.makeRoute({GET: getRootMetricKey}))
  router.addRoute("/api/keys/*", this.makeRoute(
    { GET:    getMetricKey
    , DELETE: deleteMetricKey
    }))
  router.addRoute("/api/filter", this.makeRoute({GET: filterMetricKeys}))
  router.addRoute("/api/allkeys", this.makeRoute({GET: listAllMetricKeys}))
  router.addRoute("/api/metrics/*", this.makeRoute({GET: getMetricData}))
  router.addRoute("/api/dashboards", this.makeRoute({GET: listDashboards}))
  router.addRoute("/api/dashboards/:id", this.makeRoute(
    { GET:    getDashboard
    , POST:   setDashboard
    , PATCH:  patchDashboard
    , DELETE: deleteDashboard
    }))
  router.addRoute("/api/tags", this.makeRoute(
    { GET:  getTags
    , POST: createTag
    }))
  router.addRoute("/api/tags/:id", this.makeRoute({DELETE: deleteTag}))
  router.addRoute("/api/tagtypes", this.makeRoute(
    { GET:  getTagTypes
    , POST: createTagType
    }))
  router.addRoute("/api/tagtypes/:id", this.makeRoute({DELETE: deleteTagType}))
  router.addRoute("/api/monitor", this.makeRoute({GET: getMonitor}))
  router.addRoute("/api/channels/:id", this.makeRoute(
    { GET:  getChannelMetrics
    , POST: setChannelMetrics
    }))

  /// Static
  router.addRoute("/public/*?", st)
  router.addRoute("*", function(req, res) {
    res.statusCode = 404
    res.end()
  })
}

MetricsLoader.prototype.close = function() {
  clearInterval(this.mkeyInterval)
}

MetricsRouter.prototype.makeRoute = function(actions) {
  var router = this
  return function(req, res) {
    ;(actions[req.method] || send405).call(router, req, res)
  }
}

MetricsRouter.prototype.match = function(pathname) {
  return this.router.match(pathname)
}

////////////////////////////////////////////////////////////////////////////////
// Metrics
////////////////////////////////////////////////////////////////////////////////

MetricsRouter.prototype.readPoints = function(mkey, delta, intervals, callback) {
  var suffix    = delta === minToMS(1) ? "" : ("#" + delta)
    , allPoints = []
    , index     = 0
    , isOne     = intervals.length === 1
    , db        = this.db

  next()
  function next() {
    var interval = intervals[index++]
    if (!interval) return callback(null, allPoints)
    db.getPoints(mkey + suffix, interval.start, interval.end, done)
  }

  function done(err, points) {
    if (err)   return callback(err)
    if (isOne) return callback(null, points)
    for (var i = 0; i < points.length; i++) {
      allPoints.push(points[i])
    }
    next()
  }
}

var FIELDS = ["count", "mean", "median", "std_dev", "p10", "p75", "p95", "p99"]

// Remove all of the floating point cruft.
function roundPoint(pt) {
  for (var i = 0; i < FIELDS.length; i++) {
    var field = FIELDS[i]
      , value = pt[field]
    if (value > 10) pt[field] = Math.floor(value * 1000) / 1000
  }
  return pt
}

MetricsRouter.prototype.writePoints = function(mkey, delta, points, callback) {
  var cacheKey = mkey + "#" + delta
    , total    = points.length

  for (var i = 0; i < points.length; i++) {
    this.db.savePoint(cacheKey, roundPoint(points[i]), done)
  }

  function done(err) {
    if (--total === 0) callback()
  }
}

////////////////////////////////////////////////////////////////////////////////
// Routes
////////////////////////////////////////////////////////////////////////////////

// GET /
//
// Response: 302 Redirect
function renderIndex(req, res) {
  res.writeHead(302, {Location: this.defaultPath})
  res.end()
}

// GET /graph/:mkey
//
// Response: 200 HTML
function renderApp(req, res) {
  res.writeHead(200,
    { "Content-Type":  "text/html"
    , "Content-Length": appHTML.length
    })
  res.end(appHTML)
}


// GET /api/keys
//
// Response: 200 JSON
function getRootMetricKey(req, res) {
  this.mkeys.listKey(null, function(err, mkeys) {
    if (err) return sendError(err, res)
    writeJSON(req, res, mkeys)
  })
}

// GET /api/keys/:mkeys
// `mkeys` is comma-separated metrics keys.
//
// Fetch the key's children.
//
// Response: 200 JSON
function getMetricKey(req, res) {
  var mkeys = decodeURIComponent(req.splats[0]).split(",")
  this.mkeys.listKeys(mkeys, function(err, trees) {
    if (err) return sendError(err, res)
    writeJSON(req, res, trees)
  })
}

// DELETE /api/keys/:mkey
// Delete a key from the tree.
//
// Response: 204
function deleteMetricKey(req, res) {
  var mkey = decodeURIComponent(req.splats[0])
  this.mkeys.deleteKey(mkey, send204(res))
}

// GET /api/filter
// Parameters:
//   * q     - String query
//   * limit - Integer max results (optional)
//
// Response: 200 JSON
function filterMetricKeys(req, res) {
  var query = req.qs.q
    , limit = req.qs.limit || 100

  if (!query) {
    res.statusCode = 400
    return res.end()
  }
  this.mkeys.filter(query, limit, function(err, mkeys) {
    if (err) return sendError(err, res)
    writeJSON(req, res, mkeys)
  })
}

// GET /api/allkeys
//
// Response: 200 JSON
function listAllMetricKeys(req, res) {
  this.mkeys.listAll(function(err, mtree) {
    if (err) return sendError(err, res)
    writeJSON(req, res, mtree)
  })
}

// GET /api/metrics/:mkey
//
// Get the metrics data for a specific stat.
//
// Parameters:
//   * start - Integer timestamp, required
//   * end   - Integer timestamp, required
//   * delta - Integer minutes (1, 5, 60, ...) (optional).
//
// Response: 200 JSON point data
function getMetricData(req, res) {
  var mkey  = decodeURIComponent(req.splats[0])
    , query = req.qs
    , start = query.start
    , end   = query.end
    , delta = query.delta || minToMS(1)
    , agent = this.agent

  if (!start || !end) {
    res.statusCode = 400
    return res.end()
  }

  var etag = mkey + ":" + start + "|" + end + "|" + delta
  if (etag === req.headers["if-none-match"]) {
    res.statusCode = 304
    return res.end()
  }

  agent.histogram("get_metrics>delta", delta)
  agent.histogram("get_metrics>interval", end - start)

  this.metrics.load(mkey,
  { start:    +start
  , end:      +end
  , delta:    +delta
  , nocacheR: !!query.nocache
  }, function(err, points, type) {
    if (err) return sendError(err, res)

    // Don't cache data if it is incomplete.
    if (+end < Date.now()) res.setHeader("ETag", etag)
    agent.histogram("get_metrics>points", points.length)
    agent.counter("get_metrics>type|" + type)
    writeJSON(req, res, points)
  })
}

///
/// Dashboards
///

// GET /api/dashboards
//
// Response: 200 JSON [String id]
function listDashboards(req, res) {
  this.dashboards.list(function(err, ids) {
    if (err) return sendError(err, res)
    writeJSON(req, res, ids)
  })
}

// GET /api/dashboard/:id
//
// Response: 200 JSON {id, graphs}
function getDashboard(req, res) {
  this.dashboards.get(req.params.id, function(err, dash) {
    if (err) return sendError(err, res)
    if (!dash) {
      res.statusCode = 404
      return res.end()
    }
    writeJSON(req, res, dash)
  })
}

// POST /api/dashboard/:id
// Body: JSON {id, graphs}
//
// Replace a dashboard.
//
// Response: 204
function setDashboard(req, res) {
  var dashboards = this.dashboards
    , data       = ""
  collectJSON(req, function(err, dash) {
    if (err) return sendError(err, res)
    dashboards.set(req.params.id, dash, send204(res))
  })
}

// PATCH /api/dashboard/:id
// Body: JSON
//   { id:     String
//   , graphs: {id : {name, keys, renderer, histkeys, subkey}}
//   }
//
// Append a graph to the dashboard.
//
// Response: 204
function patchDashboard(req, res) {
  var dashboards = this.dashboards
  collectJSON(req, function(err, dashboard) {
    if (err) return sendError(err, res)
    dashboards.modify(req.params.id, dashboard, send204(res))
  })
}

// DELETE /api/dashboard/:id
//
// Response: 204
function deleteDashboard(req, res) {
  this.dashboards.del(req.params.id, send204(res))
}

///
/// Tags
///

// GET /api/tags
// Parameters:
//   * begin - Integer
//   * end   - Integer
//
// Response: 200 JSON.
function getTags(req, res) {
  var q = req.qs
  if (!q.begin || !q.end) {
    res.statusCode = 400
    return res.end()
  }
  this.db.getTagRange(+q.begin, +q.end, function(err, tags) {
    if (err) return sendError(err, res)
    writeJSON(req, res, tags)
  })
}

// POST /api/tags
// Parameters:
//   * id    - String
//   * ts    - Integer timestamp
//   * label - String
//   * color - String, hex color
//
// Response: 204
function createTag(req, res) {
  var q = req.qs
  if (!q.ts || !q.label || !q.color) {
    res.statusCode = 400
    return res.end()
  }
  this.db.setTag(
    { id:    q.id
    , label: q.label
    , color: q.color
    , ts:   +q.ts
    }, send204(res))
}

// DELETE /api/tags/:id
//
// Response: 204
function deleteTag(req, res) {
  this.db.deleteTag(req.params.id, send204(res))
}

///
/// Tag types
///

// GET /api/tagtypes
//
// Response: 200 JSON [{id, color, name}]
function getTagTypes(req, res) {
  this.tagtypes.getTagTypes(function(err, tagtypes) {
    if (err) return sendError(err, res)
    writeJSON(req, res, tagtypes)
  })
}

// POST /api/tagtypes
// Parameters:
//   * color - String e.g. "#ff0000"
//   * name  - String
//
// Response: 204
function createTagType(req, res) {
  var q = req.qs
  if (!q.name || !q.color || !TagTypeManager.isColor(q.color)) {
    res.statusCode = 400
    return res.end()
  }

  this.tagtypes.createTagType(
  { color: q.color
  , name:  q.name
  }, send204(res))
}

// DELETE /api/tagtypes/:id
//
// Response: 204
function deleteTagType(req, res) {
  this.tagtypes.deleteTagType(req.params.id, send204(res))
}

///
/// Monitoring
///

// GET /api/monitor
//
// Response: 200 JSON: [{mkey, field, value, target, margin, cmp}]
function getMonitor(req, res) {
  this.monitor.getAllWarnings(function(err, warns) {
    if (err) return sendError(err, res)
    writeJSON(req, res, warns)
  })
}

///
/// Channel metrics
///

// GET /api/channels/:id
// Parameters:
//   * delta - Integer, millisecond downsample interval (required).
//
// Response: 200 EventSource
//   Events: "point" {key, ts, count ...}
function getChannelMetrics(req, res) {
  var channelID = req.params.id
    , delta     = +req.qs.delta
  if (!channelID || !delta) {
    res.statusCode = 400
    return res.end()
  }
  var es       = new EventSource(req, res, {keepAlive: true})
    , channels = this.channels
  channels.create(channelID, delta, es)

  res.on("close", onClose)
  function onClose() { channels.destroy(channelID) }
}

// POST /api/channels/:id?delta=ms
// Body: JSON {add: [mkey], remove: [mkey]}
//
// Response: 204
function setChannelMetrics(req, res) {
  var channelID = req.params.id
    , channels  = this.channels
  collectJSON(req, function(err, diff) {
    if (err) return sendError(err, res)
    var add    = diff.add    || []
      , remove = diff.remove || []
    for (var i = 0; i < add.length; i++) {
      channels.add(channelID, add[i])
    }
    for (var i = 0; i < remove.length; i++) {
      channels.remove(channelID, remove[i])
    }
    res.statusCode = 204
    res.end()
  })
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// Returns Boolean
function canGZip(req, res) {
  var accept = req.headers["accept-encoding"]
  return accept && accept.indexOf("gzip") > -1
}

// Respond the the client, compressing the data with gzip if the client
// will accept it.
//
// req, res
// data - String or Buffer
//
function resCompress(req, res, data) {
  if (canGZip(req, res) && data.length > 1000) {
    zlib.gzip(data, function(err, gz) {
      if (err) return sendError(err, res)
      res.setHeader("Content-Length", gz.length)
      res.setHeader("Content-Encoding", "gzip")
      res.end(gz)
    })
  } else {
    res.setHeader("Content-Length", Buffer.byteLength(data))
    res.end(data)
  }
}

function writeJSON(req, res, json) {
  var data = JSON.stringify(json)
  res.statusCode = 200
  res.setHeader("Content-Type", "application/json")
  resCompress(req, res, data)
}

function send204(res) {
  return function(err) {
    if (err) return sendError(err, res)
    res.statusCode = 204
    res.end()
  }
}

function send405(req, res) {
  res.statusCode = 405
  res.end()
}

function sendError(err, res) {
  res.statusCode = 500
  res.end(err.message)
  console.error("Error", err)
}

// Buffer the request body into memory.
//
// req - ServerRequest
// callback(err, buffer)
//
function collectBody(req, callback) {
  var done = false
    , bufs = []
  req.on("data", bufs.push.bind(bufs))
  req.on("end", function() {
    if (done) return
    done = true
    callback(null, Buffer.concat(bufs))
  })
  req.on("error", function(err) {
    if (done) return
    done = true
    callback(err)
  })
}

// Buffer the request body into memory, and parse.
//
// req - ServerRequest
// callback(err, json)
//
function collectJSON(req, callback) {
  collectBody(req, function(err, data) {
    if (err) return callback(err)
    try {
      var json = JSON.parse(data.toString())
    } catch (e) { err = e }
    callback(err, json)
  })
}
