var test          = require('tap').test
  , DashboardTree = require('../../../client/js/models/dashboard-tree')
  , Dashboard     = require('../../../client/js/models/dashboard')
  , ImplicitTree  = require('../../../client/js/models/implicit-tree')
  , APIClient     = require('../../../client/api')

test("DashboardTree", function(t) {
  var tree = new DashboardTree([])
  t.isa(tree.tree, ImplicitTree)
  t.equals(tree.tree.separator, ">")
  t.deepEquals(tree.cache, {})
  t.equals(DashboardTree.TOP, "")
  t.end()
})

;["parent", "top", "list", "isReal", "hasChildren"].forEach(function(fn) {
  var ids        = ["foo", "foo>a", "foo>b", "bar"]
    , dashboards = new DashboardTree(ids)
    , tree       = new ImplicitTree(ids, ">")
  test("DashboardTree#" + fn, function(t) {
    t.deepEquals(dashboards[fn]("foo"), tree[fn]("foo"))
    t.end()
  })
})

test("DashboardTree#create", function(t) {
  var tree = new DashboardTree(["foo"])
    , cr   = 0

  DashboardTree.inject(new APIClient(function(url, opts, callback) {
    t.equals(url, "/api/dashboards/" + encodeURIComponent("foo>bar"))
    t.equals(opts.method, "POST")
    t.equals(opts.body, JSON.stringify({id: "foo>bar", graphs: {}}))
    callback()
  }))
  tree.on("create", function(id) { t.equals(id, "foo>bar"); cr++ })
  tree.create({id: "foo>bar"})

  var dash = tree.cache["foo>bar"]
  t.isa(dash, Dashboard)
  t.equals(dash.id, "foo>bar")
  t.deepEquals(dash.graphs, {})

  t.deepEquals(tree.list("foo"), ["foo>bar"])
  t.equals(tree.isReal("foo>bar"), true)
  t.equals(cr, 1)
  t.end()
})

test("DashboardTree#get", function(t) {
  var tree = new DashboardTree(["foo"])
  DashboardTree.inject(new APIClient(function(url, opts, callback) {
    t.equals(url, "/api/dashboards/foo")
    t.equals(opts.method, "GET")
    callback(null, JSON.stringify({id: "foo", graphs: {1: {name: "quack"}}}))
  }))
  tree.get("foo", function(err, dash) {
    if (err) throw err
    t.isa(dash, Dashboard)
    t.equals(dash.tree, tree)
    t.equals(dash.id, "foo")
    t.deepEquals(dash.graphs, {1: {name: "quack"}})
    // Its cached.
    tree.get("foo", function(err, dash2) {
      if (err) throw err
      t.equals(dash2, dash)
      t.end()
    })
  })
})

test("DashboardTree#update", function(t) {
  test("uncached; change ID", function(t) {
    var tree = new DashboardTree(["foo"])
      , a = 0, c = 0
    tree.on("change:id", function(from, to) {
      t.equals(from, "foo")
      t.equals(to, "foo>bar")
      c++
    })
    DashboardTree.inject(new APIClient(function(url, opts, callback) {
      t.equals(url, "/api/dashboards/foo")
      t.equals(opts.method, "PATCH")
      a++
      callback()
    }))
    tree.update("foo", {id: "foo>bar"})
    t.equals(tree.isReal("foo"), false)
    t.equals(tree.isReal("foo>bar"), true)
    t.deepEquals(tree.cache, {})
    t.equals(a, 1)
    t.equals(c, 1)
    t.end()
  })

  test("cached; change ID", function(t) {
    var tree = new DashboardTree(["foo"])
      , dash = new Dashboard({id: "foo"})
    tree.cache = {foo: dash}
    DashboardTree.inject(new APIClient(function(url, opts, callback) { }))
    tree.update("foo", {id: "foo>bar"})
    t.deepEquals(tree.cache, {foo: null, "foo>bar": dash})
    t.equals(tree.cache["foo>bar"].id, "foo>bar")
    t.end()
  })

  test("change graphs", function(t) {
    var tree = new DashboardTree(["foo"])
      , dash = new Dashboard({id: "foo", graphs: {2: {name: "Z"}}})
      , a = 0
    tree.cache = {foo: dash}
    DashboardTree.inject(new APIClient(function(url, opts, callback) {
      t.equals(url, "/api/dashboards/foo")
      t.equals(opts.method, "PATCH")
      t.equals(opts.body, JSON.stringify({graphs: {1: {name: "Q"}}}))
      a++
      callback()
    }))
    tree.update("foo", {graphs: {1: {name: "Q"}}})
    t.deepEquals(Object.keys(tree.cache.foo.graphs).sort(), ["1", "2"])
    t.equals(a, 1)
    t.end()
  })

  t.end()
})

test("DashboardTree#destroy", function(t) {
  test("uncached", function(t) {
    var tree = new DashboardTree(["foo"])
      , a = 0, d = 0
    tree.on("delete", function(id) {
      t.equals(id, "foo")
      d++
    })
    DashboardTree.inject(new APIClient(function(url, opts, callback) {
      t.equals(url, "/api/dashboards/foo")
      t.equals(opts.method, "DELETE")
      a++
      callback()
    }))
    tree.destroy("foo")
    t.equals(tree.isReal("foo"), false)
    t.deepEquals(tree.list(""), [])
    t.equals(a, 1)
    t.equals(d, 1)
    t.end()
  })

  test("cached", function(t) {
    var tree = new DashboardTree(["foo"])
      , dash = new Dashboard({id: "foo", graphs: {}})
      , a = 0
    tree.cache = {foo: dash}
    DashboardTree.inject(new APIClient(function(url, opts, callback) {
      t.equals(url, "/api/dashboards/foo")
      a++
    }))
    tree.destroy("foo")
    t.deepEquals(tree.cache, {foo: null})
    t.equals(dash.graphs, null)
    t.equals(dash.tree, null)
    t.equals(a, 1)
    t.end()
  })

  test("error", function(t) {
    var tree = new DashboardTree(["foo"])
      , e = 0
    DashboardTree.inject(new APIClient(function(url, opts, callback) {
      callback(true)
    }))
    tree.on("error", function(msg) {
      t.isa(msg, "string")
      e++
    })
    tree.destroy("foo")
    t.equals(e, 1)
    t.end()
  })

  t.end()
})
