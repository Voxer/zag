var test          = require('tap').test
  , Dashboard     = require('../../../client/js/models/dashboard')
  , DashboardTree = require('../../../client/js/models/dashboard-tree')
  , Chart         = require('../../../client/js/models/chart/chart')

test("Dashboard", function(t) {
  var tree   = {}
    , graphs = {}
    , dash   = new Dashboard({id: "foo", graphs: graphs}, tree)
  t.equals(dash.tree, tree)
  t.equals(dash.id, "foo")
  t.equals(dash.graphs, graphs)

  // Defaults
  t.deepEquals((new Dashboard({id: "bar"})).graphs, {})
  t.end()
})

test("Dashboard#toJSON", function(t) {
  var graphs = {1: {name: "bar", keys: ["a", "b", "c"]}}
    , dash   = new Dashboard({id: "foo", graphs: graphs})
  t.deepEquals(dash.toJSON(),
    { id:     "foo"
    , graphs: graphs
    })
  t.end()
})

test("Dashboard#_update", function(t) {
  test("id", function(t) {
    var dash = new Dashboard({id: "foo"})
    dash._update({id: "bar"})
    t.equals(dash.id, "bar")
    t.end()
  })

  test("graphs", function(t) {
    var orig = {1: [1], 2: [2], 100: [100]}
      , dash = new Dashboard({id: "foo", graphs: orig})
    dash._update({graphs: {2: [4], 3: [3], 100: null}})
    t.equals(dash.id, "foo")
    t.equals(dash.graphs, orig)
    t.deepEquals(dash.graphs, {1: [1], 2: [4], 3: [3]})
    t.end()
  })
  t.end()
})

test("Dashboard#_destroy", function(t) {
  var dash = new Dashboard({id: "foo", graphs: {}}, {})
  dash._destroy()
  t.equals(dash.graphs, null)
  t.equals(dash.tree, null)
  t.end()
})

test("Dashboard#updateChart", function(t) {
  var dash  = new Dashboard({id: "foo", graphs: {}}, {})
    , chart = new Chart(["foo"], {id: "ID", title: "TITLE", histkeys: ["mean", "p99"]})
    , patch
  dash.update = function(opts) { patch = opts }
  dash.updateChart(chart)
  t.deepEquals(patch,
    { graphs:
      { ID:
        { id:       "ID"
        , title:    "TITLE"
        , keys:     ["foo"]
        , histkeys: ["mean", "p99"]
        }
      }
    })
  t.end()
})

test("Dashboard#removeChart", function(t) {
  var dash = new Dashboard({id: "foo", graphs: {1: {id: "foo"}}})
    , patch
  dash.update = function(opts) { patch = opts }
  dash.removeChart("foo")
  t.deepEquals(patch, {graphs: {foo: null}})
  t.end()
})
