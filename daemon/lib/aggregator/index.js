var EventEmitter      = require('events').EventEmitter
  , DeltaList         = require('./delta-list')
  , IntervalList      = require('./interval-list')
  , calibrateInterval = require('./calibrate-interval')
  , Counter           = require('./metrics/counter')
  , Histogram         = require('./metrics/histogram')
  , LLQ               = require('./metrics/llq')

var keyChar = "[ \\w/._()+:-]"
  , reKey   = new RegExp("^" + keyChar + "+([|>]" + keyChar + "+)*(@llq)?$")

module.exports = MetricsAggregator

/// Aggregate (local) metrics. Does _not_ handle key recursion or ring
/// traversal.
///
/// `Metric` is one of:
///   * Counter
///   * Histogram
///   * LLQ
///
/// onSave({mkey : Point})
///   Called every `saveDelta` milliseconds with the points by mkey.
/// saveDelta - Integer, milliseconds
///
function MetricsAggregator(onSave, saveDelta) {
  this.onSave    = onSave
  this.saveDelta = saveDelta
  this.metrics   = {} // { interval : { mkey : Metric } }
  this.liveKeys  = {} // { interval : { mkey : true } }
  this.liveEE    = new EventEmitter()
  this.deltas    = new DeltaList(saveDelta)
  this.intervals = new IntervalList(saveDelta)

  var _this = this
  this.clearRollup = calibrateInterval(function() { _this.save() }, saveDelta)
  this.intervals.counts[saveDelta] = 1
}

// For testing.
MetricsAggregator.reKey = reKey

MetricsAggregator.prototype.destroy = function() {
  this.clearRollup()
  this.intervals.destroy()
}

// mkey  - String
// value - Number
// Returns Boolean: whether or not the `mkey` was valid.
MetricsAggregator.prototype.counter = function(mkey, value) {
  return this.metric(Counter, mkey, value)
}

// mkey  - String
// value - Number
// Returns Boolean: whether or not the `mkey` was valid.
MetricsAggregator.prototype.histogram = function(mkey, value) {
  return this.metric(Histogram, mkey, value)
      && this.metric(LLQ, mkey + "@llq", value)
}

// Hook into a metric at a custom interval.
//
// mkey  - String
// delta - Integer, milliseconds
// handler(point)
//
MetricsAggregator.prototype.onKey = function(mkey, delta, handler) {
  this.deltas.add(mkey, delta)
  this.liveEE.on(eventName(mkey, delta), handler)

  if (!this.liveKeys[delta]) this.liveKeys[delta] = {}
  this.liveKeys[delta][mkey] = true

  if (this.intervals.has(delta)) {
    this.intervals.incr(delta)
  } else {
    var _this = this
    this.intervals.setInterval(function() { _this.emitKeys(delta) }, delta)
  }
}

// Remove a listener.
//
// mkey  - String
// delta - Integer, milliseconds
// handler(point)
//
MetricsAggregator.prototype.offKey = function(mkey, delta, handler) {
  var ev = eventName(mkey, delta)
  this.liveEE.removeListener(ev, handler)

  if (this.liveEE.listeners(ev).length === 0) {
    this.deltas.remove(mkey, delta)
    delete this.liveKeys[delta][mkey]
  }
  this.intervals.decr(delta)
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Emit the live data for the given delta.
//
// delta - Integer, milliseconds
//
MetricsAggregator.prototype.emitKeys = function(delta) {
  var liveSet = this.liveKeys[delta]
    , metrics = this.metrics[delta]
  this.metrics[delta] = {}

  if (!liveSet || !metrics) return

  var mkeys  = Object.keys(liveSet)
    , points = pluckPoints(metrics, delta, mkeys)
    , ts     = floorTime(Date.now(), delta)
  for (var i = 0, l = mkeys.length; i < l; i++) {
    var mkey  = mkeys[i]
      , point = points[mkey] || {ts: ts, empty: true}
    point.key = mkey
    this.liveEE.emit(eventName(mkey, delta), point)
  }
}

// Returns Boolean: whether or not the `mkey` was valid.
MetricsAggregator.prototype.metric = function(type, mkey, value) {
  if (!reKey.test(mkey)) return false
  var deltas = this.deltas.get(mkey)
  for (var i = 0; i < deltas.length; i++) {
    this.updateMetric(type, mkey, value, deltas[i])
  }
  return true
}

MetricsAggregator.prototype.updateMetric = function(Metric, mkey, value, delta) {
  var metrics = this.metrics[delta] || (this.metrics[delta] = {})
  ;(metrics[mkey] || (metrics[mkey] = new Metric())).push(value)
}

MetricsAggregator.prototype.save = function() {
  var delta  = this.saveDelta
    , points = toPoints(this.metrics[delta] || {}, delta)
  // emitKeys resets `metrics[saveDelta]`
  this.emitKeys(delta)
  this.onSave(points)
}


function eventName(mkey, delta) { return "key:" + delta + ":" + mkey }

// metrics - { String mkey : Metric }
// Returns { String mkey : Object point }
function toPoints(metrics, interval) {
  return pluckPoints(metrics, interval, Object.keys(metrics))
}

function pluckPoints(metrics, interval, mkeys) {
  var points = {}
    , ts     = floorTime(Date.now(), interval)
  for (var i = 0, l = mkeys.length; i < l; i++) {
    var mkey   = mkeys[i]
      , metric = metrics[mkey]
    if (metric) points[mkey] = metric.toJSON(ts)
  }
  return points
}

function floorTime(ts, interval) {
  return ts - (ts % interval)
}
