var test    = require('tap').test
  , counter = require('../../../../app/metrics/downsample/counter')

test("rollup", function(t) {
  t.deepEquals(
    counter(
      [ {ts: 0, count: 2}
      , {ts: 1, count: 4}
      , {ts: 2, count: 6}
      ], 3)
    , [ {ts: 0, count: 12}
      ])
  t.deepEquals(
    counter(
      [ {ts: 0, count: 2}
      , {ts: 1, count: 4}
      , {ts: 2, count: 6}
      , {ts: 3, count: 8}
      , {ts: 4, count: 10}
      , {ts: 5, count: 12}
      ], 3)
    , [ {ts: 0, count: 12}
      , {ts: 3, count: 30}
      ])
  t.end()
})

test("rollup empty", function(t) {
  t.deepEquals(counter([], 5), [])
  t.end()
})

test("rollup with gaps", function(t) {
  // missing beginning of interval
  t.deepEquals(
    counter(
      [ {ts: 1, count: 4}
      , {ts: 2, count: 6}
      , {ts: 3, count: 8}
      , {ts: 4, count: 10}
      , {ts: 5, count: 12}
      ], 3)
    , [ {ts: 0, count: 10}
      , {ts: 3, count: 30}
      ])
  // missing middle of interval
  t.deepEquals(
    counter(
      [ {ts: 0, count: 2}
      , {ts: 2, count: 6}
      , {ts: 3, count: 8}
      , {ts: 4, count: 10}
      , {ts: 5, count: 12}
      ], 3)
    , [ {ts: 0, count: 8}
      , {ts: 3, count: 30}
      ])
  // missing end of interval
  t.deepEquals(
    counter(
      [ {ts: 0, count: 2}
      , {ts: 1, count: 4}
      , {ts: 3, count: 8}
      , {ts: 4, count: 10}
      , {ts: 5, count: 12}
      ], 3)
    , [ {ts: 0, count: 6}
      , {ts: 3, count: 30}
      ])
  // skip whole interval
  t.deepEquals(
    counter(
      [ {ts: 0, count: 2}
      , {ts: 1, count: 4}
      , {ts: 2, count: 6}
      , {ts: 6, count: 14}
      , {ts: 7, count: 16}
      , {ts: 8, count: 18}
      ], 3)
    , [ {ts: 0, count: 12}
      , {ts: 6, count: 48}
      ])
  t.end()
})

test("rollup delta=1", function(t) {
  var points =
    [ {ts: 0, count: 2}
    , {ts: 1, count: 4}
    , {ts: 2, count: 6}
    , {ts: 6, count: 14}
    , {ts: 7, count: 16}
    , {ts: 8, count: 18}
    ]
  t.deepEquals(counter(points, 1), points)
  t.end()
})

test("rollup empty:true", function(t) {
  // Partial
  t.deepEquals(
    counter(
      [ {ts: 0, count: 4}
      , {ts: 1, empty: true}
      ], 2)
    , [ {ts: 0, count: 4}
      ])
  t.deepEquals(
    counter(
      [ {ts: 0, empty: true}
      , {ts: 1, count: 4}
      ], 2)
    , [ {ts: 0, count: 4}
      ])
  // Total
  t.deepEquals(
    counter(
      [ {ts: 0, empty: true}
      , {ts: 1, empty: true}
      ], 2)
    , [ {ts: 0, empty: true}
      ])
  t.end()
})
