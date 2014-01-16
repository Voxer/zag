var downCounter   = require('./downsample/counter')
  , downHistogram = require('./downsample/histogram')
  , downLLQ       = require('./downsample/llquantize')
  , flattenLLQ    = require('./flatten-llq')
  , Interval      = require('./interval')
  , reLLQ         = /@llq$/

module.exports = MetricsLoader

function noop() {}

///
/// Fetching, downsampling, and caching of metrics data.
///
/// All deltas are in *milliseconds*.
///
/// TODO: normalization:
///   Unfortunately normalization can emphasize anomalies in a
///   way that seems to confuse people (a previous version included it),
///   so this may be better off without any.
///
/// loadRaw(key, delta, [{start, end}], callback(err, points))
///   Get all points for the given key/range/delta combination.
///   * key   - String, metrics key name.
///   * delta - Integer, this should just select which table/bucket to use.
///   * intervals - [{start, end}]
///     * start - Integer timestamp, inclusive.
///     * end   - Integer timestamp, inclusive.
///   * callback(err, points)
///     The points should be ordered by timestamp.
/// writeCache(key, delta, points, callback(err))
///   Write some points to a (possibly persistent) cache.
/// levels - [Integer]
///   The deltas that should be cached.
///   The first element of this list should be the minimum delta, e.g.
///   whatever the points are initially stored at by the metrics server.
///
function MetricsLoader(loadRaw, writeCache, levels) {
  this.loadRaw      = loadRaw
  this.writeCache   = writeCache
  this.levels       = levels.sort(byVal)
  this.levelDownMap = mapDown(this.levels)
  this.minLevel     = levels[0]
}

function byVal(a, b) { return a - b }

// Exported for tests
MetricsLoader.mapDown     = mapDown
MetricsLoader.floor       = floor
MetricsLoader.identify    = identify
MetricsLoader.resolveType = resolveType

// Public: This is the exposed access point for metrics data.
//
// key     - String metrics key.
// options -
//   * start    - Integer timestamp (required)
//   * end      - Integer timestamp (required)
//   * delta    - Integer, milliseconds (60000 minimum (1 minute)).
//   * nocacheR - Boolean, default: false.
//                If true, don't read from the downsample cache.
//   * nocacheW - Boolean, default: false.
//                If true, don't write to the downsample cache.
// callback(err, points, type)
//   `points` is an Array of Object.
//
MetricsLoader.prototype.load = function(key, options, callback) {
  var delta = options.delta
    , start = floor(options.start, delta)
    , end   = floor(options.end, delta) // add a delta to be inclusive

  // Don't cache unless its a level.
  if (!~this.levels.indexOf(delta)) {
    options.nocacheW = true
    options.abnormal = true
  }
  this.loadIntervals(key, options, [new Interval(start, end)], function(err, points, type) {
    if (err)                   return callback(err)
    if (type === "llquantize") return callback(null, flattenLLQ(points), type)
    callback(null, points, type)
  })
}

// key       - String
// options   - {delta, nocacheR, nocacheW}
// intervals - [Interval]
// callback(err, points, type)
MetricsLoader.prototype.loadIntervals = function(key, options, intervals, callback) {
  var delta = options.delta
    , _this = this
  // Raw data.
  this.loadRawCache(key, options, intervals, function(err, points) {
    if (err) return callback(err)

    var type = reLLQ.test(key) ? "llquantize"
             : points[0] && resolveType(identify(points[0]))
    if (delta === _this.minLevel) {
      return callback(null, Interval.fill(points, intervals, delta), type)
    }

    var gaps = Interval.gaps(points, intervals, delta)
    // Fast path: the entire interval was cached.
    if (!gaps.length) return callback(null, points, type)

    // Load a lower delta and downsample.
    var downLevel = _this.levelDown(delta)
      , downOpts  =
        { delta:    downLevel
        , nocacheR: options.nocacheR
        }
    for (var i = 0; i < gaps.length; i++) {
      gaps[i].end += delta - downLevel
    }

    _this.loadIntervals(key, downOpts, gaps, function(err, smallGapPoints, _type) {
      if (err) return callback(err)
      type = resolveType(type, _type)
      var gapPoints = downsample(type, smallGapPoints, delta)
      callback(null, Interval.mergePoints(points, gapPoints), type)

      if (options.nocacheW) return

      // Don't save the last point until all of the points are in.
      var lastPoint = gapPoints[gapPoints.length - 1]
      if (lastPoint.ts + delta > Date.now()) {
        gapPoints.pop()
      }

      // Best effort: write the downsampled points to the cache for reuse.
      // Errors are ignored, b/c nobody cares.
      _this.writeCache(key, delta, gapPoints, noop)
    })
  })
}

// Call `loadRaw`. If `nocacheR` is `true`, fake an empty response.
//
// key       - String
// options   - {delta, nocacheR}
// intervals - [Interval]
// callback(err, points)
//
MetricsLoader.prototype.loadRawCache = function(key, options, intervals, callback) {
  if ((options.nocacheR && options.delta !== this.minLevel)
   ||  options.abnormal) {
    return process.nextTick(function() { callback(null, []) })
  }
  this.loadRaw(key, options.delta, intervals, callback)
}

// Get the highest delta-level that can be used to compose `delta`, other than
// itself.
//
// delta - Integer, >minLevel
//
// Returns Integer
MetricsLoader.prototype.levelDown = function(delta) {
  var level = this.levelDownMap[delta]
  if (level) return level

  // Handle custom deltas
  var levels = this.levels
  for (var i = levels.length; i >= 0; i--) {
    var level = levels[i]
    if (level < delta && delta % level === 0) return level
  }
  return this.minLevel
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// Resolve which type to identify the metrics as.
// Histogram takes precedence, counter is the default.
//
// fromType - "histogram", "counter", "llquantize", or null.
// newType  - "histogram", "counter", "llquantize", or null.
//
// Returns String type "histogram" or "counter".
function resolveType(fromType, newType) {
  return (fromType && fromType !== "counter") ? fromType
       : (newType  && newType  !== "counter") ? newType
       : (fromType || newType || "counter")
}

// Floor a timestamp to an arbitrary mod.
function floor(n, delta) { return n - n % delta }

// Returns String or null.
function identify(pt) {
  if (!pt) return null
  return pt.mean  !== undefined ? "histogram"
       : pt.count !== undefined ? "counter"
       : pt.data  !== undefined ? "llquantize"
       : null
}

//
// type   - String "histogram" or "counter" or "llquantize"
// points - [Point]
//
// Returns [Point]
function downsample(type, points, delta) {
  return type === "histogram"  ? downHistogram(points, delta)
       : type === "counter"    ? downCounter(points, delta)
       : type === "llquantize" ? downLLQ(points, delta)
       : points
}

// Create a mapping from each delta to the next smaller delta, or null if it
// is the smallest.
//
// levels - [Integer], sorted array
//
// Examples:
//
//   > mapDown([1, 5, 60])
//   {60: 5, 5: 1, 1: null}
//
// Returns {Integer : Integer or null}
function mapDown(levels) {
  var map = {}
    , current, prev
  for (var i = 0; i < levels.length; i++) {
    prev    = levels[i - 1] || null
    current = levels[i]
    map[current] = prev
  }
  return map
}
