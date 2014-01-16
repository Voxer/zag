var test      = require('tap').test
  , DeltaList = require('../../lib/aggregator/delta-list')
  , MIN       = 60000

test("DeltaList", function(t) {
  var dl = new DeltaList(MIN)
  t.deepEquals(dl.deltas, {})
  t.equals(dl.defaultI, MIN)
  t.deepEquals(dl.defaultList, [MIN])
  t.end()
})

test("DeltaList#get", function(t) {
  var dl = new DeltaList(MIN)
  t.equals(dl.get("foo"), dl.defaultList)
  dl.add("foo", 5)
  t.deepEquals(dl.get("foo"), [MIN, 5])
  t.end()
})

test("DeltaList#add", function(t) {
  var dl = new DeltaList(MIN)
  dl.add("foo", 5)
  dl.add("foo", 5) // add duplicate is a noop
  dl.add("foo", 6)
  t.deepEquals(dl.deltas, {foo: [MIN, 5, 6]})
  t.end()
})

test("DeltaList#remove", function(t) {
  var dl = new DeltaList(MIN)
  dl.add("foo", 5)
  dl.add("foo", 6)
  dl.add("foo", 7)
  dl.remove("foo", 6)
  t.deepEquals(dl.deltas, {foo: [MIN, 5, 7]})

  dl.remove("foo", 7)
  dl.remove("foo", MIN) // cant remove the default
  dl.remove("foo", 1000) // remove a bogus delta
  t.deepEquals(dl.deltas, {foo: [MIN, 5]})

  dl.remove("foo", 5) // remove the last one
  dl.remove("bar", 1000) // remove a bogus delta (2)
  t.deepEquals(dl.deltas, {})
  t.end()
})

test("DeltaList#size", function(t) {
  var dl = new DeltaList(MIN)
  t.equals(dl.size(), 0)

  dl.add("foo", 5)
  t.equals(dl.size(), 1)
  dl.add("foo", 6)
  t.equals(dl.size(), 1)

  dl.add("bar", 5)
  t.equals(dl.size(), 2)
  dl.remove("bar", 5)
  t.equals(dl.size(), 1)

  t.end()
})
