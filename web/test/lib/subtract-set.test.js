var test = require('tap').test
  , diff = require('../../lib/subtract-set')

test("subtract-set", function(t) {
  t.deepEquals(diff([], []), [])
  t.deepEquals(diff([], ["a"]), [])
  t.deepEquals(diff(["a"], []), ["a"])

  t.deepEquals(diff(
    ["a", "b", "c"],
    ["a", "b", "d"]),
    ["c"])
  t.end()
})
