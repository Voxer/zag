var IntervalLoader  = require('./interval-loader')
  , RateLimit       = require('./rate-limit')
  , MetricsFunction = require('./metrics-function')
  , parseMKey       = require('../../../lib/mkey')
  , isFn            = parseMKey.isFunction
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
PointLoader.prototype.load = function(iKey, start, end, callback) {
  var split = iKey.split("#")
    , mkey  = split[0]
    , delta = split[1]

  if (isFn(mkey)) {
    this.loadFunction(MetricsFunction.get(mkey), delta, start, end, callback)
  } else {
    this.get(mkey, delta, start, end, callback)
  }
}

// TODO finish functions
//
// mfn   - MetricsFunction
// delta - String
// start - Integer timestamp
// end   - Integer timestamp
// callback(fail, points)
PointLoader.prototype.loadFunction = function(mfn, delta, start, end, callback) {
  var args        = mfn.args
    , remaining   = args.length
    , pointsByKey = {} // { mkey : points }
    , err
  args.forEach(function(fullkey) {
    var mkey = parseMKey(fullkey)
    this.get(mkey.key, delta, start, end, function(fail, points) {
      if (fail) err = fail
      else pointsByKey[mkey.key] = points
      if (--remaining === 0) done()
    })
  }, this)

  function done() {
    if (err) return callback(err)
    callback(null, mfn.process(pointsByKey))
  }
}

// mkey  - String
// delta - Integer, milliseconds
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
