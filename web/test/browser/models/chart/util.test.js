var test = require('tap').test
  , util = require('../../../../client/js/models/chart/util')

test("applySubKeys", function(t) {
  var apply = util.applySubKeys
  t.deepEquals(apply("foo", []), [])
  t.deepEquals(apply("foo", ["mean"]), ["foo@mean"])
  t.deepEquals(apply("foo", ["mean", "median"]), ["foo@mean", "foo@median"])
  t.end()
})

test("same", function(t) {
  var same = util.same
  t.equals(same([], []), true)
  t.equals(same(["a"], ["a"]), true)
  t.equals(same(["a", "b"], ["a", "b"]), true)
  t.equals(same(["a", "b"], ["b", "a"]), false)
  t.equals(same(["a", "b"], ["a", "c"]), false)
  t.end()
})

test("sameSorted", function(t) {
  var same = util.sameSorted
  t.equals(same([], []), true)
  t.equals(same(["a"], ["a"]), true)
  t.equals(same(["a", "b"], ["a", "b"]), true)
  t.equals(same(["a", "b"], ["b", "a"]), true)
  t.equals(same(["a", "b"], ["a", "c"]), false)
  t.end()
})
