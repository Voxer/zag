var test            = require('tap').test
  , lodash          = require('lodash')
  , ScalingInterval = require('../../../client/js/ui/chart2/models/scaling-interval')

test("ScalingInterval", function(t) {
  var sInt = makeInterval()
  t.deepEquals(sInt.pointsets, [])
  t.equals(sInt.delta, 1)
  t.equals(sInt.lowProp,  "yMin")
  t.equals(sInt.highProp, "yMax")
  t.equals(sInt.pLow,  null)
  t.equals(sInt.pHigh, null)
  t.end()
})

test("ScalingInterval#destroy", function(t) {
  var sInt = makeInterval()
  sInt.destroy()
  t.equals(sInt.pointsets, null)
  t.equals(sInt.interval,  null)
  t.equals(sInt.zoomStack, null)
  t.end()
})


test("ScalingInterval#setDelta", function(t) {
  test("set new value", function(t) {
    var sInt = makeInterval()
    sInt.push({yMin: 0, yMax: 100})
    sInt.zoom(10, 90)
    sInt.setDelta(2)
    t.equals(sInt.isZoomed, false)
    t.equals(sInt.delta, 2)
    t.equals(sInt.interval.low, 0)
    t.equals(sInt.interval.high, 100)
    t.end()
  })

  test("set same value", function(t) {
    var sInt = makeInterval({delta: 5})
    sInt.push({yMin: 0, yMax: 100})
    sInt.zoom(10, 90)
    sInt.setDelta(5)
    t.equals(sInt.isZoomed, true)
    t.equals(sInt.delta, 5)
    t.equals(sInt.interval.low, 10)
    t.equals(sInt.interval.high, 90)
    t.end()
  })

  t.end()
})


test("ScalingInterval#rescale", function(t) {
  test("rescale (no pointsets, default range)", function(t) {
    var sInt = makeInterval()
      , int  = sInt.interval
    sInt.rescale()
    t.equals(int.low,   0); t.equals(int.high, 1)
    t.equals(int.min,   0); t.equals(int.max, 1)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 1)
    t.end()
  })

  test("push, zoom, rescale, remove", function(t) {
    var sInt = makeInterval()
      , int  = sInt.interval
      , set  = {yMin: 1, yMax: 100}
      , z = 0
    sInt.on("zoom", function() { z++ })
    sInt.push(set)
    t.equals(z, 1)
    t.equals(int.low,   0); t.equals(int.high, 100)
    t.equals(int.min,   0); t.equals(int.max, 100)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 100)

    sInt.zoom(20, 80)
    t.equals(z, 2)
    t.equals(int.low,  20); t.equals(int.high, 80)
    t.equals(int.min,   0); t.equals(int.max, 100)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 100)

    sInt.rescale() // does nothing
    t.equals(z, 2)
    t.equals(int.low,  20); t.equals(int.high, 80)
    t.equals(int.min,   0); t.equals(int.max, 100)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 100)
    t.equals(sInt.isZoomed, true)

    sInt.remove(set)
    t.equals(z, 3)
    t.equals(int.low,   0); t.equals(int.high, 1)
    t.equals(int.min,   0); t.equals(int.max, 1)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 1)
    t.equals(sInt.isZoomed, false)
    t.end()
  })

  test("push, push, zoom, remove (RETAIN zoom)", function(t) {
    var sInt  = makeInterval()
      , int   = sInt.interval
      , small = {yMin: 40, yMax: 60}
      , big   = {yMin: 1, yMax: 100}
    sInt.push(small)
    sInt.push(big)
    sInt.zoom(20, 80)
    // Removing this small interval does nothing because the pLow/pHigh range
    // surrounds the zoom.
    sInt.remove(small)

    t.equals(int.low,  20); t.equals(int.high, 80)
    t.equals(int.min,   0); t.equals(int.max, 100)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 100)
    t.equals(sInt.isZoomed, true)
    t.end()
  })

  test("push, push, zoom, remove (ABORT zoom)", function(t) {
    var sInt  = makeInterval()
      , int   = sInt.interval
      , small = {yMin: 40, yMax: 60}
      , big   = {yMin: 1, yMax: 100}
    sInt.push(small)
    sInt.push(big)
    sInt.zoom(20, 80)
    // Removing the larger interval causes the zoom to reset because the zoom
    // is larger than the pLow/pHigh range.
    sInt.remove(big)

    t.equals(int.low,   0); t.equals(int.high, 60)
    t.equals(int.min,   0); t.equals(int.max, 60)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 60)
    t.equals(sInt.isZoomed, false)
    t.end()
  })

  t.end()
})

test("ScalingInterval#resetZoom", function(t) {
  test("no pointsets", function(t) {
    var sInt = makeInterval()
      , int  = sInt.interval
    sInt.resetZoom()
    t.equals(int.low,   0); t.equals(int.high, 1)
    t.equals(int.min,   0); t.equals(int.max, 1)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 1)
    t.end()
  })

  test("push, zoom, resetZoom", function(t) {
    var sInt = makeInterval()
      , int  = sInt.interval
    sInt.push({yMin: 1, yMax: 100})
    sInt.zoom(20, 80)
    t.equals(sInt.isZoomed, true)
    sInt.resetZoom()
    t.equals(sInt.isZoomed, false)
    t.equals(int.low,   0); t.equals(int.high, 100)
    t.equals(int.min,   0); t.equals(int.max, 100)
    t.equals(sInt.pLow, 0); t.equals(sInt.pHigh, 100)
    t.end()
  })

  test("low < 0", function(t) {
    var sInt = makeInterval()
      , int  = sInt.interval
    sInt.push({yMin: -20, yMax: 20})
    t.equals(int.low,   -20); t.equals(int.high, 20)
    t.equals(int.min,   -20); t.equals(int.max, 20)
    t.equals(sInt.pLow, -20); t.equals(sInt.pHigh, 20)
    t.end()
  })

  t.end()
})

test("ScalingInterval#push", function(t) {
  var sInt = makeInterval()
    , pset = {yMin: 1, yMax: 100}
  sInt.push(pset)
  t.equals(sInt.pointsets.length, 1)
  t.equals(sInt.pointsets[0], pset)
  t.equals(sInt.interval.low, 0)
  t.equals(sInt.interval.high, 100)
  t.end()
})

test("ScalingInterval#remove", function(t) {
  var sInt = makeInterval()
    , pset = {yMin: 1, yMax: 100}
  sInt.push(pset)
  sInt.remove(pset)
  t.equals(sInt.pointsets.length, 0)
  t.equals(sInt.interval.low, 0)
  t.equals(sInt.interval.high, 1)
  t.end()
})


test("ScalingInterval#popZoom", function(t) {
  test("setDelta", function(t) {
    var sInt = makeInterval()
    sInt.zoom(10, 90)
    sInt.zoom(20, 80)
    sInt.setDelta(2)
    sInt.on("zoom", function() { t.fail() })
    t.equals(sInt.zoomStack.length, 2)
    sInt.popZoom()
    t.equals(sInt.zoomStack.length, 0)
    t.end()
  })

  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function makeInterval(opts) {
  return new ScalingInterval(
    lodash.extend({pointsets: [], delta: 1, lowProp: "yMin", highProp: "yMax"}, opts))
}
