var test = require('tap').test
  , sort = require('../../lib/sort')

test("sort", function(t) {
  t.deepEquals(sort([]), [])
  t.deepEquals(sort([1]), [1])

  t.deepEquals(sort([1, 2]), [1, 2])
  t.deepEquals(sort([2, 1]), [1, 2])

  t.deepEquals(sort([1, 2, 3]), [1, 2, 3])
  t.deepEquals(sort([1, 3, 2]), [1, 2, 3])
  t.deepEquals(sort([3, 1, 2]), [1, 2, 3])
  t.deepEquals(sort([3, 2, 1]), [1, 2, 3])

  t.deepEquals(sort([4, 3, 2, 1]), [1, 2, 3, 4])
  t.deepEquals(sort([1, 2, 3, 4]), [1, 2, 3, 4])

  t.deepEquals(sort([2, 1, 1, 2]), [1, 1, 2, 2])
  t.deepEquals(sort([2, 1, 2, 1]), [1, 1, 2, 2])

  t.end()
})
