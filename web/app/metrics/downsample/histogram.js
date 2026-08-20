var sample = require('./sample')
  , KEYS   = ["count", "mean", "m2", "max", "std_dev"]

/// Downsample a histogram series by combining per-bucket stats using Chan's
/// pairwise parallel-variance algorithm. The pre-Phase-1 downsampler averaged
/// every field across buckets, which was correct only for `count` and `max`
/// (sum and max) and silently wrong for `mean`, `std_dev`, and every
/// percentile. Percentiles are no longer derived here — for delta > minLevel
/// the loader sources them from the `@llq` companion series instead.
///
/// Per-point shape consumed: {ts, count, mean, [m2 | std_dev], max}
/// Per-point shape produced: {ts, count, mean, m2, max, std_dev}
///
/// Legacy points written before Phase 1 carry `std_dev` but no `m2`. For
/// per-minute (un-downsampled) rows the reconstruction `M2 = std_dev² × (n-1)`
/// is exact, because the per-minute std_dev itself comes from Welford's
/// algorithm with Bessel's correction.
///
/// data  - [{ts, count, mean, m2 or std_dev, max}]
/// delta - Integer (milliseconds)
///
/// Returns [{ts, count, mean, m2, max, std_dev}]
var H =
module.exports = function(data, delta) {
  return sample(data, delta, initPoint, combine, post)
}

H.KEYS = KEYS

function initPoint(ts) {
  return { ts:    ts
         , count: 0
         , mean:  0
         , m2:    0
         , max:   null
         }
}

// Chan's pairwise update — exact and additive at any zoom level.
//
//   combined_count = n_A + n_B
//   delta_m        = mean_B - mean_A
//   combined_mean  = mean_A + delta_m * n_B / combined_count
//   combined_M2    = M2_A + M2_B + delta_m² * n_A * n_B / combined_count
//
function combine(ptA, ptB) {
  // First non-empty bucket folds into the (zero-count) seed — copy through to
  // skip Chan's update and dodge the n_A=0 edge.
  if (ptA.count === 0) {
    ptA.count = ptB.count
    ptA.mean  = ptB.mean
    ptA.m2    = m2Of(ptB)
    ptA.max   = ptB.max
    return ptA
  }

  var nA = ptA.count
    , nB = ptB.count
    , n  = nA + nB
    , dm = ptB.mean - ptA.mean

  ptA.count = n
  ptA.mean  = ptA.mean + dm * nB / n
  ptA.m2    = ptA.m2 + m2Of(ptB) + dm * dm * nA * nB / n
  ptA.max   = ptA.max == null ? ptB.max
            : ptB.max == null ? ptA.max
            : Math.max(ptA.max, ptB.max)
  return ptA
}

function post(point) {
  point.std_dev = point.count > 1 ? Math.sqrt(point.m2 / (point.count - 1)) : 0
  if (point.max == null) point.max = 0
  return point
}

// Recover M2 from a legacy point. Exact for per-minute rows; for a row that
// was itself produced by the pre-Phase-1 downsampler the std_dev is already
// wrong, so the recovery is wrong too — but those would only appear if a
// pre-Phase-1 cache write is still being read.
function m2Of(pt) {
  if (pt.m2 != null) return pt.m2
  if (pt.std_dev == null || pt.count <= 1) return 0
  return pt.std_dev * pt.std_dev * (pt.count - 1)
}
