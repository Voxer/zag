var test                = require('tap').test
  , merge               = require('../../../app/metrics/llq-percentiles')
  , walk                = merge.walk

test("walk: empty table", function(t) {
  t.equals(walk({}), null)
  t.end()
})

test("walk: all-zero frequencies", function(t) {
  t.equals(walk({1: 0, 2: 0}), null)
  t.end()
})

test("walk: single bucket", function(t) {
  // Every quantile collapses to the only bucket.
  t.deepEquals(walk({42: 1000}),
    { 0.10: 42, 0.50: 42, 0.75: 42, 0.95: 42, 0.99: 42 })
  t.end()
})

test("walk: two buckets, picks cumulative threshold", function(t) {
  // total = 100; thresholds 10, 50, 75, 95, 99.
  // Bucket 1 cum = 90 (>= all but the last two); bucket 2 cum = 100.
  t.deepEquals(walk({1: 90, 2: 10}),
    { 0.10: 1, 0.50: 1, 0.75: 1, 0.95: 2, 0.99: 2 })
  t.end()
})

test("walk: tail-heavy distribution", function(t) {
  // total = 100; bucket 1 cum=50, bucket 10 cum=95, bucket 100 cum=100.
  // p10 → 1 (cum 50 >= 10), p50 → 1, p75 → 10 (cum 95 >= 75),
  // p95 → 10 (cum 95 >= 95), p99 → 100.
  t.deepEquals(walk({1: 50, 10: 45, 100: 5}),
    { 0.10: 1, 0.50: 1, 0.75: 10, 0.95: 10, 0.99: 100 })
  t.end()
})

test("walk: numeric-string keys sort numerically not lexically", function(t) {
  // The buckets come back as object keys (strings); naive sort puts "10"
  // before "2". Verify the walk parses and orders numerically.
  t.deepEquals(walk({"2": 1, "10": 1, "100": 1}),
    // total=3; cumulative 1, 2, 3 — thresholds 0.3, 1.5, 2.25, 2.85, 2.97.
    { 0.10: 2, 0.50: 10, 0.75: 100, 0.95: 100, 0.99: 100 })
  t.end()
})

test("merge: patches histogram points by ts", function(t) {
  var hist =
    [ { ts: 0, count: 5,  mean: 1, m2: 0, max: 1, std_dev: 0 }
    , { ts: 1, count: 10, mean: 5, m2: 0, max: 5, std_dev: 0 }
    ]
  var llq =
    [ { ts: 0, data: {1: 5} }
    , { ts: 1, data: {2: 5, 8: 5} }
    ]
  merge(hist, llq)
  t.equals(hist[0].p95, 1)
  t.equals(hist[1].p95, 8)
  t.equals(hist[1].median, 2)  // cum=5 of 10 ⇒ first bucket reaches 50%
  t.end()
})

test("merge: skips when LLQ entry missing or empty", function(t) {
  var hist =
    [ { ts: 0, count: 5, mean: 1, m2: 0, max: 1, std_dev: 0 }
    , { ts: 1, count: 5, mean: 5, m2: 0, max: 5, std_dev: 0 }
    , { ts: 2, count: 5, mean: 7, m2: 0, max: 7, std_dev: 0 }
    ]
  var llq =
    [ { ts: 0, data: {1: 5} }
    , { ts: 1, empty: true }
    // ts=2 missing entirely
    ]
  merge(hist, llq)
  t.equals(hist[0].p95, 1)
  t.equals(hist[1].p95, undefined)
  t.equals(hist[2].p95, undefined)
  t.end()
})

test("merge: skips empty histogram points", function(t) {
  var hist =
    [ { ts: 0, empty: true }
    , { ts: 1, count: 5, mean: 5, m2: 0, max: 5, std_dev: 0 }
    ]
  var llq =
    [ { ts: 0, data: {1: 5} }
    , { ts: 1, data: {5: 5} }
    ]
  merge(hist, llq)
  t.equals(hist[0].empty, true)
  t.equals(hist[0].p95, undefined)
  t.equals(hist[1].p95, 5)
  t.end()
})

test("LLQ-derived p95 across N minutes matches the union p95", function(t) {
  // The whole reason percentiles moved to LLQ: summing per-minute frequency
  // tables and walking the union recovers the true population p95, which is
  // unrecoverable from scalar per-minute p95s alone.
  //
  // Construct: 10 minutes of data, each minute has 100 samples at value 10
  // (bucket=10, freq=100). Per-minute p95 = 10 for every minute, average = 10.
  // Now inject one minute with 100 samples at 1000 — true p95 of the union
  // is much higher; the LLQ walk should reflect that.
  var minutes = []
  for (var i = 0; i < 9; i++) minutes.push({ts: i, data: {10: 100}})
  minutes.push({ts: 9, data: {1000: 100}})

  var unionTable = {}
  for (var j = 0; j < minutes.length; j++) {
    var d = minutes[j].data
    for (var k in d) unionTable[k] = (unionTable[k] || 0) + d[k]
  }
  // unionTable = {10: 900, 1000: 100} — total 1000, p95 threshold 950,
  // cum at 10 = 900 (< 950), cum at 1000 = 1000 (>= 950) ⇒ p95 = 1000.
  var qs = walk(unionTable)
  t.equals(qs[0.95], 1000)
  t.equals(qs[0.50], 10)
  t.equals(qs[0.99], 1000)
  t.end()
})
