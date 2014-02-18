module.exports = IntervalLoader

///
/// The IntervalLoader is responsible for fetching intervals of metrics data from
/// the server and stitching them together into Intervals.
///
/// It caches everything it fetches. Currently it never invalidates the cache,
/// so it will only be cleared by a page reload.
/// TODO release unused data so that long-running pages don't get bogged down.
///
/// Point data is keyed by "<base-metrics-key>@<delta>"
/// Tags are just keyed by the string "tags".
///
/// load(mkey, start, end, callback(fail, data))
///   This function should actually make the HTTP request to the server and
///   parse the response. It should *not* do any of its own caching.
///
function IntervalLoader(load) {
  this._load     = load
  this.intervals = {} // {"key" : Interval}
}

// Exposed for testing.
IntervalLoader.Interval = Interval

// This is the primary function to fetch data.
//
// ikey  - String
// start - Integer
// end   - Integer
// callback(fail, interval)
//
IntervalLoader.prototype.load = function(ikey, start, end, callback) {
  var interval = this.intervals[ikey]
    , _this    = this
    , newRanges

  // Only 1 "load" per key can be performed at concurrently.
  if (interval && interval.isLoading) {
    return interval.pushWaiter(new Waiter(ikey, start, end, callback))
  }

  if (interval) {
    newRanges = intervalDiff(interval.start, interval.end, start, end)
    // The data is already cached.
    if (!newRanges.length) {
      return setTimeout(function() {
        callback(null, interval)
        _this.onIntervalReady(interval)
      }, 0)
    }
  } else {
    newRanges = [[start, end]]
    interval  = this.intervals[ikey] = new Interval(ikey)
  }
  interval.isLoading = true

  var rangeCount = newRanges.length
    , remaining  = rangeCount
    , failed
  newRanges.forEach(function(range) {
    var rangeStart = range[0]
      , rangeEnd   = range[1]
    _this._load(ikey, rangeStart, rangeEnd, function(fail, data) {
      if (fail) failed = fail
      if (data) interval.add(data, rangeStart, rangeEnd)
      // done
      if (--remaining === 0) {
        callback(failed, interval)
        interval.isLoading = false
        _this.onIntervalReady(interval)
      }
    })
  })
}

// If the Interval has a waiter, execute it.
//
// interval - Interval
//
IntervalLoader.prototype.onIntervalReady = function(interval) {
  var waiter = interval.getWaiter()
  if (waiter) {
    this.load(waiter.key, waiter.start, waiter.end, waiter.callback)
  }
}

// Like `IntervalLoader#load`, but call back when all of the mkeys are fetch.
//
// mkeys - [String]
// start - Integer
// end   - Integer
// callback(fail) - Use `IntervalLoader#get` to get the Interval.
//
IntervalLoader.prototype.loadMany = function(mkeys, start, end, callback) {
  var count    = mkeys.length
    , complete = 0
    , didFail

  for (var i = 0; i < count; i++) {
    this.load(mkeys[i], start, end, onLoad)
  }

  function onLoad(fail) {
    if (fail) didFail = true
    if (++complete < count) return
    callback(didFail)
  }
}

// Returns Interval or undefined.
IntervalLoader.prototype.get = function(mkey) {
  return this.intervals[mkey]
}

IntervalLoader.prototype.getData = function(mkey) {
  return this.get(mkey).data
}


// A continuous interval of metrics data.
//
// mkey  - String
//
function Interval(mkey) {
  this.mkey  = mkey
  this.data  = null
  this.start = null
  this.end   = null

  this.isLoading = false
  this.waiters   = null // [Waiter]
}

// Exposed for testing.
Interval.diff = intervalDiff

// Add data to the interval.
//
// points - [Point]
// start  - Integer timestamp
// end    - Integer timestamp
//
Interval.prototype.add = function(points, start, end) {
  if (!this.data) {
    this.data  = points
    this.start = start
    this.end   = end
    return
  }

  var current = this.data
  // Prepend
  if (end <= this.start) {
    for (var i = points.length - 1; i >= 0; i--) {
      current.unshift(points[i])
    }
  // Append
  } else {
    for (var i = 0; i < points.length; i++) {
      current.push(points[i])
    }
  }

  this.start = Math.min(this.start, start)
  this.end   = Math.max(this.end,   end)
}

// Queue the interval request.
//
// waiter - Waiter
//
Interval.prototype.pushWaiter = function(waiter) {
  if (!this.waiters) this.waiters = []
  this.waiters.push(waiter)
}

// Get the next waiter that needs running.
//
// Returns Waiter or undefined.
Interval.prototype.getWaiter = function() {
  if (!this.waiters) return
  return this.waiters.shift()
}

function Waiter(key, start, end, callback) {
  this.key      = key
  this.start    = start
  this.end      = end
  this.callback = callback
}


// Compute the difference of 2 intervals (sort of).
// The difference is represented as an Array of ranges (start,end tuples).
//
// minA, maxA - Number, describes the initial interval.
// minB, maxB - Number, describes the new interval.
//
// Returns [[Integer start, Integer end]]
function intervalDiff(minA, maxA, minB, maxB) {
  return (minA <=  minB && maxB <=  maxA) ? []             // A includes B
       : (minA === maxB || maxA === minB) ? [[minB, maxB]] // Shared edge; no overlap
       : (minA <=  minB)                  ? [[maxA, maxB]] // Shared min || gap on the right
       : (maxB <=  maxA)                  ? [[minB, minA]] // Shared max || gap on the left
       : [ [minB, minA]
         , [maxA, maxB]
         ] // Double interval
}
