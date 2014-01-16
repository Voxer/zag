var test         = require('tap').test
  , ImplicitTree = require('../../../client/js/models/implicit-tree')

function makeTree(tree) {
  return new ImplicitTree(tree, ">")
}

test("ImplicitTree", function(t) {
  var tree = new ImplicitTree([], "|")
  t.equals(tree.separator, "|")
  t.deepEquals(tree.tree, {})
  t.deepEquals(tree.real, {})
  t.equals(ImplicitTree.TOP, "")
  t.end()
})

test("ImplicitTree#parent", function(t) {
  var tree = makeTree([])
  t.equals(tree.parent("a"), "")
  t.equals(tree.parent("a>b"), "a")
  t.equals(tree.parent("a>b>c"), "a>b")
  t.end()
})

test("ImplicitTree#top", function(t) {
  t.deepEquals((makeTree([])).top(), [])
  t.deepEquals((makeTree(["foo"])).top(), ["foo"])
  t.deepEquals((makeTree(["foo", "foo"])).top(), ["foo"])
  t.deepEquals((makeTree(["foo", "bar"])).top(), ["bar", "foo"])
  t.deepEquals((makeTree(["foo", "foo>bar"])).top(), ["foo"])
  t.deepEquals((makeTree(["foo>bar", "foo>bar"])).top(), ["foo"])
  t.deepEquals((makeTree(["foo>bar", "bar>foo"])).top(), ["bar", "foo"])
  t.end()
})

test("ImplicitTree#list", function(t) {
  t.deepEquals((makeTree([])).list("foo"), [])
  t.deepEquals((makeTree(["foo"])).list("foo"), [])
  t.deepEquals((makeTree(["foo>bar"])).list("foo"), ["foo>bar"])
  t.deepEquals((makeTree(["foo>A", "foo>B"])).list("foo"), ["foo>A", "foo>B"])
  t.deepEquals((makeTree(["foo>C", "foo>A", "foo>B"])).list("foo"), ["foo>A", "foo>B", "foo>C"])
  t.deepEquals((makeTree(["A>B>1", "A>B>2", "A>B>3"])).list("A>B"), ["A>B>1", "A>B>2", "A>B>3"])
  t.end()
})

test("ImplicitTree#isReal", function(t) {
  var tree = makeTree(["a", "a>b", "c>d", "e>f>g"])
  t.equals(tree.isReal("a"),     true)
  t.equals(tree.isReal("a>b"),   true)
  t.equals(tree.isReal("c>d"),   true)
  t.equals(tree.isReal("e>f>g"), true)

  t.equals(tree.isReal("c"),     false)
  t.equals(tree.isReal("e"),     false)
  t.equals(tree.isReal("e>f"),   false)
  t.equals(tree.isReal("quack"), false)
  t.end()
})

test("ImplicitTree#hasChildren", function(t) {
  var tree = makeTree(["a", "a>b", "a>c", "a>b>d", "q"])
  t.equals(tree.hasChildren("a"),     true)
  t.equals(tree.hasChildren("a>b"),   true)
  t.equals(tree.hasChildren("a>c"),   false)
  t.equals(tree.hasChildren("a>b>d"), false)
  t.equals(tree.hasChildren("q"),     false)
  t.equals(tree.hasChildren("quack"), false)
  t.end()
})

test("ImplicitTree#remove", function(t) {
  test("top", function(t) {
    var tree = makeTree(["a", "a>b"])
    t.deepEquals(tree.tree, {"": ["a"], a: ["a>b"]})
    t.deepEquals(tree.real, {a: true, "a>b": true})

    tree.remove("a")
    t.deepEquals(tree.tree, {"": ["a"], a: ["a>b"]})
    t.deepEquals(tree.real, {a: false, "a>b": true})

    tree.remove("a>b")
    t.deepEquals(tree.tree, {})
    t.deepEquals(tree.real, {a: false, "a>b": false})
    t.end()
  })

  test("bottom", function(t) {
    var tree = makeTree(["a", "a>b"])
    tree.remove("a>b")
    t.deepEquals(tree.tree, {"": ["a"]})
    t.deepEquals(tree.real, {a: true, "a>b": false})
    t.end()
  })

  test("sibling", function(t) {
    var tree = makeTree(["a>b", "a>c"])
    t.deepEquals(tree.tree, {"": ["a"], a: ["a>b", "a>c"]})
    t.deepEquals(tree.real, {"a>b": true, "a>c": true})

    tree.remove("a>b")
    t.deepEquals(tree.tree, {"": ["a"], a: ["a>c"]})
    t.deepEquals(tree.real, {"a>b": false, "a>c": true})

    tree.remove("a>c")
    t.deepEquals(tree.tree, {})
    t.deepEquals(tree.real, {"a>b": false, "a>c": false})
    t.end()
  })

  test("deep", function(t) {
    var tree = makeTree(["a>b>c>d"])
    t.deepEquals(tree.tree, {"": ["a"], a: ["a>b"], "a>b": ["a>b>c"], "a>b>c": ["a>b>c>d"]})
    t.deepEquals(tree.real, {"a>b>c>d": true})

    tree.remove("a>b>c>d")
    t.deepEquals(tree.tree, {})
    t.deepEquals(tree.real, {"a>b>c>d": false})
    t.end()
  })

  t.end()
})
