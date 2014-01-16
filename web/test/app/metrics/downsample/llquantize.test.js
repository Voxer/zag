var test       = require('tap').test
  , llquantize = require('../../../../app/metrics/downsample/llquantize')

test("rollup", function(t) {
  t.deepEquals(
    llquantize(
      [ {ts: 0, data: {1: 4}}
      , {ts: 1, data: {1: 2}}
      , {ts: 2, data: {1: 3, 2: 3}}
      , {ts: 3, data: {2: 5}}
      , {ts: 4, data: {3: 10}}
      , {ts: 5, data: {}}
      ], 3)
    , [ {ts: 0, data: {1: 9, 2: 3}}
      , {ts: 3, data: {2: 5, 3: 10}}
      ])
  t.end()
})

test("rollup empty", function(t) {
  t.deepEquals(llquantize([], 5), [])
  t.end()
})
