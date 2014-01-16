var test      = require('tap').test
  , flat      = require('../../../app/metrics/flatten-llq')
  , makeEmpty = require('./helpers').makeEmpty

test("flattenLLQ", function(t) {
  // Empty
  t.deepEquals(flat([]), [])

  // 1 point.
  t.deepEquals(flat([{ts: 1, data: {}}]), [[1]])
  t.deepEquals(flat([{ts: 1, data: {2: 3}}]), [[1, 2, 3]])
  t.deepEquals(flat([{ts: 1, data: {2: 3, 4: 5}}]), [[1, 2, 3, 4, 5]])
  t.deepEquals(flat([{ts: 1, data: {88: 2, 9: 1}}]), [[1, 9, 1, 88 ,2]])

  // Multiple points.
  t.deepEquals(flat(
    [ {ts: 1, data: {2: 3}}
    , {ts: 2, data: {4: 5}}
    ]), [[1, 2, 3], [2, 4, 5]])
  t.deepEquals(flat(
    [ {ts: 1, data: {2: 3}}
    , makeEmpty(2)
    ]), [[1, 2, 3], [2]])

  // Out of order buckets.
  // > {4: 3, 1: 5}
  // { '1': 5, '4': 3 }
  // > {4: 3, 1.5: 5}
  // { '4': 3, '1.5': 5 }
  t.deepEquals(flat(
    [ {ts: 1, data: {4: 3, 1.5: 5}}
    ]), [[1, 1.5, 5, 4, 3]])
  t.end()
})
