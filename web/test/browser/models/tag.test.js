var test = require('tap').test
  , Tag  = require('../../../client/js/models/tag')

test("Tag.sortedIndex", function(t) {
  var S     = Tag.sortedIndex
    , items = [{a: 1}, {a: 3}, {a: 4}]
  t.equals(S(items, {a: -1}, "a"), 0)
  t.equals(S(items, {a: 0}, "a"), 0)
  t.equals(S(items, {a: 1}, "a"), 0)
  t.equals(S(items, {a: 2}, "a"), 1)
  t.equals(S(items, {a: 3}, "a"), 1)
  t.equals(S(items, {a: 4}, "a"), 2)
  t.equals(S(items, {a: 5}, "a"), 3)
  t.equals(S(items, {a: 6}, "a"), 3)
  t.end()
})
