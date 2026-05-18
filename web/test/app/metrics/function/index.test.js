var test          = require('tap').test
  , MetricsLoader = require('../../../../app/metrics')

// End-to-end tests for the function-key evaluator path through
// MetricsLoader.load. The evaluator (web/app/metrics/function/index.js)
// recursively calls back into loader.load for each raw-key dependency, so
// these tests exercise the full plumbing: dispatch, over-fetch, recursive
// raw-load, operator application, visible-range slicing.

////////////////////////////////////////////////////////////////////////////////
// Fixtures
////////////////////////////////////////////////////////////////////////////////

// Per-minute counter series with `value = ts/60000 * 10` (i.e. 0, 10, 20, ...
// 0,1,2,...,N) shaped as counter points {ts, count}.
function counterSeries(startTs, endTs, deltaMs, valueAt) {
  var pts = []
  for (var ts = startTs; ts <= endTs; ts += deltaMs) {
    pts.push({ ts: ts, count: valueAt(ts) })
  }
  return pts
}

// Default valueAt: linear ramp by index (1 unit per delta).
function linearAt(deltaMs) {
  return function(ts) { return ts / deltaMs }
}

////////////////////////////////////////////////////////////////////////////////
// Test loader: records calls so over-fetch behavior can be asserted.
////////////////////////////////////////////////////////////////////////////////

function makeLoader(allPoints, levels) {
  var calls = []
  function loadRaw(key, delta, intervals, callback) {
    calls.push({ key: key, delta: delta, intervals: intervals.map(function(i) {
      return { start: i.start, end: i.end }
    }) })
    if (!allPoints[key]) return process.nextTick(function() { callback(null, []) })
    if (delta !== levels[0]) return process.nextTick(function() { callback(null, []) })
    // Per-minute fixture lookup: return all points in any requested interval.
    var out = []
    var all = allPoints[key]
    for (var i = 0; i < intervals.length; i++) {
      var iv = intervals[i]
      for (var j = 0; j < all.length; j++) {
        if (all[j].ts >= iv.start && all[j].ts <= iv.end) out.push(all[j])
      }
    }
    process.nextTick(function() { callback(null, out) })
  }
  function writeCache() {}
  var loader = new MetricsLoader(loadRaw, writeCache, levels)
  loader._calls = calls
  return loader
}

////////////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////////////

test("rate: end-to-end via function-key", function(t) {
  // Counter 0,1,2,...,10 at per-minute. rate over 1m delta = 1/60000 per ms.
  var loader = makeLoader(
    { req: counterSeries(0, 600000, 60000, linearAt(60000)) },
    [60000, 300000])

  loader.load("{rate(req)}",
    { start: 60000, end: 300000, delta: 60000 },
    function(err, points, type) {
      if (err) throw err
      t.equals(type, "counter")
      // Visible range [60000, 300000] at 60s delta ⇒ ts 60000, 120000, 180000,
      // 240000, 300000 (5 points). Each rate value = 1/60000.
      t.equals(points.length, 5)
      points.forEach(function(p, i) {
        t.equals(p.ts, 60000 + i * 60000)
        t.equals(p.count, 1 / 60000)
      })
      t.end()
    })
})

test("rate: over-fetches one delta before visible range", function(t) {
  var loader = makeLoader(
    { req: counterSeries(0, 600000, 60000, linearAt(60000)) },
    [60000, 300000])

  loader.load("{rate(req)}",
    { start: 120000, end: 300000, delta: 60000 },
    function(err, points) {
      if (err) throw err
      // Inspect raw loader calls — the perminute load should have started at
      // 120000 - 60000 = 60000 (over-fetch by one delta for rate's lookback).
      var perMinCalls = loader._calls.filter(function(c) { return c.delta === 60000 })
      t.ok(perMinCalls.length > 0, "raw per-minute load happened")
      var earliestStart = Math.min.apply(null,
        perMinCalls.map(function(c) { return c.intervals[0].start }))
      t.equals(earliestStart, 60000, "over-fetched back by rate's 1-delta lookback")
      // And the visible result starts at 120000 (the over-fetched 60000 point
      // is sliced away).
      t.equals(points[0].ts, 120000)
      t.end()
    })
})

test("rolling_mean: over-fetches by window", function(t) {
  // 3-step window means over-fetch by 180000ms.
  var loader = makeLoader(
    { v: counterSeries(0, 600000, 60000, linearAt(60000)) },
    [60000, 300000])

  loader.load("{rolling_mean(v, 180000)}",
    { start: 300000, end: 480000, delta: 60000 },
    function(err, points) {
      if (err) throw err
      var perMinCalls = loader._calls.filter(function(c) { return c.delta === 60000 })
      var earliest = Math.min.apply(null,
        perMinCalls.map(function(c) { return c.intervals[0].start }))
      t.equals(earliest, 300000 - 180000, "over-fetched by 180000ms")
      // Visible range first point ts=300000. Underlying values at ts 180k,
      // 240k, 300k are 3, 4, 5 ⇒ rolling_mean = 4.
      t.equals(points[0].ts, 300000)
      t.equals(points[0].count, 4)
      t.end()
    })
})

test("nested calls stack their lookback", function(t) {
  // zscore(rate(v), 180000): rate adds 60000, zscore adds 180000 ⇒ 240000.
  var loader = makeLoader(
    { v: counterSeries(0, 600000, 60000, linearAt(60000)) },
    [60000, 300000])

  loader.load("{zscore(rate(v), 180000)}",
    { start: 300000, end: 480000, delta: 60000 },
    function(err, points) {
      if (err) throw err
      var perMinCalls = loader._calls.filter(function(c) { return c.delta === 60000 })
      var earliest = Math.min.apply(null,
        perMinCalls.map(function(c) { return c.intervals[0].start }))
      t.equals(earliest, 300000 - 240000, "lookback stacked: rate(60k) + zscore(180k)")
      // Underlying rate series is constant (1/60000) ⇒ zscore stddev = 0
      // ⇒ all visible points are empty.
      t.ok(points.every(function(p) { return p.empty }),
        "flat rate ⇒ zero stddev ⇒ empty zscore")
      t.end()
    })
})

test("ratio: loads both arms in parallel", function(t) {
  var loader = makeLoader(
    { ok:  counterSeries(0, 300000, 60000, function() { return 8 })
    , err: counterSeries(0, 300000, 60000, function() { return 2 })
    },
    [60000, 300000])

  loader.load("{ratio(ok, err)}",
    { start: 0, end: 300000, delta: 60000 },
    function(err, points) {
      if (err) throw err
      // Each point: 8/(8+2) = 0.8.
      points.forEach(function(p) { t.equals(p.count, 0.8) })
      // Two distinct raw keys loaded at per-minute level.
      var rawKeys = {}
      loader._calls.forEach(function(c) {
        if (c.delta === 60000) rawKeys[c.key] = true
      })
      t.ok(rawKeys.ok && rawKeys.err, "both arms loaded")
      t.end()
    })
})

test("subkey extraction: zscore(latency@p95)", function(t) {
  // Histogram-shaped points. Subkey extraction picks p95 specifically.
  var hist = []
  for (var i = 0; i <= 10; i++) {
    hist.push({ ts: i * 60000, count: 100, mean: 5, std_dev: 1, max: 10
              , p95: i === 10 ? 50 : 5 })
  }
  var loader = makeLoader({ latency: hist }, [60000, 300000])

  loader.load("{zscore(latency@p95, 180000)}",
    { start: 0, end: 600000, delta: 60000 },
    function(err, points) {
      if (err) throw err
      // The p95 values are flat at 5 except for the final spike at 50.
      // For most points the window stddev is 0 ⇒ empty. At the spike
      // (index 10) the window (8,9,10) has values (5, 5, 50): non-zero
      // stddev ⇒ non-empty.
      var last = points[points.length - 1]
      t.notEqual(last.empty, true, "spike point has a zscore")
      t.ok(last.count > 0, "spike zscore is positive")
      t.end()
    })
})

test("error: arity mismatch", function(t) {
  var loader = makeLoader({}, [60000, 300000])
  loader.load("{rate(a, b)}", // rate takes 1 arg
    { start: 0, end: 60000, delta: 60000 },
    function(err) {
      t.ok(err, "errored on arity mismatch")
      t.ok(/rate expects 1 arg/.test(err.message), "useful error message")
      t.end()
    })
})

test("error: unknown operator surfaces from parser", function(t) {
  var loader = makeLoader({}, [60000, 300000])
  loader.load("{foo(bar)}",
    { start: 0, end: 60000, delta: 60000 },
    function(err) {
      t.ok(err, "errored on unknown op")
      t.ok(/unknown operator: foo/.test(err.message))
      t.end()
    })
})

test("output is type=counter, shape={ts, count}", function(t) {
  var loader = makeLoader(
    { v: counterSeries(0, 300000, 60000, linearAt(60000)) },
    [60000, 300000])

  loader.load("{rate(v)}",
    { start: 60000, end: 300000, delta: 60000 },
    function(err, points, type) {
      if (err) throw err
      t.equals(type, "counter", "derived series report as 'counter' to the chart pipeline")
      points.forEach(function(p) {
        if (!p.empty) {
          t.equals(typeof p.count, "number")
          t.equals(typeof p.ts, "number")
        }
      })
      t.end()
    })
})
