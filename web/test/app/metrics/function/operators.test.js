var test = require('tap').test
  , ops  = require('../../../../app/metrics/function/operators')

function pt(ts, value) { return { ts: ts, value: value } }
function mt(ts) { return { ts: ts, empty: true } }

////////////////////////////////////////////////////////////////////////////////
// rate
////////////////////////////////////////////////////////////////////////////////

test("rate: simple slope", function(t) {
  // Counter that goes 0, 60, 120, 180 over 1m steps ⇒ 1 per second = 0.001/ms.
  t.deepEquals(
    ops.rate([pt(0, 0), pt(60000, 60), pt(120000, 120), pt(180000, 180)], 60000),
    [ mt(0)
    , pt(60000,  0.001)
    , pt(120000, 0.001)
    , pt(180000, 0.001)
    ])
  t.end()
})

test("rate: first point is always empty (no predecessor)", function(t) {
  var out = ops.rate([pt(0, 100), pt(60000, 200)], 60000)
  t.equals(out[0].empty, true)
  t.equals(out[1].value, 100 / 60000)
  t.end()
})

test("rate: empty inputs propagate to neighbors", function(t) {
  var out = ops.rate([pt(0, 0), mt(60000), pt(120000, 200)], 60000)
  t.equals(out[1].empty, true) // empty input
  t.equals(out[2].empty, true) // prev was empty
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// delta
////////////////////////////////////////////////////////////////////////////////

test("delta: window=delta is same as discrete diff", function(t) {
  // window = 60000 (1 step) ⇒ N = 1 ⇒ v[i] - v[i-1].
  var out = ops.delta([pt(0, 5), pt(60000, 8), pt(120000, 12)], 60000, 60000)
  t.equals(out[0].empty, true)
  t.equals(out[1].value, 3)
  t.equals(out[2].value, 4)
  t.end()
})

test("delta: window=3 steps", function(t) {
  // delta=60000, window=180000 ⇒ N=3. Points before index 3 are empty.
  var s = [pt(0, 0), pt(60000, 1), pt(120000, 3), pt(180000, 6), pt(240000, 10)]
  var out = ops.delta(s, 180000, 60000)
  t.equals(out[0].empty, true)
  t.equals(out[1].empty, true)
  t.equals(out[2].empty, true)
  t.equals(out[3].value, 6)   // 6 - 0
  t.equals(out[4].value, 9)   // 10 - 1
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// rolling_mean
////////////////////////////////////////////////////////////////////////////////

test("rolling_mean: window=1 returns the series unchanged (modulo shape)", function(t) {
  var out = ops.rolling_mean([pt(0, 4), pt(1, 8)], 1, 1)
  t.equals(out[0].value, 4)
  t.equals(out[1].value, 8)
  t.end()
})

test("rolling_mean: window=3", function(t) {
  // Values: 2, 4, 6, 8, 10. Means over last 3:
  //   i=0: empty (partial), i=1: empty, i=2: (2+4+6)/3 = 4, i=3: (4+6+8)/3 = 6, i=4: (6+8+10)/3 = 8.
  var s = [pt(0, 2), pt(1, 4), pt(2, 6), pt(3, 8), pt(4, 10)]
  var out = ops.rolling_mean(s, 3, 1)
  t.equals(out[0].empty, true)
  t.equals(out[1].empty, true)
  t.equals(out[2].value, 4)
  t.equals(out[3].value, 6)
  t.equals(out[4].value, 8)
  t.end()
})

test("rolling_mean: empties within window are skipped, not zero-filled", function(t) {
  var s = [pt(0, 4), mt(1), pt(2, 6)]
  // Window=3 ⇒ mean of (4, _, 6) = (4+6)/2 = 5.
  var out = ops.rolling_mean(s, 3, 1)
  t.equals(out[2].value, 5)
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// rolling_sum
////////////////////////////////////////////////////////////////////////////////

test("rolling_sum: window=3", function(t) {
  // Values 2, 4, 6, 8, 10. Sums over last 3:
  //   i=0,1: empty (partial), i=2: 2+4+6=12, i=3: 4+6+8=18, i=4: 6+8+10=24.
  var s = [pt(0, 2), pt(1, 4), pt(2, 6), pt(3, 8), pt(4, 10)]
  var out = ops.rolling_sum(s, 3, 1)
  t.equals(out[0].empty, true)
  t.equals(out[1].empty, true)
  t.equals(out[2].value, 12)
  t.equals(out[3].value, 18)
  t.equals(out[4].value, 24)
  t.end()
})

test("rolling_sum: empties within a filled window are skipped (summed as absent)", function(t) {
  var s = [pt(0, 4), mt(1), pt(2, 6)]
  // Window=3 ⇒ 4 + _ + 6 = 10.
  var out = ops.rolling_sum(s, 3, 1)
  t.equals(out[2].value, 10)
  t.end()
})

test("rolling_sum: a FILLED all-empty window is 0, not empty (unlike rolling_mean)", function(t) {
  // This is the whole point of the operator: a counter with no events in the
  // window is a real zero, so ratio(rolling_sum(fail), rolling_sum(success))
  // can read a success-blackout as 100% rather than collapsing to empty/OK.
  var s = [mt(0), mt(1), mt(2)]
  t.equals(ops.rolling_sum(s, 3, 1)[2].value, 0)   // filled window, no data ⇒ 0
  t.equals(ops.rolling_mean(s, 3, 1)[2].empty, true) // mean of nothing is undefined
  t.equals(ops.rolling_sum(s, 3, 1)[0].empty, true)  // leading N-1 still empty
  t.end()
})

test("rolling_sum: ratio(rolling_sum,...) is the volume-weighted rate, not the mean-ratio", function(t) {
  // Sparse fail (1 event), dense success (9/min ×3). Volume rate = 1/(1+27).
  var fail = [pt(0, 1), mt(1), mt(2)]
  var succ = [pt(0, 9), pt(1, 9), pt(2, 9)]
  var volRate = ops.ratio(ops.rolling_sum(fail, 3, 1), ops.rolling_sum(succ, 3, 1))
  t.ok(Math.abs(volRate[2].value - 1 / 28) < 1e-9, "sum-ratio = 1/(1+27)")
  // Contrast: the mean-ratio inflates it (meanFail=1, meanSucc=9 ⇒ 1/10).
  var meanRate = ops.ratio(ops.rolling_mean(fail, 3, 1), ops.rolling_mean(succ, 3, 1))
  t.equals(meanRate[2].value, 0.1)
  t.ok(volRate[2].value < meanRate[2].value, "sum-ratio < mean-ratio for sparse fail")
  t.end()
})

test("rolling_sum: success-blackout reads as 100%, not empty", function(t) {
  // Fails continuing, success stopped entirely across the window.
  var fail = [pt(0, 1), pt(1, 1), pt(2, 1)]
  var succ = [mt(0), mt(1), mt(2)]
  var volRate  = ops.ratio(ops.rolling_sum(fail, 3, 1),  ops.rolling_sum(succ, 3, 1))
  var meanRate = ops.ratio(ops.rolling_mean(fail, 3, 1), ops.rolling_mean(succ, 3, 1))
  t.equals(volRate[2].value, 1)     // 3/(3+0) = 100% ⇒ alert fires
  t.equals(meanRate[2].empty, true) // mean-ratio collapses to empty ⇒ reads OK
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// rolling_stddev
////////////////////////////////////////////////////////////////////////////////

test("rolling_stddev: window=3, known values", function(t) {
  // Values 1, 2, 3, 4, 5. At i=2, slice is (1,2,3): mean=2, ss=(1+0+1)=2,
  // sample stddev = sqrt(2/2) = 1. At i=3 slice (2,3,4): stddev = 1.
  var s = [pt(0, 1), pt(1, 2), pt(2, 3), pt(3, 4), pt(4, 5)]
  var out = ops.rolling_stddev(s, 3, 1)
  t.equals(out[0].empty, true)
  t.equals(out[1].empty, true)
  t.equals(out[2].value, 1)
  t.equals(out[3].value, 1)
  t.equals(out[4].value, 1)
  t.end()
})

test("rolling_stddev: floors n at 2", function(t) {
  // Even with window=1, need ≥2 samples for sample stddev.
  var s = [pt(0, 5), pt(1, 5)]
  var out = ops.rolling_stddev(s, 1, 1)
  t.equals(out[0].empty, true) // can't get 2 samples yet
  t.equals(out[1].value, 0)    // (5,5) ⇒ stddev 0
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// zscore
////////////////////////////////////////////////////////////////////////////////

test("zscore: window=3, spike vs flat baseline", function(t) {
  // 10, 10, 10, 10, 50: at i=2 the window is all 10s (stddev=0 ⇒ empty).
  // At i=4 the window is (10, 10, 50): mean=70/3≈23.33,
  // stddev=sqrt(((10-23.33)²·2 + (50-23.33)²)/2) ≈ sqrt(533.33) ≈ 23.09,
  // zscore = (50 - 23.33) / 23.09 ≈ 1.155.
  var s = [pt(0, 10), pt(1, 10), pt(2, 10), pt(3, 10), pt(4, 50)]
  var out = ops.zscore(s, 3, 1)
  t.equals(out[2].empty, true) // flat window ⇒ stddev=0 ⇒ empty
  t.equals(out[3].empty, true) // ditto
  t.ok(Math.abs(out[4].value - 1.155) < 0.01, "spike z-score ≈ 1.155")
  t.end()
})

test("zscore: stddev=0 ⇒ empty (not Infinity, not 0)", function(t) {
  // Three identical values ⇒ stddev=0. zscore should be empty.
  var s = [pt(0, 5), pt(1, 5), pt(2, 5)]
  var out = ops.zscore(s, 3, 1)
  t.equals(out[2].empty, true)
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// ratio
////////////////////////////////////////////////////////////////////////////////

test("ratio: simple", function(t) {
  // A=10, B=40 ⇒ 10/50 = 0.2.
  var out = ops.ratio([pt(0, 10)], [pt(0, 40)])
  t.equals(out[0].value, 0.2)
  t.end()
})

test("ratio: 0/0 returns 0 (no traffic ≠ all-error)", function(t) {
  var out = ops.ratio([pt(0, 0)], [pt(0, 0)])
  t.equals(out[0].value, 0)
  t.end()
})

test("ratio: pairs by ts, not by index", function(t) {
  var a = [pt(0, 10), pt(2, 30)]              // gap at ts=1
  var b = [pt(0, 40), pt(1, 999), pt(2, 70)]  // longer
  var out = ops.ratio(a, b)
  t.equals(out[0].value, 10 / 50)
  t.equals(out[1].value, 30 / 100) // pairs with B's ts=2, not B's ts=1
  t.end()
})

test("ratio: empty arms propagate", function(t) {
  var out = ops.ratio([pt(0, 1), mt(1)], [pt(0, 2), pt(1, 3)])
  t.equals(out[1].empty, true)
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// lookback
////////////////////////////////////////////////////////////////////////////////

test("lookback: rate adds one delta", function(t) {
  var ast = { type: "call", op: "rate", args: [{ type: "key", key: "k" }] }
  t.equals(ops.lookback(ast, 60000), 60000)
  t.end()
})

test("lookback: rolling_mean uses its window", function(t) {
  var ast =
    { type: "call", op: "rolling_mean", args:
      [ { type: "key", key: "k" }
      , { type: "number", value: 300000 }
      ]
    }
  t.equals(ops.lookback(ast, 60000), 300000)
  t.end()
})

test("lookback: rolling_sum uses its window", function(t) {
  var ast =
    { type: "call", op: "rolling_sum", args:
      [ { type: "key", key: "k" }
      , { type: "number", value: 1800000 }
      ]
    }
  t.equals(ops.lookback(ast, 60000), 1800000)
  t.end()
})

test("lookback: nested calls stack", function(t) {
  // zscore(rate(k), 300000): rate adds 60000, zscore adds 300000 on top.
  var ast =
    { type: "call", op: "zscore", args:
      [ { type: "call", op: "rate", args: [{ type: "key", key: "k" }] }
      , { type: "number", value: 300000 }
      ]
    }
  t.equals(ops.lookback(ast, 60000), 60000 + 300000)
  t.end()
})

test("lookback: ratio contributes nothing of its own; takes max of children", function(t) {
  var ast =
    { type: "call", op: "ratio", args:
      [ { type: "call", op: "rolling_mean", args:
          [ { type: "key", key: "a" }, { type: "number", value: 180000 } ]
        }
      , { type: "call", op: "rolling_mean", args:
          [ { type: "key", key: "b" }, { type: "number", value: 600000 } ]
        }
      ]
    }
  // ratio itself adds 0; max child lookback is 600000.
  // Wait — current implementation does children + here, where children is the
  // MAX of children. For ratio, here=0, max child=600000 ⇒ 600000.
  t.equals(ops.lookback(ast, 60000), 600000)
  t.end()
})
