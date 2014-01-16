var test      = require('tap').test
  , DBKeyTree = require('../../../app/models/mkeys')

test("DBKeyTree", function(t) {
  var db = new MockDB([])
    , kt = new DBKeyTree(db)
  t.equals(kt.db, db)
  t.equals(kt.isLoading, false)
  t.end()
})

test("DBKeyTree#load", function(t) {
  var kt    = new DBKeyTree(new MockDB([]))
    , tree1 = kt.tree
  kt.load(function(err, tree2) {
    if (err) throw err
    t.equals(kt.isLoading, false)
    t.equals(kt.tree, tree2)
    t.notEquals(tree2, tree1)
    t.end()
  })
})

test("DBKeyTree#listAll", function(t) {
  var kt = new DBKeyTree(new MockDB(
    [ {key: "cheese",  type: "histogram"}
    , {key: "foo>bar", type: "counter"}
    ]))
  kt.tree = null
  kt.listAll(function(err, all) {
    if (err) throw err
    t.ok(kt.tree)
    t.deepEquals(all, ["cheese", "foo", "foo>bar"])
    t.end()
  })
})

test("DBKeyTree#listKey", function(t) {
  var db = new MockDB(
    [ {key: "cheese",  type: "histogram"}
    , {key: "foo>A",   type: "counter"}
    , {key: "foo|B",   type: "counter"}
    , {key: "foo|B|C", type: "counter"}
    ])

  test("list key", function(t) {
    var kt = new DBKeyTree(db)
    kt.tree = null
    kt.listKey("foo", function(err, all) {
      if (err) throw err
      t.deepEquals(all,
        [ {key: "foo>A", hasChildren: false, type: "counter"}
        , {key: "foo|B", hasChildren: true,  type: "counter"}
        ])
      t.end()
    })
  })

  test("list root", function(t) {
    var kt = new DBKeyTree(db)
    kt.tree = null
    kt.listKey(null, function(err, all) {
      if (err) throw err
      t.deepEquals(all,
        [ {key: "cheese", hasChildren: false, type: "histogram"}
        , {key: "foo",    hasChildren: true,  type: "none"}
        ])
      t.end()
    })
  })

  t.end()
})

test("DBKeyTree#listKeys", function(t) {
  var kt = new DBKeyTree(new MockDB(
    [ {key: "cheese",  type: "histogram"}
    , {key: "foo>A",   type: "counter"}
    , {key: "foo|B",   type: "counter"}
    , {key: "foo|B|C", type: "counter"}
    , {key: "bar|D",   type: "histogram"}
    , {key: "baz",     type: "counter"}
    ]))
  kt.listKeys(["foo", "bar", "baz"], function(err, keys) {
    if (err) throw err
    t.deepEquals(keys,
      { foo:
        [ {key: "foo>A", type: "counter", hasChildren: false}
        , {key: "foo|B", type: "counter", hasChildren: true}
        ]
      , bar: [{key: "bar|D", type: "histogram", hasChildren: false}]
      , baz: []
      })
    t.end()
  })
})

test("DBKeyTree#deleteKey", function(t) {
  var kt = new DBKeyTree(new MockDB(
    [ {key: "cheese",  type: "histogram"}
    , {key: "foo",     type: "counter"}
    , {key: "foo>A",   type: "counter"}
    , {key: "foo|B",   type: "counter"}
    , {key: "foo|B|C", type: "counter"}
    , {key: "bar|D",   type: "histogram"}
    , {key: "baz",     type: "counter"}
    ]))
  kt.deleteKey("foo", function(err) {
    if (err) throw err
    t.deepEquals(kt.db.deleted, ["foo", "foo>A", "foo|B", "foo|B|C"])
    t.end()
  })
})

test("DBKeyTree#filter", function(t) {
  var kt = new DBKeyTree(new MockDB(
    [ {key: "foo", type: "histogram"}
    , {key: "bar", type: "histogram"}
    ]))
  kt.tree = null
  kt.filter("f", 5, function(err, mkeys) {
    if (err) throw err
    t.deepEquals(mkeys, [{key: "foo", type: "histogram", hasChildren: false}])
    t.ok(kt.tree)
    t.end()
  })
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function MockDB(keys) {
  this.keys    = keys
  this.deleted = []
}

// Call callback synchronously so that we can ignore the reload()
// in the constructor.
MockDB.prototype.getMetricsKeys = function(callback) {
  callback(null, this.keys.slice())
}

MockDB.prototype.deleteMetricsKey = function(key, callback) {
  this.deleted.push(key)
  process.nextTick(callback)
}
