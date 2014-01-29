var EventEmitter      = require('events').EventEmitter
  , inherits          = require('util').inherits
  , dgram             = require('dgram')
  , agent             = require('../../agent')
  , MetricsMonitor    = require('./monitor')
  , MetricsAggregator = require('./aggregator')
  , MetricsRing       = require('./server/ring')
  , MetricsHTTPServer = require('./server/http')
  , MetricsUDPServer  = require('./server/udp')
  , Ring              = require('./ring')
  , defaultLogger     = {log: noop, warn: noop, error: noop}

module.exports = MetricsDaemon

function noop() {}

///
/// options -
///   host    - String "address:port"
///   join    - [String "address:port"]
///   db      - String, postgres connection
///   env     - String, "dev", "prod", "test"
///   backend - PGBackend
///   logger
///
/// Events:
///   * error(err)
///
function MetricsDaemon(options) {
  var hp      = options.host.split(":")
    , address = hp[0]
    , port    = +hp[1]
    , logger  = options.logger || defaultLogger
    , _this   = this

  this.agent   = agent([options.host])
  this.agent.on("error", this.onError.bind(this))
  this.metrics = this.agent.scope("metrics-daemon")

  Ring.init(
    { name: options.host
    , listen:
      { ring:
        { address: options.host.split(":")[0]
        , port:    options.host.split(":")[1]
        }
      }
    , metrics: this.agent.scope("ring")
    , options: {join: options.join}
    , logger:  logger
    })

  this.socket = dgram.createSocket("udp4")
  this.socket.on("error", this.onError.bind(this))
  this.socket.bind(port, address)

  this.ms = new options.backend(
    { db:      options.db
    , env:     options.env || "dev"
    , agent:   this.metrics.scope("postgres")
    , onError: this.onError.bind(this)
    })

  this.mm = new MetricsMonitor(this.ms)
  this.mm.on("error", this.onError.bind(this))
  this.mm.on("warn",  this.onMonitorWarnings.bind(this))

  this.ma = new MetricsAggregator(function(points) {
    //_this.mm.test(points)
    _this.ms.savePoints(points)
    _this.metrics.histogram("keys", Object.keys(points).length)
    _this.metrics.histogram("live_keys", _this.ma.deltas.size())
  }, 60000)

  this.ring = new MetricsRing(this.socket, this.ma, Ring, options.host)
  this.udp  = new MetricsUDPServer(this.ring)
  this.http = new MetricsHTTPServer(this.ring, this.ma)
  this.http.listen(port, address)

  var udp = this.udp
  this.socket.on("message", function(msg, rinfo) { udp.onMessage(msg, rinfo) })

  // Add the ring filters...
  var fpaths = Object.keys(Ring.filters)
  for (var i = 0; i < fpaths.length; i++) {
    var fpath  = fpaths[i]
      , method = fpath.split(" ")[0]
      , path   = fpath.split(" ")[1]
      , routes = {}
    routes[method] = Ring.filters[fpath]
    this.http.addRoute(path, routes)
  }
}

inherits(MetricsDaemon, EventEmitter)

MetricsDaemon.prototype.close = function() {
  this.socket.close()
  this.http.close()
  this.ma.destroy()
  this.db.close()
}

MetricsDaemon.prototype.onError = function(err) { this.emit("error", err) }

MetricsDaemon.prototype.onMonitorWarnings = function(warnings) {
  this.http.setWarnings(warnings)
}
