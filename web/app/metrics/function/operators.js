/// Phase 2 operators. Pure functions over scalar series of the shape
///   [{ts, value} or {ts, empty: true}]
///
/// All operators emit `empty` for points whose window is not yet filled. The
/// evaluator's over-fetch policy ensures the visible range has fully-filled
/// windows so long as the underlying series has enough data — when it
/// doesn't, the leading visible points are honestly empty rather than
/// silently biased toward zero / the stable asymptote (Prometheus's
/// convention; explicit > graceful).
///
/// Each operator receives `delta` (the per-point spacing, ms) as its final
/// positional argument so windowed ops can compute "N points back" without
/// having to infer spacing from the series itself.

var ARITY =
  { rate:           1
  , delta:          2
  , rolling_mean:   2
  , rolling_stddev: 2
  , zscore:         2
  , ratio:          2
  }

var OPS =
  { rate:           rate
  , delta:          deltaOp
  , rolling_mean:   rolling_mean
  , rolling_stddev: rolling_stddev
  , zscore:         zscore
  , ratio:          ratio
  }

module.exports          = OPS
module.exports.lookback = lookback
module.exports.arity    = ARITY

////////////////////////////////////////////////////////////////////////////////
// Operators
////////////////////////////////////////////////////////////////////////////////

// rate(series, delta) — pointwise (v[i] - v[i-1]) / delta. Per-millisecond.
// First point is always empty (no predecessor). Counter-style metric.
function rate(series, delta) {
  var out = new Array(series.length)
  for (var i = 0; i < series.length; i++) {
    if (i === 0 || series[i].empty || series[i - 1].empty) {
      out[i] = empty(series[i].ts)
    } else {
      out[i] = { ts: series[i].ts
               , value: (series[i].value - series[i - 1].value) / delta
               }
    }
  }
  return out
}

// delta(series, windowMs, delta) — pointwise v[i] - v[i - N] where
// N = windowMs / delta. Points with i < N are empty.
function deltaOp(series, windowMs, delta) {
  var n = stepsFor(windowMs, delta)
  var out = new Array(series.length)
  for (var i = 0; i < series.length; i++) {
    if (i < n || series[i].empty || series[i - n].empty) {
      out[i] = empty(series[i].ts)
    } else {
      out[i] = { ts: series[i].ts
               , value: series[i].value - series[i - n].value
               }
    }
  }
  return out
}

// rolling_mean(series, windowMs, delta) — mean of the last N points
// (inclusive of current). Empty until the window has N samples.
function rolling_mean(series, windowMs, delta) {
  var n = Math.max(1, stepsFor(windowMs, delta))
  return windowedReduce(series, n, function(slice) {
    var sum = 0, count = 0
    for (var j = 0; j < slice.length; j++) {
      if (!slice[j].empty) { sum += slice[j].value; count++ }
    }
    return count === 0 ? null : sum / count
  })
}

// rolling_stddev(series, windowMs, delta) — sample stddev (Bessel) of last N
// points. Matches the convention used by Phase 1's pooled-variance path so
// `rolling_stddev` over a per-minute scalar series is comparable to
// per-bucket `std_dev` values stored alongside.
function rolling_stddev(series, windowMs, delta) {
  var n = Math.max(2, stepsFor(windowMs, delta))
  return windowedReduce(series, n, function(slice) {
    var sum = 0, count = 0
    for (var j = 0; j < slice.length; j++) {
      if (!slice[j].empty) { sum += slice[j].value; count++ }
    }
    if (count < 2) return null
    var mean = sum / count
    var ss = 0
    for (var k = 0; k < slice.length; k++) {
      if (!slice[k].empty) {
        var d = slice[k].value - mean
        ss += d * d
      }
    }
    return Math.sqrt(ss / (count - 1))
  })
}

// zscore(series, windowMs, delta) — (v - rolling_mean) / rolling_stddev.
// Empty wherever either the mean or stddev is empty, or stddev is zero
// (z-score is undefined; treating div-by-zero as 0 would mask true flat
// regions as "normal", treating as Infinity bombs the chart — empty is the
// honest answer).
function zscore(series, windowMs, delta) {
  var means = rolling_mean(series, windowMs, delta)
  var stds  = rolling_stddev(series, windowMs, delta)
  var out = new Array(series.length)
  for (var i = 0; i < series.length; i++) {
    var pt = series[i]
    if (pt.empty || means[i].empty || stds[i].empty || stds[i].value === 0) {
      out[i] = empty(pt.ts)
    } else {
      out[i] = { ts: pt.ts
               , value: (pt.value - means[i].value) / stds[i].value
               }
    }
  }
  return out
}

// ratio(seriesA, seriesB) — pointwise A / (A + B). Paired by ts (the two
// series are assumed to come from the same delta but the loader may produce
// slightly different empty patterns). 0/0 returns 0 (the "no traffic" case
// shouldn't look like 100% error rate).
function ratio(seriesA, seriesB) {
  var byTs = {}
  for (var i = 0; i < seriesB.length; i++) byTs[seriesB[i].ts] = seriesB[i]
  var out = new Array(seriesA.length)
  for (var j = 0; j < seriesA.length; j++) {
    var a = seriesA[j], b = byTs[a.ts]
    if (!b || a.empty || b.empty) {
      out[j] = empty(a.ts)
    } else {
      var sum = a.value + b.value
      out[j] = { ts: a.ts, value: sum === 0 ? 0 : a.value / sum }
    }
  }
  return out
}

////////////////////////////////////////////////////////////////////////////////
// Lookback
////////////////////////////////////////////////////////////////////////////////

// Maximum milliseconds of look-back data needed to evaluate an AST node.
// Used by the evaluator's over-fetch policy.
//
// node  - AST node ({type: "call"|"key"|"number", ...})
// delta - Integer, per-point spacing in ms
//
// Returns Integer milliseconds.
function lookback(node, delta) {
  if (node.type !== "call") return 0
  var children = 0
  for (var i = 0; i < node.args.length; i++) {
    var c = lookback(node.args[i], delta)
    if (c > children) children = c
  }
  var here = ownLookback(node, delta)
  return children + here
}

// Look-back contributed by THIS node, ignoring its children's contributions.
// Stacked at evaluation time: outer ops add their lookback on top of the
// inner result's already-stable series, so the over-fetch needs to cover
// the deepest nested path.
function ownLookback(node, delta) {
  switch (node.op) {
    case "rate":           return delta
    case "delta":          return numArg(node, 1, 0)
    case "rolling_mean":   return numArg(node, 1, 0)
    case "rolling_stddev": return numArg(node, 1, 0)
    case "zscore":         return numArg(node, 1, 0)
    case "ratio":          return 0
    default:               return 0
  }
}

function numArg(node, idx, fallback) {
  var a = node.args[idx]
  return (a && a.type === "number") ? a.value : fallback
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function empty(ts) { return { ts: ts, empty: true } }

// How many points span `windowMs` at `delta` spacing. Floors to 1 to avoid
// degenerate zero-width windows; the operator's own min (e.g. 2 for stddev)
// further raises the floor where it matters.
function stepsFor(windowMs, delta) {
  return Math.max(1, Math.round(windowMs / delta))
}

// Walks `series` with a window of `n` points (inclusive), calling
// `reduce(slice)` per point. Empties the leading `n - 1` points so the
// caller's output is uncontaminated by partial windows.
function windowedReduce(series, n, reduce) {
  var out = new Array(series.length)
  for (var i = 0; i < series.length; i++) {
    if (i < n - 1) { out[i] = empty(series[i].ts); continue }
    var slice = series.slice(i - n + 1, i + 1)
    var v = reduce(slice)
    out[i] = v == null ? empty(series[i].ts) : { ts: series[i].ts, value: v }
  }
  return out
}
