var EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits

module.exports = Interval

/// A bounded interval that emits events when its range changes.
///
/// If max or min is `null`, that dimension is unbounded.
///
/// low  - Number
/// high - Number
/// min  - Number or null, min  <= low
/// max  - Number or null, high <= max
///
/// Events:
///   * zoom(low, high)
///   * pan:move(low, high)
///   * pan:done(low, high)
///
/// Other classes use a shared Interval (e.g. the synced X interval) to
/// propagate an event (e.g. `hover:x`) to many charts.
///
function Interval(low, high, min, max) {
  this.low = low; this.high = high
  this.min = min; this.max  = max
  this.dirty = false
  // A dashboard's X interval can have quite a lot of listeners, since it is
  // shared between member charts.
  this.setMaxListeners(0)
}

inherits(Interval, EventEmitter)

// Set the interval's extremes. If the current low/high don't fit within
// this range, adjust them.
//
// min, max - Number or null
//
Interval.prototype.setBounds = function(min, max) {
  this.min = min
  this.max = max
}

Interval.prototype.isInBounds = function() {
  return (this.min === null || this.min <= this.low)
      && (this.max === null || this.max >= this.high)
}

// Returns Boolean: whether or not the range changed.
Interval.prototype.zoom = function(low, high) {
  return this.setRange("zoom", low, high)
}

Interval.prototype.panMove = function(low, high) {
  this.dirty = true
  this.setRange("pan:move", low, high)
}

Interval.prototype.panDone = function() {
  if (this.dirty) {
    this.dirty = false
    this.emit("pan:done", this.low, this.high)
  }
}

// delta - Number
Interval.prototype.panBy = function(delta) {
  var low  = this.low
    , high = this.high
  if (this.min !== null && low + delta < this.min) {
    delta = this.min - low
  } else if (this.max !== null && this.high + delta > this.max) {
    delta = this.max - high
  }
  this.panMove(low + delta, high + delta)
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// event     - String
// low, high - Number
// Returns Boolean: whether or not the range changed.
Interval.prototype.setRange = function(event, low, high) {
  if (this.low === low && this.high === high) return false
  this.emit(event, this.low = low, this.high = high)
  return true
}
