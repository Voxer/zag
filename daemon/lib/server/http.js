var http          = require('http')
  , qs            = require('querystring')
  , routes        = require('routes')
  , MetricsStream = require('./metrics-stream')

module.exports = MetricsHTTPServer

/// ring       - MetricsRing
/// aggregator - MetricsAggregator
function MetricsHTTPServer(ring, aggregator) {
  this.ring       = ring
  this.aggregator = aggregator
  this.router     = new routes.Router()
  this.warnings   = []

  this.addRoute("/api/metrics",         {POST: this.onPostMetrics})
  this.addRoute("/api/monitor",         {GET: this.onGetMonitor})
  this.addRoute("/api/live/:mkey",      {GET: this.onGetLiveMetrics})
  this.addRoute("/api/ring/live/:mkey", {GET: this.onGetLiveMetricsRing})

  var _this = this
  // Wait till next tick to allow ring.js to add routes.
  process.nextTick(function() {
    _this.router.addRoute("*", send404)
  })

  this.server = http.createServer(function(req, res) {
    _this.onRequest(req, res)
  })
}

MetricsHTTPServer.prototype.close = function() { this.server.close() }

MetricsHTTPServer.prototype.listen = function(port, address, callback) {
  this.server.listen(port, address, callback)
}

MetricsHTTPServer.prototype.onRequest = function(req, res) {
  var split = req.url.split("?")
    , match = this.router.match(split[0])
  req.qs     = qs.parse(split[1])
  req.params = match.params
  req.splats = match.splats
  match.fn(req, res)
}

MetricsHTTPServer.prototype.addRoute = function(path, actions) {
  var _this = this
  this.router.addRoute(path, function(req, res) {
    ;(actions[req.method] || send405).call(_this, req, res)
  })
}

// warnings - [Warning]
MetricsHTTPServer.prototype.setWarnings = function(warnings) {
  this.warnings = warnings
}

////////////////////////////////////////////////////////////////////////////////
// Endpoints
////////////////////////////////////////////////////////////////////////////////

// POST /api/metrics
//
// Body:
//   \n-delimited "<type>:<key>=<value" metrics.
//
MetricsHTTPServer.prototype.onPostMetrics = function(req, res) {
  var ring = this.ring
  req.pipe(new MetricsStream(function(metrics) {
    ring.metrics(metrics, false)
  }))
  req.on("end", makeSend204(res))
}

// GET /api/monitor
//
// Response: 200 JSON: [Warning]
MetricsHTTPServer.prototype.onGetMonitor = function(req, res) {
  writeJSON(req, res, this.warnings)
}

// GET /api/live/:mkey?delta=ms
// Parameters:
//   delta - Integer, downsample interval in milliseconds (required).
//
// Response: 200 "\n"-delimited JSON stream.
//   {key, ts, count, ...}\n
MetricsHTTPServer.prototype.onGetLiveMetrics = function(req, res) {
  var mkey    = req.params.mkey
    , q       = qs.stringify(req.qs)
    , baseKey = mkey.split("@")[0] // send @llq to the base key
    , url     = "http://" + this.ring.lookup(baseKey) + "/api/ring/live/" + encodeURIComponent(mkey) + "?" + q

  req.on("error",   close)
  req.on("aborted", close)
  var relay = http.get(url, function(ringRes) {
    ringRes.pipe(res)
  }).on("error", close)

  function close() {
    relay.destroy()
    res.destroy()
  }
}

// GET /api/ring/live/:mkey?delta=ms
//
// Response: Same as `/api/live/:mkey`
MetricsHTTPServer.prototype.onGetLiveMetricsRing = function(req, res) {
  var mkey  = req.params.mkey
    , delta = +req.qs.delta
    , agg   = this.aggregator
  if (!delta) {
    res.statusCode = 400
    return res.end()
  }

  req.on("error",   onDone)
  req.on("aborted", onDone)
  agg.onKey(mkey, delta, onPoint)

  function onPoint(point) {
    res.write(JSON.stringify(point) + "\n")
  }

  function onDone() {
    agg.offKey(mkey, delta, onPoint)
    res.destroy()
  }
}

function writeJSON(req, res, json) {
  var data = JSON.stringify(json)
  res.writeHead(200,
    { "Content-Type":  "application/json"
    , "Content-Length": data.length
    })
  res.end(data)
}

function send404(req, res) {
  res.statusCode = 404
  res.end()
}

function send405(req, res) {
  res.statusCode = 405
  res.end()
}

function makeSend204(res) {
  return function() {
    res.statusCode = 204
    res.end()
  }
}
