var Interval = require('./interval')
  , CLOCK    = 1

module.exports = VersionedInterval

/// A single dimension of pointsets, bounded by either the default low/high, or
/// by the data.
///
/// low, high - Number, initial bounds.
/// min, max  - Number, initial extremes.
/// delta     - Integer, optional
///
function VersionedInterval(low, high, min, max, delta) {
  this.interval  = new Interval(low, high, min, max)
  this.zoomStack = []
  this.delta     = delta
  this.isZoomed  = false
}

VersionedInterval.prototype.destroy = function() {
  this.interval = this.zoomStack = null
}

// Proxy EventEmitter things to Interval.
;["on", "removeListener", "removeAllListeners"].forEach(function(method) {
  VersionedInterval.prototype[method] = function(ev, fn) {
    return this.interval[method](ev, fn)
  }
})

///
/// Interval controls
///

VersionedInterval.prototype.zoom = function(low, high) {
  if (this.interval.zoom(low, high)) {
    this.zoomStack.push(
      new Zoom(low, high, this.delta))
    this.isZoomed = true
  }
}

VersionedInterval.prototype.panMove = function(low, high) {
  this.interval.panMove(low, high)
}

VersionedInterval.prototype.panDone = function() { this.interval.panDone() }
VersionedInterval.prototype.panBy   = function(delta) { this.interval.panBy(delta) }


// Jump to the previous (applicable) zoom.
VersionedInterval.prototype.popZoom = function() {
  this.zoomStack.pop()
  this._popZoom()
}

// Internal: Revert the latest zoom.
VersionedInterval.prototype._popZoom = function() {
  if (!this.zoomStack.length) return this.resetZoom()
  var zoom = this.zoomStack.pop()
  // Delta mismatch; retry.
  if (zoom.delta !== this.delta) return this._popZoom()
  this.zoom(zoom.low, zoom.high)
}

// Returns Integer or null
VersionedInterval.prototype.getZoomClock = function() {
  var lastZoom = this.zoomStack[this.zoomStack.length - 1]
  return lastZoom ? lastZoom.clock : null
}

////////////////////////////////////////////////////////////////////////////////

// Store a zoom (the action).
//
// low   - Number
// high  - Number
// delta - Number, the delta at the time of creation.
//
function Zoom(low, high, delta) {
  this.low   = low
  this.high  = high
  this.delta = delta
  this.clock = CLOCK++
}
