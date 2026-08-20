var QUANTILES =
  [ { q: 0.10, field: "p10"    }
  , { q: 0.50, field: "median" }
  , { q: 0.75, field: "p75"    }
  , { q: 0.95, field: "p95"    }
  , { q: 0.99, field: "p99"    }
  ]

module.exports        = mergeLLQPercentiles
module.exports.walk   = walk
module.exports.QUANTILES = QUANTILES

/// Patch histogram points with percentiles derived from the matching LLQ
/// frequency tables. Both arrays are assumed ordered by `ts` (true after
/// Interval.fill in the loader). Points without a matching LLQ entry are
/// left untouched.
///
/// histPoints - [{ts, count, mean, m2, max, std_dev, ...}]
/// llqPoints  - [{ts, data: {bucket: freq, ...}} or {ts, empty: true}]
///
function mergeLLQPercentiles(histPoints, llqPoints) {
  var llqByTs = {}
  for (var i = 0; i < llqPoints.length; i++) {
    var p = llqPoints[i]
    if (p && !p.empty && p.data) llqByTs[p.ts] = p.data
  }
  for (var j = 0; j < histPoints.length; j++) {
    var hp = histPoints[j]
    if (!hp || hp.empty) continue
    var table = llqByTs[hp.ts]
    if (!table) continue
    var qs = walk(table)
    if (!qs) continue
    for (var k = 0; k < QUANTILES.length; k++) {
      var entry = QUANTILES[k]
      hp[entry.field] = qs[entry.q]
    }
  }
  return histPoints
}

/// Walk a frequency table to extract percentile estimates. Each percentile
/// is the bucket value at which the cumulative frequency first meets or
/// exceeds q × total — same convention as Prometheus `histogram_quantile`.
///
/// table - {bucket: freq, ...}
///
/// Returns {0.1: val, 0.5: val, 0.75: val, 0.95: val, 0.99: val} or null
/// when the table is empty / all-zero.
///
function walk(table) {
  var keys = Object.keys(table)
  if (keys.length === 0) return null

  var buckets = []
    , total   = 0
  for (var i = 0; i < keys.length; i++) {
    var b = +keys[i]
      , f = table[keys[i]]
    if (f > 0) {
      buckets.push(b)
      total += f
    }
  }
  if (total === 0) return null
  buckets.sort(asc)

  var result = {}
    , qi     = 0
    , cum    = 0
  for (var b2 = 0; b2 < buckets.length && qi < QUANTILES.length; b2++) {
    cum += table[buckets[b2]]
    while (qi < QUANTILES.length && cum >= QUANTILES[qi].q * total) {
      result[QUANTILES[qi].q] = buckets[b2]
      qi++
    }
  }
  // Any quantile not yet assigned (floating-point edge at q=1.0) gets the
  // top bucket.
  var lastBucket = buckets[buckets.length - 1]
  while (qi < QUANTILES.length) {
    result[QUANTILES[qi].q] = lastBucket
    qi++
  }
  return result
}

function asc(a, b) { return a - b }
