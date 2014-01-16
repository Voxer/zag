var test      = require('tap').test
  , histogram = require('../../../../app/metrics/downsample/histogram')
  , makePoint = require('../helpers').makeHistogram

test("rollup", function(t) {
  t.deepEquals(
    histogram(
      [ makePoint(0, 0, 2)
      , makePoint(1, 4, 3)
      , makePoint(2, 2, 6)
      ], 3)
    , [ makePoint(0, 2, 11, 4)
      ])
  t.end()
})

test("rollup empty", function(t) {
  t.deepEquals(histogram([], 5), [])
  t.end()
})

test("rollup gap", function(t) {
  t.deepEquals(
    histogram(
      [ makePoint(0, 0, 2)
      , makePoint(2, 2, 6)
      ], 3)
    , [ makePoint(0, 1, 8, 2)
      ])
  t.end()
})

test("rollup delta=1", function(t) {
  var points =
    [ makePoint(0, 0, 2)
    , makePoint(1, 4, 3)
    , makePoint(2, 2, 6)
    ]
  t.deepEquals(histogram(points, 1), points)
  t.end()
})

test("rollup empty:true", function(t) {
  var hist = makePoint(0, 4, 2)
  // Partial
  t.deepEquals(
    histogram([hist, {ts: 1, empty: true}], 2), [hist])
  t.deepEquals(
    histogram([{ts: 0, empty: true}, hist ], 2) , [hist])
  // Total
  t.deepEquals(
    histogram([{ts: 0, empty: true}, {ts: 1, empty: true}], 2), [{ts: 0, empty: true}])
  t.end()
})
