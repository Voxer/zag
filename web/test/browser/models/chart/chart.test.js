var test       = require('tap').test
  , lodash     = require('lodash')
  , Chart      = require('../../../../client/js/models/chart/chart')
  , settings   = makeSettings({})
  , KEY_COLORS = Chart.SUBKEY_COLORS
  , COLORS     = Chart.COLOR_POOL

test("Chart", function(t) {
  var chart = new Chart(["foo", "bar"], settings)
  t.deepEquals(chart.mkeys, ["foo", "bar"])
  t.equals(chart.subkey, "count")
  t.equals(chart.renderer, "line")
  t.isa(chart.id, "string")
  t.deepEquals(chart.colorCache, {})
  t.equals(chart.c, 0)
  t.equals(chart.isDestroyed, false)
  t.end()
})

test("Chart histogram", function(t) {
  var chart = new Chart(["foo"], {histkeys: ["mean", "p99"]})
  t.deepEquals(chart.histkeys, ["mean", "p99"])
  t.deepEquals(chart.mkeys, ["foo@mean", "foo@p99"])
  t.end()
})

test("Chart#destroy", function(t) {
  var chart = new Chart(["foo", "bar"], settings)
  chart.destroy()
  t.equals(chart.mkeys, null)
  t.equals(chart.colorCache, null)
  t.equals(chart.isDestroyed, true)
  t.end()
})

test("Chart#getPlots counter", function(t) {
  var chart = new Chart(["foo@count"], settings)
  t.deepEquals(chart.getPlots(), [makeSimplePlot("count")])
  t.end()
})

test("Chart#getPlots histogram", function(t) {
  var chart = new Chart(["foo@mean", "foo@p99"], settings)
  t.deepEquals(chart.getPlots(),
    [ makeSimplePlot("mean")
    , makeSimplePlot("p99")
    ])
  t.end()
})

test("Chart#getPlots histogram + llquantize", function(t) {
  var chart = new Chart(["foo@mean", "foo@p99", "foo@llquantize"], settings)
  t.deepEquals(chart.getPlots(),
    [ makeHeatPlot("foo") // heat map is first
    , makeSimplePlot("mean")
    , makeSimplePlot("p99")
    ])
  t.end()
})

test("Chart#getPlots many", function(t) {
  var chart = new Chart(["foo", "bar", "qqq"], makeSettings({subkey: "p95"}))
  for (var i = 0; i < 2; i++) {
    t.deepEquals(chart.getPlots(),
      [ makeManyPlot("foo@p95", {color: COLORS[0]})
      , makeManyPlot("bar@p95", {color: COLORS[1]})
      , makeManyPlot("qqq@p95", {color: COLORS[2]})
      ])
  }
  t.end()
})

test("Chart#getPlots histogram stack -> line", function(t) {
  var chart = new Chart(["foo@mean", "foo@p99"], makeSettings({renderer: "stack"}))
  t.deepEquals(chart.getPlots(),
    [ makeSimplePlot("mean")
    , makeSimplePlot("p99")
    ])
  t.end()
})

test("Chart#plotAdd", function(t) {
  var chart  = new Chart(["foo", "bar"], settings)
    , expect = makeManyPlot("qqq@count", {color: COLORS[2]})
  chart.makePlot({key: "foo", subkey: "mean"})
  chart.makePlot({key: "bar", subkey: "mean"})
  t.deepEquals(chart.plotAdd("qqq"), expect)
  // The color is cached.
  t.deepEquals(chart.makePlot({key: "qqq", subkey: "count"}), expect)
  t.deepEquals(chart.mkeys, ["foo", "bar", "qqq"])
  t.end()
})

test("Chart#plotRemove", function(t) {
  var chart = new Chart(["foo@mean", "bar", "qqq"], settings)
  t.equals(chart.plotRemove("bar"), "bar@count")
  t.deepEquals(chart.mkeys, ["foo@mean", "qqq"])
  t.equals(chart.plotRemove("foo@mean"), "foo@mean")
  t.deepEquals(chart.mkeys, ["qqq"])
  t.end()
})

test("Chart#setHistKeys", function(t) {
  var chart = new Chart(["a"], {})
  chart.setHistKeys(["mean", "median"])
  t.deepEquals(chart.mkeys, ["a@mean", "a@median"])
  t.deepEquals(chart.histkeys, ["mean", "median"])

  var chart2 = new Chart(["a@p99"], {})
  chart.setHistKeys(["mean", "median"])
  t.deepEquals(chart.mkeys, ["a@mean", "a@median"])
  t.deepEquals(chart.histkeys, ["mean", "median"])
  t.end()
})


test("Chart#plotIDs", function(t) {
  var chart = new Chart(["foo", "bar@mean", "qqq"], settings)
  t.deepEquals(chart.plotIDs(), ["foo@count", "bar@mean", "qqq@count"])
  t.end()
})

test("Chart#getTitle", function(t) {
  var specific = new Chart(["foo@mean"], {title: "TITLE"})
    , inferred = new Chart(["foo@mean"], {})
  t.equals(specific.getTitle(), "TITLE")
  t.equals(inferred.getTitle(), "foo")
  t.end()
})

test("Chart#getKeys", function(t) {
  var hist  = new Chart(["foo"], {histkeys: ["mean", "max"]})
    , many  = new Chart(["foo", "bar"], {subkey: "mean"})
    , count = new Chart(["foo@count"], {})
  t.deepEquals(hist.getKeys(), ["foo"])
  t.deepEquals(many.getKeys(), ["foo", "bar"])
  t.deepEquals(count.getKeys(), ["foo@count"])
  t.end()
})

test("Chart#toJSON", function(t) {
  var one  = new Chart(["foo"], {id: "a", title: "b"})
    , hist = new Chart(["foo"], {id: "a", histkeys: ["mean", "p99"]})
  t.deepEquals(one.toJSON(),  {keys: ["foo"], id: "a", title: "b"})
  t.deepEquals(hist.toJSON(), {keys: ["foo"], id: "a", histkeys: ["mean", "p99"]})
  t.end()
})

test("Chart#getID", function(t) {
  var one = new Chart(["foo"], {id: "a", title: "b"})
  t.equals(one.getID(), "a")
  t.end()
})

test("Chart#setID", function(t) {
  var one = new Chart(["foo"], {id: "a", title: "b"})
  one.setID("b")
  t.equals(one.id, "b")
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

test("Chart#makePlot stack", function(t) {
  var chart = new Chart([], makeSettings({renderer: "stack"}))
  t.deepEquals(chart.makePlot({key: "foo", subkey: "mean"}),
    makeManyPlot("foo@mean", {type: "stack"}))
  t.end()
})

test("Chart#makePlot llquantize", function(t) {
  var chart = new Chart([], makeSettings({renderer: "stack"}))
  t.deepEquals(chart.makePlot({key: "foo", subkey: "llquantize"}, true), makeHeatPlot("foo"))
  t.end()
})

test("Chart#makePlot function", function(t) {
  var chart = new Chart([], makeSettings({}))
    , fn    = "{foo} / {bar@mean}"
  t.deepEquals(chart.makePlot({fn: fn}), makeFnPlot(fn))
  t.end()
})

test("Chart#makePlot cycle colors", function(t) {
  var chart = new Chart([], settings)
  for (var i = 0; i < 20; i++) {
    t.equals(chart.makePlot({key: "foo" + i, subkey: "mean"}).color, COLORS[i % COLORS.length])
  }
  t.end()
})



test("Chart#keyToID", function(t) {
  var chart = new Chart(["foo", "bar", "qqq"], settings)
  t.equals(chart.keyToID("foo"), "foo@count")
  t.equals(chart.keyToID("foo@mean"), "foo@mean")
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function makeSettings(settings) {
  return lodash.defaults(settings,
    { subkey:   "count"
    , renderer: "line"
    })
}

function makeSimplePlot(subkey) {
  return { id:    "foo@" + subkey
         , label: subkey
         , type:  "line"
         , x:     "ts"
         , y:     subkey
         , color: KEY_COLORS[subkey]
         , data:  null
         }
}

function makeHeatPlot(key) {
  var subkey = "llquantize"
  return { id:    key + "@" + subkey
         , label: subkey
         , type:  "heat"
         , color: KEY_COLORS[subkey]
         , data:  null
         }
}

function makeManyPlot(mkey, ext) {
  var plot =
    { id:    mkey
    , label: mkey
    , type:  "line"
    , x:     "ts"
    , y:     mkey.split("@")[1]
    , color: COLORS[0]
    , data:  null
    }
  return lodash.extend(plot, ext)
}

function makeFnPlot(fn) {
  return { id:    fn
         , label: fn
         , type:  "line"
         , x:     "ts"
         , y:     "count"
         , color: COLORS[0]
         , data:  null
         }
}
