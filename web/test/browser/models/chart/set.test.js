var test     = require('tap').test
  , lodash   = require('lodash')
  , Chart    = require('../../../../client/js/models/chart/chart')
  , ChartSet = require('../../../../client/js/models/chart/set')

var defaultSettings = makeSettings()

function newChart(opts) { return new Chart(opts.keys, opts) }

test("ChartSet", function(t) {
  var settings = {histkeys: [], subkey: "mean", renderer: "stack"}
    , set      = new ChartSet(makeChart, getType, settings)

  t.equals(set.makeChart, makeChart)
  t.equals(set.getType, getType)
  t.equals(set.clock, 0)

  t.equals(set.mode, null)
  t.equals(set.layout, null)
  t.deepEquals(set.charts, [])

  t.equals(set.mkeys, null)
  t.equals(set.subkey, "mean")
  t.equals(set.histkeys, settings.histkeys)
  t.equals(set.renderer, "stack")
  t.equals(set.dashboard, null)
  t.end()

  function makeChart() {}
  function getType() {}
})

test("ChartSet#graphNone", function(t) {
  var set = new ChartSet(limit(0, noop), limit(0, noop), defaultSettings)
  set.graphNone()
  t.equals(set.mode, ChartSet.MODE_GRAPH)
  t.equals(set.layout, null)
  t.deepEquals(set.mkeys, [])
  t.end()
})

test("ChartSet#graphOne", function(t) {
  test("null -> ONE", function(t) {
    var set = new ChartSet(limit(1,
        function(opts) {
          t.deepEquals(opts, {keys: ["foo@count"]})
          return chart
        }), limit(1, getType), defaultSettings)
      , chart = {}

    set.graphOne("foo", function(fail) {
      if (fail) throw fail
      t.equals(set.mode, ChartSet.MODE_GRAPH)
      t.equals(set.layout, ChartSet.LAYOUT_ONE)
      t.deepEquals(set.mkeys, ["foo"])
      t.equals(set.charts.length, 1)
      t.equals(set.charts[0], chart)
      t.end()
    })

    function getType(mkey, callback) {
      t.equals(mkey, "foo")
      process.nextTick(callback.bind(null, null, "counter"))
    }
  })

  test("null -> ONE function", function(t) {
    var fn = "{{foo} / {bar}}"
    var set = new ChartSet(limit(1,
        function(opts) {
          t.deepEquals(opts, {keys: [fn]})
          return chart
        }), limit(1, makeGetType("counter")), defaultSettings)
      , chart = {}

    set.graphOne(fn, function(fail) {
      t.equals(set.layout, ChartSet.LAYOUT_ONE)
      t.deepEquals(set.mkeys, [fn])
      t.end()
    })
  })

  test("null -> HISTOGRAM", function(t) {
    var set    = new ChartSet(makeChart, limit(2, makeGetType("histogram")), defaultSettings)
      , chart1 = {one: true}
      , chart2 = {two: true}
      , i      = 0

    set.graphOne("foo", function(fail) {
      if (fail) throw fail
      t.equals(set.mode, ChartSet.MODE_GRAPH)
      t.equals(set.layout, ChartSet.LAYOUT_HISTOGRAM)
      t.deepEquals(set.mkeys, ["foo"])
      t.equals(set.charts.length, 2)
      t.equals(set.charts[0], chart1)
      t.equals(set.charts[1], chart2)
      t.end()
    })

    function makeChart(opts) {
      if      (i === 0) t.deepEquals(opts, {keys: ["foo"], histkeys: ["mean", "p95", "p99"]})
      else if (i === 1) t.deepEquals(opts, {keys: ["foo@count"]})
      else t.fail()
      return [chart1, chart2][i++]
    }
  })

  test("race", function(t) {
    test("graphOne, graphOne", function(t) {
      var set  = new ChartSet(limit(2, newChart), getType, defaultSettings)
        , left = 2
      set.graphOne("first", function(fail) { t.fail() })
      set.graphOne("second", function(fail) { if (fail) throw fail })
      function getType(mkey, callback) {
        // Finish out of order.
        setTimeout(function() {
          callback(null, "counter")
        doneish()
        }, mkey === "first" ? 20 : 0)
      }

      function doneish() {
        if (--left > 0) return
        t.equals(set.mode, ChartSet.MODE_GRAPH)
        t.equals(set.layout, ChartSet.LAYOUT_ONE)
        t.deepEquals(set.mkeys, ["second"])
        t.end()
      }
    })

    test("graphOne, graphMany", function(t) {
      var set = new ChartSet(limit(2, newChart), getType, defaultSettings)
        , type
      set.graphOne("first", function(fail) { t.fail() })
      set.graphMany(["a", "b", "c"])
      process.nextTick(function() {
        t.equals(set.layout, ChartSet.LAYOUT_MANY)
        t.deepEquals(set.mkeys, ["a", "b", "c"])
        t.ok(type)
        t.end()
      })

      function getType(mkey, callback) {
        process.nextTick(function() {
          callback(null, "counter")
          type = true
        })
      }
    })
    t.end()
  })

  ;[{type: "histogram", limit: 2, layout: "HISTOGRAM"}
  , {type: "counter",   limit: 1, layout: "ONE"}
  ].forEach(function(T) {
    test("duplicate " + T.layout, function(t) {
      var set = new ChartSet(limit(T.limit, newChart), makeGetType(T.type), defaultSettings)
      set.graphOne("foo", function(fail) {
        if (fail) throw fail
        t.equals(set.graphOne("foo", function() {}), true)
        t.end()
      })
    })
  })
  t.end()
})


test("ChartSet#graphMany", function(t) {
  test("null -> MANY", function(t) {
    var set   = new ChartSet(limit(1, makeChart), noop, defaultSettings)
      , chart = {chart: true}
      , mkeys = ["a", "b", "c", "d"]
    set.graphMany(mkeys)
    t.equals(set.mode, ChartSet.MODE_GRAPH)
    t.equals(set.layout, ChartSet.LAYOUT_MANY)
    t.equals(set.mkeys, mkeys)
    t.equals(set.charts.length, 1)
    t.equals(set.charts[0], chart)
    t.end()

    function makeChart(opts) {
      t.deepEquals(opts,
        { keys:     mkeys
        , subkey:   "p99"
        , renderer: "line"
        })
      return chart
    }
  })

  test("MANY -> MANY", function(t) {
    var set    = new ChartSet(makeChart, noop, defaultSettings)
      , chart1 = new MockChart()
      , chart2 = new MockChart()
      , i      = 0
    set.graphMany(["a", "b", "c"])
    set.graphMany(["x", "y", "z"])
    t.equals(set.mode, ChartSet.MODE_GRAPH)
    t.equals(set.layout, ChartSet.LAYOUT_MANY)
    t.deepEquals(set.mkeys, ["x", "y", "z"])
    t.deepEquals(chart1.ops, [["destroy"]])
    t.deepEquals(chart2.ops, [])
    t.end()

    function makeChart(opts) {
      if      (i === 0) t.deepEquals(opts, {keys: ["a", "b", "c"], subkey: "p99", renderer: "line"})
      else if (i === 1) t.deepEquals(opts, {keys: ["x", "y", "z"], subkey: "p99", renderer: "line"})
      return [chart1, chart2][i++] || t.fail()
    }
  })

  test("MANY -> MANY, duplicate keys, different order", function(t) {
    var set = new ChartSet(limit(1, newChart), noop, defaultSettings)
    t.notOk(set.graphMany(["a", "b", "c"]))
    t.equals(set.graphMany(["c", "b", "a"]), true)
    t.deepEquals(set.mkeys, ["a", "b", "c"])
    t.end()
  })
  t.end()
})


test("ChartSet#graphDashboard", function(t) {
  test("null -> DASHBOARD", function(t) {
    var set  = new ChartSet(limit(2, makeChart), noop, defaultSettings)
      , dash =
        { id: "foo"
        , graphs:
          { 1: { keys: ["a", "b"], renderer: "line" }
          , 2: { keys: ["c", "d"], subkey: "median", title: "TITLE"}
          }
        }
      , i = 0
    set.graphDashboard(dash)
    t.equals(set.mode, ChartSet.MODE_DASHBOARD)
    t.equals(set.layout, ChartSet.LAYOUT_DASHBOARD)
    t.equals(set.dashboard, dash)
    t.deepEquals(set.charts, [{chart: 0}, {chart: 1}])
    t.end()

    function makeChart(opts) {
      if      (i === 0) t.deepEquals(opts, {keys: ["a", "b"], renderer: "line"})
      else if (i === 1) t.deepEquals(opts, {keys: ["c", "d"], subkey: "median", title: "TITLE"})
      else t.fail()
      return {chart: i++}
    }
  })

  t.end()
})

test("ChartSet#graphDashboardRemove", function(t) {
  test("remove", function(t) {
    var set  = new ChartSet(limit(2, newChart), noop, defaultSettings)
      , dash = new MockDashboard(
        { id: "foo"
        , graphs:
          { 1: { id: "1", keys: ["a", "b"] }
          , 2: { id: "2", keys: ["c", "d"] }
          }
        })
    set.graphDashboard(dash)
    var chart1 = set.charts[0]
      , chart2 = set.charts[1]
    set.graphDashboardRemove(chart2)
    // Removed from the ChartSet
    t.equals(set.charts.length, 1)
    t.equals(set.charts[0].id, "1")
    // Removed from the dashboard
    t.deepEquals(dash.ops, [["removeChart", "2"]])
    // Destroyed
    t.equals(chart1.isDestroyed, false)
    t.equals(chart2.isDestroyed, true)
    t.end()
  })

  t.end()
})


test("ChartSet#graphAdd", function(t) {
  test("MANY -> MANY", function(t) {
    var chart = new MockChart()
      , set   = new ChartSet(limit(1, getter(chart)), noop, defaultSettings)
    set.graphMany(["a", "b"])
    set.graphAdd("c")
    t.equals(set.layout, ChartSet.LAYOUT_MANY)
    t.deepEquals(set.mkeys, ["a", "b", "c"])
    t.deepEquals(chart.ops, [["plotAdd", "c"]])
    t.end()
  })

  test("ONE -> MANY", function(t) {
    var chart1 = new MockChart()
      , chart2 = new MockChart()
      , set    = new ChartSet(makeChart, makeGetType("counter"), defaultSettings)
      , i      = 0
    set.graphOne("a", function(fail) {
      if (fail) throw fail
      set.graphAdd("b")
      t.equals(set.mode, ChartSet.MODE_GRAPH)
      t.equals(set.layout, ChartSet.LAYOUT_MANY)
      t.deepEquals(set.mkeys, ["a", "b"])
      t.equals(set.charts.length, 1)
      t.equals(set.charts[0], chart2)
      t.deepEquals(chart1.ops, [["destroy"]])
      t.deepEquals(chart2.ops, [])
      t.end()
    })

    function makeChart(opts) {
      if      (i === 0) t.deepEquals(opts, {keys: ["a@count"]})
      else if (i === 1) t.deepEquals(opts, {keys: ["a", "b"], subkey: "p99", renderer: "line"})
      else t.fail()
      return [chart1, chart2][i++]
    }
  })

  test("HISTOGRAM -> MANY", function(t) {
    var chartH = new MockChart() // histogram
      , chartC = new MockChart() // histogram@count
      , chartM = new MockChart() // many
      , set    = new ChartSet(makeChart, makeGetType("histogram"), defaultSettings)
      , i      = 0
    set.graphOne("a", function(fail) {
      if (fail) throw fail
      set.graphAdd("b")
      t.equals(set.mode, ChartSet.MODE_GRAPH)
      t.equals(set.layout, ChartSet.LAYOUT_MANY)
      t.deepEquals(set.mkeys, ["a", "b"])
      t.equals(set.charts.length, 1)
      t.equals(set.charts[0], chartM)
      t.deepEquals(chartH.ops, [["destroy"]])
      t.deepEquals(chartC.ops, [["destroy"]])
      t.deepEquals(chartM.ops, [])
      t.end()
    })

    function makeChart(opts) {
      if      (i === 0) t.deepEquals(opts, {keys: ["a"], histkeys: ["mean", "p95", "p99"]})
      else if (i === 1) t.deepEquals(opts, {keys: ["a@count"]})
      else if (i === 2) t.deepEquals(opts, {keys: ["a", "b"], subkey: "p99", renderer: "line"})
      else t.fail()
      return [chartH, chartC, chartM][i++]
    }
  })

  test("MANY -> MANY duplicate", function(t) {
    var set = new ChartSet(limit(1, newChart), noop, defaultSettings)
    set.graphMany(["a", "b", "c"])
    set.graphAdd("c")
    t.deepEquals(set.mkeys, ["a", "b", "c"])
    t.end()
  })

  test("MANY -> MANY, Chart", function(t) {
    var set = new ChartSet(limit(1, newChart), noop, defaultSettings)
    set.graphMany(["a", "b", "c"])
    set.graphAdd("d")
    t.deepEquals(set.mkeys, ["a", "b", "c", "d"])
    t.end()
  })
  t.end()
})


test("ChartSet#graphRemove", function(t) {
  test("MANY -> MANY", function(t) {
    var chart = new MockChart()
      , set   = new ChartSet(makeChart, noop, defaultSettings)
      , i     = 0

    set.graphMany(["a", "b", "c"])
    set.graphRemove("b", function(fail) {
      if (fail) throw fail
      t.equals(set.mode, ChartSet.MODE_GRAPH)
      t.equals(set.layout, ChartSet.LAYOUT_MANY)
      t.deepEquals(set.mkeys, ["a", "c"])
      t.equals(set.charts[0], chart)
      t.deepEquals(chart.ops, [["plotRemove", "b"]])
      t.end()
    })

    function makeChart(opts) {
      if (i === 0) t.deepEquals(opts, {keys: ["a", "b", "c"], subkey: "p99", renderer: "line"})
      else t.fail()
      return chart
    }
  })

  test("MANY -> ONE", function(t) {
    var chart1 = new MockChart()
      , chart2 = new MockChart()
      , set    = new ChartSet(makeChart, makeGetType("counter"), defaultSettings)
      , i      = 0

    set.graphMany(["a", "b"])
    set.graphRemove("b", function(fail) {
      if (fail) throw fail
      t.equals(set.mode, ChartSet.MODE_GRAPH)
      t.equals(set.layout, ChartSet.LAYOUT_ONE)
      t.deepEquals(set.mkeys, ["a"])
      t.equals(set.charts[0], chart2)
      t.deepEquals(chart1.ops, [["destroy"]])
      t.deepEquals(chart2.ops, [])
      t.end()
    })

    function makeChart(opts) {
      if      (i === 0) t.deepEquals(opts, {keys: ["a", "b"], subkey: "p99", renderer: "line"})
      else if (i === 1) t.deepEquals(opts, {keys: ["a@count"]})
      else t.fail()
      return [chart1, chart2][i++]
    }
  })

  test("ONE -> ONE", function(t) {
    var set = new ChartSet(limit(1, newChart), makeGetType("counter"), defaultSettings)
    set.graphOne("a", function(fail) {
      if (fail) throw fail
      t.equals(set.graphRemove("a", function() { t.fail() }), true)
      t.deepEquals(set.mkeys, ["a"])
      t.end()
    })
  })

  test("nonexistant", function(t) {
    var set = new ChartSet(limit(1, newChart), noop, defaultSettings)
    set.graphMany(["a", "b"])
    set.graphRemove("c")
    t.deepEquals(set.mkeys, ["a", "b"])
    t.end()
  })
  t.end()
})


;[{fn: "setSubKey",   field: "subkey",   value: "max"}
, {fn: "setRenderer", field: "renderer", value: "stack"}
].forEach(function(T) {
  test("ChartSet#" + T.fn, function(t) {
    test("MANY", function(t) {
      var chart = new MockChart()
        , set   = new ChartSet(limit(1, getter(chart)), noop, defaultSettings)
      set.graphMany(["a", "b", "c"])
      set[T.fn](T.value)
      t.equals(set[T.field], T.value)
      t.deepEquals(chart.ops, [[T.fn, T.value]])
      t.end()
    })

    test("ONE", function(t) {
      var chart = new MockChart()
        , set   = new ChartSet(limit(1, getter(chart)), makeGetType("counter"), defaultSettings)
      set.graphOne("a", function(fail) {
        if (fail) throw fail
        set[T.fn](T.value)
        t.equals(set[T.field], T.value)
        t.deepEquals(chart.ops, [])
        t.end()
      })
    })
   t.end()
  })
})


;[{layout: "HISTOGRAM", type: "histogram", ops: [["setHistKeys", ["median", "p99"]]]}
, {layout: "ONE",       type: "counter",   ops: []}
].forEach(function(T) {
  test("ChartSet#setHistKeys " + T.layout, function(t) {
    var chartH = new MockChart()
      , chartC = new MockChart()
      , set    = new ChartSet(makeChart, makeGetType(T.type), defaultSettings)
      , i      = 0
    set.graphOne("a", function(fail) {
      if (fail) throw fail
      set.setHistKeys(["median", "p99"])
      t.deepEquals(set.histkeys, ["median", "p99"])
      t.deepEquals(chartH.ops, T.ops)
      t.deepEquals(chartC.ops, [])
      t.end()
    })

    function makeChart(opts) { return [chartH, chartC][i++] || t.fail() }
  })
})

test("ChartSet#setHistKeys duplicate", function(t) {
  var chartH   = new MockChart()
    , histkeys = ["mean"]
    , settings = makeSettings({histkeys: histkeys})
    , set      = new ChartSet(limit(1, getter(chartH)), makeGetType("histogram"), settings)
  t.equals(set.setHistKeys(["mean"]), true)
  t.equals(set.histkeys, histkeys)
  t.end()
})


/*
test("ChartSet#plotTypeToString", function(t) {
  var set = new ChartSet(noop, noop, defaultSettings)

  t.equals(ps.plotTypeToString("many"), "count")

  ps.subkey = "mean"
  t.equals(ps.plotTypeToString("many"), "mean")
  ps.renderer = "stack"
  t.equals(ps.plotTypeToString("many"), "mean, stack")

  t.equals(ps.plotTypeToString("histogram"), "histogram")
  ps.histkeys.push("llquantize")
  t.equals(ps.plotTypeToString("histogram"), "heat map")

  t.equals(ps.plotTypeToString("counter"), "counter")
  t.equals(ps.plotTypeToString("foo"), "?")
  t.end()
})
*/




////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function MockChart() { this.ops = [] }

MockChart.prototype.plotAdd     = function(key) { this.ops.push(["plotAdd",     key]) }
MockChart.prototype.plotRemove  = function(key) { this.ops.push(["plotRemove",  key]) }
MockChart.prototype.setSubKey   = function(key) { this.ops.push(["setSubKey",   key]) }
MockChart.prototype.setHistKeys = function(key) { this.ops.push(["setHistKeys", key]) }
MockChart.prototype.setRenderer = function(key) { this.ops.push(["setRenderer", key]) }

MockChart.prototype.destroy = function() { this.ops.push(["destroy"]) }

function MockDashboard(opts) {
  this.graphs = opts.graphs
  this.ops    = []
}

MockDashboard.prototype.removeChart = function(id) {
  this.ops.push(["removeChart", id])
}


function makeGetType(type) {
  return function(mkey, callback) {
    process.nextTick(function() { callback(null, type) })
  }
}

function makeSettings(opts) {
  return lodash.defaults(opts || {},
    { subkey:    "p99"
    , renderer:  "line"
    , histkeys: ["mean", "p95", "p99"]
    })
}

function limit(n, fn) {
  return function() {
    if (--n < 0) throw new Error("called too many times")
    return fn.apply(this, arguments)
  }
}

function getter(val) { return function() { return val } }

function noop() {}
