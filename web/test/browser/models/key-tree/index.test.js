var test    = require('tap').test
  , KeyTree = require('../../../../client/js/models/key-tree')
  , MockAPI = require('./api.mock')

test("KeyTree#load root", function(t) {
  var kt = new KeyTree(new MockAPI())
  kt.load(null, function(fail, leafs) {
    if (fail) throw fail
    t.ok(leafs)
    t.end()
  })
})

test("KeyTree#loadOne top", function(t) {
  test("top", function(t) {
    var db = {"": [{key: "a", type: "counter"}]}
      , kt = new KeyTree(new MockAPI(db))
    kt.loadOne("a", function(fail, leaf) {
      if (fail) throw fail
      t.equals(leaf.key, "a")
      t.equals(leaf.type, "counter")
      t.end()
    })
  })

  test("deep", function(t) {
    var db = {"a": [{key: "a|b", type: "counter"}]}
      , kt = new KeyTree(new MockAPI(db))
    kt.loadOne("a|b", function(fail, leaf) {
      if (fail) throw fail
      t.equals(leaf.key, "a|b")
      t.equals(leaf.type, "counter")
      t.end()
    })
  })

  t.end()
})
