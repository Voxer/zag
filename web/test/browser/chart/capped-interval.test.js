var test           = require('tap').test
  , CappedInterval = require('../../../client/js/ui/chart2/models/capped-interval')
  , defaultOpts    = {low: 10, high: 100, max: 200}

test("CappedInterval", function(t) {
  var cInt = new CappedInterval(defaultOpts)
    , int  = cInt.interval
  t.equals(cInt.defaultLow, 10)
  t.equals(cInt.defaultHigh, 100)
  t.equals(int.low,  10)
  t.equals(int.high, 100)
  t.equals(int.min,  null)
  t.equals(int.max,  200)
  t.end()
})

test("CappedInterval#resetZoom", function(t) {
  var cInt = new CappedInterval(defaultOpts)
  cInt.zoom(20, 50)
  cInt.resetZoom()
  t.equals(cInt.isZoomed, false)
  t.equals(cInt.interval.low, 10)
  t.equals(cInt.interval.high, 100)
  t.end()
})

test("CappedInterval#setDefaultRange", function(t) {
  var cInt = new CappedInterval(defaultOpts)
  cInt.setDefaultRange(20, 50)
  t.equals(cInt.interval.low, 20)
  t.equals(cInt.interval.high, 50)
  t.equals(cInt.defaultLow, 20)
  t.equals(cInt.defaultHigh, 50)
  t.end()
})

test("CappedInterval#popZoom", function(t) {
  var props = {low: 0, high: 100}
  test("pop without zoom", function(t) {
    var bInt = new CappedInterval(props)
    bInt.popZoom()
    t.equals(bInt.interval.low, 0)
    t.equals(bInt.interval.high, 100)
    t.end()
  })

  test("zoom, pop", function(t) {
    var bInt = new CappedInterval(props)
    bInt.zoom(10, 90)
    t.equals(bInt.interval.low, 10)
    t.equals(bInt.interval.high, 90)
    bInt.popZoom()
    t.equals(bInt.zoomStack.length, 0)
    t.equals(bInt.interval.low, 0)
    t.equals(bInt.interval.high, 100)
    t.end()
  })

  test("zoom, zoom, pop", function(t) {
    var bInt = new CappedInterval(props)
      , z = 0
    bInt.on("zoom", function() { z++ })
    bInt.zoom(10, 90)
    bInt.zoom(20, 80)
    t.equals(z, 2)
    bInt.popZoom()
    t.equals(z, 3)
    t.equals(bInt.interval.low, 10)
    t.equals(bInt.interval.high, 90)
    t.end()
  })

  test("zoom, zoom, pop, pop", function(t) {
    var bInt = new CappedInterval(props)
    bInt.zoom(10, 90)
    bInt.zoom(20, 80)
    bInt.popZoom()
    bInt.popZoom()
    t.equals(bInt.interval.low, 0)
    t.equals(bInt.interval.high, 100)
    t.end()
  })
  t.end()
})
