var http          = require('http')
  , fs            = require('fs')
  , path          = require('path')
  , stylus        = require('stylus')
  , nib           = require('nib')
  , qs            = require('querystring')
  , browserify    = require('browserify')
  , uglify        = require('uglify-js')
  , inherits      = require('util').inherits
  , EventEmitter  = require('events').EventEmitter
  , makeAgent     = require('../../agent')
  , MetricsRouter = require('./routes')
  , clientDir     = path.join(__dirname, "../client")
  , stylusDir     = path.join(clientDir, "stylus")
  , jsDir         = path.join(clientDir, "js")

module.exports = MetricsWeb

///
/// options: (required)
///   host        - "address:port"
///   db          - String postgres connection
///   env         - "dev", "prod", "test", ...
///   daemons     - ["address:port"]
///   defaultPath - String "/graph/some_metrics_key" or "/dashboards/some_dashboard"
///   backend     - PGBackend
///   public      - String, a readable/writable directory path.
///
/// Events:
///   error(err)
///   ready() - The server is online.
///
function MetricsWeb(options) {
  var _this     = this
    , publicDir = options.public = path.resolve(options.public)

  this.agent   = makeAgent(options.daemons)
  this.agent.on("error", this.onError.bind(this))
  this.metrics = this.agent.scope("metrics-web")

  this.db = new options.backend(
    { env:     options.env
    , db:      options.db
    , agent:   this.metrics.scope("postgres")
    , onError: this.onError.bind(this)
    })
  this.router = new MetricsRouter(
    { db:          this.db
    , agent:       this.metrics
    , defaultPath: options.defaultPath || "/graph/metrics-daemon>keys"
    , public:      options.public
    })
  this.server = http.createServer(function(req, res) { _this.onRequest(req, res) })

  try { fs.mkdirSync(publicDir) } catch(e) {}

  // Generate assets.
  buildCSS(path.join(stylusDir, "index.styl"), function(err, css) {
    if (err) return callback(err)
    fs.writeFile(path.join(publicDir, "index.css"), css)
    buildJS(publicDir, options.env === "prod", function() {
      var addrport = options.host.split(":")
      _this.server.listen(+addrport[1], addrport[0], _this.onReady.bind(_this))
    })
  })
}

inherits(MetricsWeb, EventEmitter)

MetricsWeb.prototype.onError = function(err) { this.emit("error", err) }
MetricsWeb.prototype.onReady = function(err) { this.emit("ready", err) }

MetricsWeb.prototype.close = function() {
  this.db.close()
  this.router.close()
  this.server.close()
}

var reRoute = /[*?]/g

MetricsWeb.prototype.onRequest = function(req, res) {
  var split = req.url.split("?")
    , match = this.router.match(split[0])
  req.qs     = qs.parse(split[1])
  req.params = match.params
  req.splats = match.splats

  res.on("finish", trackTiming(this.metrics, match.route.replace(reRoute, "")))
  match.fn(req, res)
}

function trackTiming(agent, route) {
  var start = Date.now()
  return function() {
    agent.histogram("timing|" + route + "|" + this.statusCode, Date.now() - start)
  }
}

// file     - The `.styl` file to compile.
// callback - Receives `(err, css_string)`.
function buildCSS(file, callback) {
  fs.readFile(file, function(err, data) {
    if (err) return callback(err)
    stylus(data.toString())
      .set("filename", file)
      .set("paths", [stylusDir, nib.path])
      .render(function(err, css) {
        if (err) return callback(err)
        callback(null, css)
      })
  })
}

function buildJS(publicDir, minify, callback) {
  var bundle    = path.join(publicDir, "bundle.js")
    , bundleMin = path.join(publicDir, "bundle.min.js")
    , sourceMap = path.join(publicDir, "bundle.js.map")
  browserify(path.join(jsDir, + "index.js")).bundle()
    .pipe(fs.createWriteStream(bundle))
    .on("close", done)

  function done() {
    if (!minify) {
      return fs.createReadStream(bundle)
        .pipe(fs.createWriteStream(bundleMin))
        .on("close", callback)
    }
    var res = uglify.minify(bundle, {outSourceMap: "/public/bundle.js.map"})
      , map = JSON.parse(res.map)
    map.sources = ["/public/bundle.js"]
    res.code += "\n//# sourceMappingURL=/public/bundle.js.map"
    fs.writeFileSync(bundleMin, res.code)
    fs.writeFileSync(sourceMap, JSON.stringify(map))
    callback()
  }
}
