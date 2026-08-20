var IntervalLoader  = require('./interval-loader')
  , RateLimit       = require('./rate-limit')
  , qs              = sail.parseQuery(document.location.search)
  , EventEmitter    = require('events').EventEmitter
  , inherits        = require('util').inherits

module.exports = PointLoader

/// Download metrics.
///
/// Events:
///   * progress(fraction)
///   * loading:start
///   * loading:end
///
function PointLoader() {
  var ajax = this.rlimit = new RateLimit(sailGet,
    { max_cc:   8
    , onChange: this.onChange.bind(this)
    })
  this.loader  = new IntervalLoader(this.load.bind(this))
  this.total   = 0
  this.pending = 0
}

inherits(PointLoader, EventEmitter)

PointLoader.prototype.onChange = function() {
  var limit   = this.rlimit
    , pending = limit.running + limit.waiters.length
    , total   = this.total = Math.max(this.total, pending)
    , fract   = (total - pending) / total

  if (total < 3) return
  if (pending === 0) {
    total = this.total = 0
    fract = 1
  }
  this.emit("progress", fract)
}

// iKey  - String "<mkey>[@llq]#<delta>"
// start - Integer timestamp
// end   - Integer timestamp
// callback(fail, json)
//
// Function-keys (`{rate(...)}`) take this same path — the server evaluates
// them transparently in MetricsLoader (web/app/metrics/function/index.js).
// Encoded as a regular URL key, no client-side decomposition.
PointLoader.prototype.load = function(iKey, start, end, callback) {
  var split = iKey.split("#")
    , mkey  = split[0]
    , delta = split[1]
  this.get(mkey, delta, start, end, callback)
}

// mkey  - String
// delta - Integer, milliseconds. Already clamped to the window by
//         PointEmitter#loaderKey (embedded in the iKey), so it is used verbatim
//         here — the cache key and the fetched resolution always agree.
// start - Integer
// end   - Integer
// callback(fail, json)
PointLoader.prototype.get = function(mkey, delta, start, end, callback) {
  var q = sail.toQueryString(
      { start:   start
      , end:     end
      , delta:   delta
      , nocache: qs.nocache || ""
      })
    , _this = this
  this.more()
  this.rlimit.get( "/api/metrics/" + encodeURIComponent(mkey) + "?" + q
  , function(fail, body) {
    _this.less()
    callback(fail, body)
  })
}

PointLoader.prototype.more = function() {
  if (this.pending++ === 0) this.emit("loading:start")
}

PointLoader.prototype.less = function() {
  if (--this.pending === 0) this.emit("loading:end")
}

function sailGet(url, callback) {
  sail.ajax(url, function(fail, body) { callback(fail, body && JSON.parse(body)) })
}
