module.exports = IntervalList

/// Maintain 1 interval function for each interesting delta.
function IntervalList() {
  this.intervals = {} // { delta : Interval }
  this.counts    = {} // { delta : Integer }
}

// Clear all intervals. For testing only.
IntervalList.prototype.destroy = function() {
  var deltas = Object.keys(this.intervals)
  for (var i = 0; i < deltas.length; i++) {
    this.clearInterval(deltas[i])
  }
}

// Get whether an interval already is bound to the delta.
//
// delta - Integer, milliseconds
//
// Returns Boolean.
IntervalList.prototype.has = function(delta) {
  return !!this.counts[delta]
}

// Add/remove a waiter. When the number of waiters hits zero,
// the interval is cleared.
IntervalList.prototype.incr = function(delta) { this.counts[delta]++ }
IntervalList.prototype.decr = function(delta) {
  if (--this.counts[delta] === 0) {
    this.clearInterval(delta)
  }
}

// Attach an interval to the given function.
// Before calling, check that `.has(delta)` returns false.
//
// fn    - Function
// delta - Integer, milliseconds
//
IntervalList.prototype.setInterval = function(fn, delta) {
  this.intervals[delta] = setInterval(fn, delta)
  this.counts[delta]    = 0
  this.incr(delta)
}

// Internal: Clear the interval associated with the given delta.
//
// delta - Integer, milliseconds
//
IntervalList.prototype.clearInterval = function(delta) {
  var interval = this.intervals[delta]
  if (interval) {
    clearInterval(interval)
    this.intervals[delta] = null
  }
}
