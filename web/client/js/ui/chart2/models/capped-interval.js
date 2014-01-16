var VersionedInterval = require('./versioned-interval')
  , inherits          = require('util').inherits

module.exports = CappedInterval

/// X
/// A Capped Interval has explicit (optionally unbounded) extremes.
/// It also has a default range.
///
/// opts -
///   low  - Default lower bound (required).
///   high - Default upper bound (required).
///   min  - Number or null. Absolute minimum (default: null).
///   max  - Number or null. Absolute maximum (default: null).
///
function CappedInterval(opts) {
  // Default to uncapped.
  VersionedInterval.call(this, opts.low, opts.high, orNull(opts.min), orNull(opts.max), null)
  this.defaultLow  = opts.low
  this.defaultHigh = opts.high
}

inherits(CappedInterval, VersionedInterval)

function orNull(val) { return val === undefined ? null : val }

CappedInterval.prototype.resetZoom = function() {
  this.isZoomed = false
  this.interval.zoom(this.defaultLow, this.defaultHigh)
}

CappedInterval.prototype.setDefaultRange = function(defaultLow, defaultHigh) {
  this.zoom(
    this.defaultLow  = defaultLow,
    this.defaultHigh = defaultHigh)
}
