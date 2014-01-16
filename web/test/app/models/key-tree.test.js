var test    = require('tap').test
  , KeyTree = require('../../../app/models/key-tree')
  , ROOT    = KeyTree.ROOT

test("KeyTree", function(t) {
  var kt = new KeyTree([], {})
  t.equals(Object.keys(kt.mtree).length, 1)
  t.equals(kt.size, 1)
  t.end()
})

test("KeyTree#populate", function(t) {
  var kt = new KeyTree(
    [ "foo"
    , "a|b|c"
    , "g>h|j", "g>h|i", "g>k", "g>k", "g>h"
    ], {foo: "histogram"})
  t.deepEquals(kt.mtree,
    { " ":
      [ {key: "a",   hasChildren: true,  type: "none"}
      , {key: "foo", hasChildren: false, type: "histogram"}
      , {key: "g",   hasChildren: true,  type: "none"}
      ]
    , a: [{key: "a|b", hasChildren: true, type: "none"}]
    , "a|b": [{key: "a|b|c", hasChildren: false, type: "none"}]
    , "g":
      [ {key: "g>h", hasChildren: true, type: "none"}
      , {key: "g>k", hasChildren: false, type: "none"}
      ]
    , "g>h":
      [ {key: "g>h|i", hasChildren: false, type: "none"}
      , {key: "g>h|j", hasChildren: false, type: "none"}
      ]
    , foo:     []
    , "a|b|c": []
    , "g>h|i": []
    , "g>h|j": []
    , "g>k":   []
    })
  t.end()
})


test("KeyTree#remove", function(t) {
  var keys = ["foo", "bar", "alpha|beta", "alpha|gamma"]
  test("top-level", function(t) {
    var kt = new KeyTree(keys, {})
    t.equals(kt.size, 6)
    t.deepEquals(kt.remove("foo"), ["foo"])
    t.equals(kt.size, 5)
    t.notOk(kt.mtree["foo"])
    t.deepEquals(kt.mtree[ROOT].map(getKey), ["alpha", "bar"])
    t.end()
  })

  test("child", function(t) {
    var kt = new KeyTree(keys, {})
    t.deepEquals(kt.remove("alpha|beta"), ["alpha|beta"])
    t.equals(kt.size, 5)
    t.notOk(kt.mtree["alpha|beta"])
    t.deepEquals(kt.mtree["alpha"].map(getKey), ["alpha|gamma"])
    t.deepEquals(kt.mtree[ROOT][0], {key: "alpha", hasChildren: true, type: "none"})
    t.end()
  })

  test("last child", function(t) {
    var kt = new KeyTree(["q", "alpha|beta"], {})
    t.deepEquals(kt.mtree[ROOT][0], {key: "alpha", hasChildren: true, type: "none"})
    t.deepEquals(kt.remove("alpha|beta"), ["alpha|beta"])
    t.deepEquals(kt.mtree[ROOT][0], {key: "alpha", hasChildren: false, type: "none"})
    t.end()
  })

  test("nonexistant only child", function(t) {
    var kt = new KeyTree(["q"], {})
    t.equals(kt.size, 2)
    t.deepEquals(kt.remove("quack"), [])
    t.equals(kt.size, 2)
    t.end()
  })

  test("nonexistant with siblings", function(t) {
    var kt = new KeyTree(["alpha|beta", "alpha|gamma"], {})
    t.equals(kt.size, 4)
    t.deepEquals(kt.remove("alpha|quack"), [])
    t.equals(kt.size, 4)
    t.end()
  })

  test("nonexistant nested", function(t) {
    var kt = new KeyTree(["foo"], {})
    t.equals(kt.size, 2)
    t.deepEquals(kt.remove("alpha|beta"), [])
    t.equals(kt.size, 2)
    t.end()
  })

  test("recursive", function(t) {
    var kt = new KeyTree(keys, {})
    t.deepEquals(kt.remove("alpha"), ["alpha", "alpha|beta", "alpha|gamma"])
    t.deepEquals(kt.mtree[ROOT].map(getKey), ["bar", "foo"])
    t.equals(kt.mtree["alpha"], null)
    t.equals(kt.mtree["alpha|beta"], null)
    t.equals(kt.mtree["alpha|gamma"], null)
    t.end()
  })
  t.end()
})


test("KeyTree#listAll", function(t) {
  var kt = new KeyTree(
    [ "alpha", "beta"
    , "alpha|foo", "beta>bar"
    , "gamma>delta"
    ], {})
  t.deepEquals(kt.listAll(),
    [ "alpha"
    , "alpha|foo"
    , "beta"
    , "beta>bar"
    , "gamma"
    , "gamma>delta"
    ])
  t.end()
})

test("KeyTree#filter", function(t) {
  var kt = new KeyTree(
    [ "alpha", "beta", "gamma"
    , "alpha|foo", "beta>bar"
    ], {})
  // Top
  t.deepEquals(kt.filter("a"),
    [ {key: "alpha", hasChildren: true, type: "none"}
    , {key: "beta",  hasChildren: true, type: "none"}
    , {key: "gamma", hasChildren: false, type: "none"}
    ])
  t.deepEquals(kt.filter("al"), [{key: "alpha", hasChildren: true, type: "none"}])
  // Case-insensitive
  t.deepEquals(kt.filter("aL"), [{key: "alpha", hasChildren: true, type: "none"}])
  // Top, no results
  t.deepEquals(kt.filter("q"), [])

  // Nested
  var nest =
    [ {key: "alpha|foo", hasChildren: false, type: "none"}
    , {key: "beta>bar",  hasChildren: false, type: "none"}
    ]
  // Nested "*"
  t.deepEquals(kt.filter(">"), nest)
  t.deepEquals(kt.filter("|"), nest)
  // Nested, filter
  t.deepEquals(kt.filter("|a"), [{key: "beta>bar", hasChildren: false, type: "none"}])
  // Nested, no results
  t.deepEquals(kt.filter(">q"), [])
  t.deepEquals(kt.filter("|qqq"), [])

  // Limit
  t.deepEquals(kt.filter("a", 1), [{key: "alpha", hasChildren: true, type: "none"}])
  t.deepEquals(kt.filter("a", 2),
    [ {key: "alpha", hasChildren: true, type: "none"}
    , {key: "beta",  hasChildren: true, type: "none"}
    ])
  t.end()
})


test("KeyTree.findKey", function(t) {
  var findKey = KeyTree.findKey
    , one     = [{key: "a"}]
    , two     = [{key: "a"}, {key: "b"}]
    , three   = [{key: "a"}, {key: "b"}, {key: "c"}]

  // Nonexistant
  t.equals(findKey([], "foo"), -1)
  t.equals(findKey(one, "foo"), -1)
  t.equals(findKey(two, "foo"), -1)
  t.equals(findKey(three, "foo"), -1)

  t.equals(findKey(one, "a"), 0)

  t.equals(findKey(two, "a"), 0)
  t.equals(findKey(two, "b"), 1)

  t.equals(findKey(three, "a"), 0)
  t.equals(findKey(three, "b"), 1)
  t.equals(findKey(three, "c"), 2)
  t.end()
})


function getKey(keyObj) { return keyObj.key }
