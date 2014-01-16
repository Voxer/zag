var test         = require('tap').test
  , PlotSettings = require('../../../client/js/models/plot-settings')

///
/// Constructor
///

test("PlotSettings relative start", function(t) {
  var ps = new PlotSettings({start: "-1h"})
  t.equals(ps.startReal, "-1h")
  t.notOk(ps.endReal)

  t.ok((Date.now() - 1000*60*60) - ps.start < 10)
  t.isa(ps.end, "number")

  t.equals(ps.deltaReal, "auto")
  t.isa(ps.delta, "number")

  t.equals(ps.rate, false)
  t.equals(ps.renderer, "line")
  t.equals(ps.subkey, "count")
  t.isa(ps.histkeys, Array)
  t.end()
})

test("PlotSettings Integer timestamp start", function(t) {
  var start = Date.now() - 1000*60
    , ps    = new PlotSettings({start: start})
  t.equals(ps.startReal, start.toString())
  t.notOk(ps.endReal)

  t.equals(ps.start, start)
  t.isa(ps.end, "number")
  t.end()
})

test("PlotSettings String timestamp start", function(t) {
  var start = Date.now() - 1000*60
    , ps    = new PlotSettings({start: start.toString()})
  t.equals(ps.startReal, start.toString())
  t.notOk(ps.endReal)

  t.equals(ps.start, +start)
  t.isa(ps.start, "number")
  t.isa(ps.end, "number")
  t.end()
})

test("PlotSettings delta", function(t) {
  var ps = new PlotSettings({delta: "1m"})
  t.equals(ps.deltaReal, "1m")
  t.equals(ps.delta, 60000)
  var ps2 = new PlotSettings({delta: "2"})
  t.equals(ps2.deltaReal, "2")
  t.equals(ps2.delta, 2)
  var ps3 = new PlotSettings({delta: 3})
  t.equals(ps3.deltaReal, "3")
  t.equals(ps3.delta, 3)
  t.end()
})

test("PlotSettings rate", function(t) {
  var ps = new PlotSettings({rate: true})
  t.equals(ps.rate, true)
  t.end()
})

test("PlotSettings renderer", function(t) {
  var ps = new PlotSettings({renderer: "stack"})
  t.equals(ps.renderer, "stack")
  t.end()
})

test("PlotSettings subkeys", function(t) {
  var ps = new PlotSettings({subkey: "mean"})
  t.equals(ps.subkey, "mean")
  t.end()
})

test("PlotSettings histkeys", function(t) {
  var ps = new PlotSettings({histkeys: "foo,bar,qqq"})
  t.deepEquals(ps.histkeys, ["foo", "bar", "qqq"])
  t.end()
})

///
/// Setters
///

test("PlotSettings#setRange", function(t) {
  var ps    = new PlotSettings({})
    , end   = Date.now()
    , start = end - 1*60*60*1000
  t.equals(ps.delta, 60 * 60000)
  ps.setRange(start, end)
  t.equals(ps.start, start)
  t.equals(ps.end, end)
  t.equals(ps.delta, 60000)
  t.end()
})

test("PlotSettings#setRangeReal", function(t) {
  var ps    = new PlotSettings({})
    , start = ps.start
  ps.setRangeReal("-6M", null)
  t.equals(ps.startReal, "-6M")
  t.ok(ps.start < start)
  t.equals(ps.delta, 1440 * 60000)
  t.end()
})

test("PlotSettings#setDelta", function(t) {
  var ps = new PlotSettings({})
  t.equals(ps.deltaReal, "auto")
  ps.setDelta("5m")
  t.equals(ps.deltaReal, "5m")
  t.equals(ps.delta, 5 * 60 * 1000)
  t.end()
})

///
/// Other
///

test("PlotSettings#rangeToString", function(t) {
  t.equals((new PlotSettings({start: "-5m"})).rangeToString(),  "5 minutes ago")
  t.equals((new PlotSettings({start: "-1h"})).rangeToString(),  "1 hour ago")
  t.equals((new PlotSettings({start: "-2h"})).rangeToString(),  "2 hours ago")
  t.equals((new PlotSettings({start: "-1d"})).rangeToString(),  "1 day ago")
  t.equals((new PlotSettings({start: "-10M"})).rangeToString(), "10 months ago")
  t.equals((new PlotSettings({start: 1378650389012})).rangeToString(), "2013/09/08 07:26")
  t.equals((new PlotSettings({start: 1378650389012, end: 1383598238883})).rangeToString(),
    "2013/09/08 07:26 \u2013 11/04 12:50")
  t.end()
})

test("PlotSettings#deltaToString", function(t) {
  t.equals((new PlotSettings({delta: "5m"})).deltaToString(), "5m")
  t.equals((new PlotSettings({})).deltaToString(), "60m (auto)")
  t.equals((new PlotSettings({delta: 123})).deltaToString(), "123ms")
  t.end()
})

test("PlotSettings#decode", function(t) {
  var ps       = new PlotSettings({})
    , defaults = ps.decode({})
  t.equals(defaults.deltaReal, "auto")
  t.equals(ps.decode({delta: "5m"}).deltaReal, "5m")

  t.equals(defaults.startReal, "-3d")
  t.equals(ps.decode({start: "-1w"}).startReal, "-1w")

  t.equals(defaults.endReal, null)
  t.equals(ps.decode({end: "-1d"}).endReal, "-1d")

  t.equals(defaults.rate, false)
  t.equals(ps.decode({rate: true}).rate, true)

  t.equals(defaults.nocache, false)
  t.equals(ps.decode({nocache: true}).nocache, true)

  t.equals(defaults.renderer, "line")
  t.equals(ps.decode({renderer: "stack"}).renderer, "stack")

  t.equals(defaults.subkey, "count")
  t.equals(ps.decode({subkey: "mean"}).subkey, "mean")

  t.deepEquals(defaults.histkeys, PlotSettings.HISTOGRAM)
  t.notEquals(defaults.histkeys, PlotSettings.HISTOGRAM)
  t.deepEquals(ps.decode({histkeys: "p95,p99"}).histkeys, ["p95", "p99"])
  t.end()
})
