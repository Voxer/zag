var test      = require('tap').test
  , histogram = require('../../../../app/metrics/downsample/histogram')
  , makePoint = require('../helpers').makeHistogram

// Chan's parallel-variance pairwise update is exact, so combining the
// per-minute points for a uniform population always produces the same totals
// as a single-bucket aggregation over the same samples.

test("rollup uniform-mean buckets", function(t) {
  // Three buckets, all mean=5, varied counts, m2=0.
  // Combined: count = 9+8+7 = 24; mean = 5; m2 = 0; std_dev = 0; max = 5.
  t.deepEquals(
    histogram(
      [ makePoint(0, 9, 5)
      , makePoint(1, 8, 5)
      , makePoint(2, 7, 5)
      ], 3)
    , [ { ts: 0, count: 24, mean: 5, m2: 0, max: 5, std_dev: 0 }
      ])
  t.end()
})

test("rollup pools the variance", function(t) {
  // (count=3, mean=4, m2=0) + (count=1, mean=8, m2=0):
  //   n=4, dm=4, mean = 4 + 4*1/4 = 5
  //   m2  = 0 + 0 + 4² * 3*1 / 4 = 12
  //   std_dev = sqrt(12 / 3) = 2  (Bessel)
  t.deepEquals(
    histogram(
      [ makePoint(0, 3, 4)
      , makePoint(1, 1, 8)
      ], 2)
    , [ { ts: 0, count: 4, mean: 5, m2: 12, max: 8, std_dev: 2 }
      ])
  t.end()
})

test("rollup additive across three buckets", function(t) {
  // Same total population split three ways must give the same answer as
  // when split two ways. Underlying samples: {4,4,4,8,8,8} — n=6, mean=6,
  // m2 = 6*4 = 24, sample variance = 24/5 = 4.8, std_dev = sqrt(4.8).
  var bucketed3 = histogram(
    [ makePoint(0, 2, 4)
    , makePoint(1, 2, 6)  // synthetic; together with the others this is just a re-partition
    , makePoint(2, 2, 8)
    ], 3)
  // Sanity-check: 2 samples at 4, 2 at 6, 2 at 8 → mean=6, m2 = 2*4 + 0 + 2*4 = 16,
  // std_dev = sqrt(16/5) = sqrt(3.2). Chan via folds:
  //   fold1: n=4, dm=2, mean=4+2*2/4=5, m2=0+0+4*2*2/4=4
  //   fold2: n=6, dm=8-5=3, mean=5+3*2/6=6, m2=4+0+9*4*2/6=4+12=16  ✓
  t.equals(bucketed3[0].count, 6)
  t.equals(bucketed3[0].mean, 6)
  t.equals(bucketed3[0].m2, 16)
  t.equals(bucketed3[0].max, 8)
  t.equals(bucketed3[0].std_dev, Math.sqrt(16 / 5))
  t.end()
})

test("rollup empty", function(t) {
  t.deepEquals(histogram([], 5), [])
  t.end()
})

test("rollup gap (one bucket missing in window)", function(t) {
  // Only ts=0 and ts=2 fall in the same delta-3 bucket; both uniform.
  t.deepEquals(
    histogram(
      [ makePoint(0, 9, 5)
      , makePoint(2, 7, 5)
      ], 3)
    , [ { ts: 0, count: 16, mean: 5, m2: 0, max: 5, std_dev: 0 }
      ])
  t.end()
})

test("rollup delta=1 passes through (with std_dev derived)", function(t) {
  // sample.js still runs combine for single-point buckets, which folds the
  // point into the zero-count seed and then post() derives std_dev.
  t.deepEquals(
    histogram([makePoint(0, 4, 5, {m2: 12})], 1)
    , [ { ts: 0, count: 4, mean: 5, m2: 12, max: 5, std_dev: 2 }
      ])
  t.end()
})

test("rollup empty:true", function(t) {
  var hist = makePoint(0, 4, 2, {m2: 0})
  var expected = { ts: 0, count: 4, mean: 2, m2: 0, max: 2, std_dev: 0 }
  // Partial
  t.deepEquals(
    histogram([hist, {ts: 1, empty: true}], 2), [expected])
  t.deepEquals(
    histogram([{ts: 0, empty: true}, hist ], 2) , [expected])
  // Total
  t.deepEquals(
    histogram([{ts: 0, empty: true}, {ts: 1, empty: true}], 2), [{ts: 0, empty: true}])
  t.end()
})

test("rollup falls back to std_dev when m2 absent (legacy rows)", function(t) {
  // Per-minute legacy rows: m2 ≈ std_dev² × (count-1). Two identical rows
  // each with count=5, mean=10, std_dev=2 ⇒ per-row m2 = 4*4 = 16.
  // Combined: n=10, dm=0, mean=10, m2 = 16+16+0 = 32, std_dev = sqrt(32/9).
  var legacyA = {ts: 0, count: 5, mean: 10, std_dev: 2, max: 14}
  var legacyB = {ts: 1, count: 5, mean: 10, std_dev: 2, max: 12}
  t.deepEquals(
    histogram([legacyA, legacyB], 2)
    , [ { ts: 0, count: 10, mean: 10, m2: 32, max: 14, std_dev: Math.sqrt(32/9) }
      ])
  t.end()
})
