var test            = require('tap').test
  , CappedInterval  = require('../../../client/js/ui/chart2/models/capped-interval')
  , ScalingInterval = require('../../../client/js/ui/chart2/models/scaling-interval')
  , BoundedPoints   = require('../../../client/js/ui/chart2/models/bounded-points')

test("BoundedPoints", function(t) {
  var xInt = makeXInterval()
    , bPts = new BoundedPoints(xInt, 1)
  t.deepEquals(bPts.pointsets, [])
  t.equals(bPts.xInterval, xInt)
  t.isa(bPts.yInterval, ScalingInterval)
  t.equals(bPts.yInterval.delta, 1)
  t.end()
})

test("BoundedPoints.xInterval", function(t) {
  var xInt = BoundedPoints.xInterval(
    { max: 1000
    , low:  400
    , high: 500
    })
  t.isa(xInt, CappedInterval)
  t.equals(xInt.interval.max, 1000)
  t.equals(xInt.interval.low, 400)
  t.equals(xInt.interval.high, 500)
  t.end()
})

test("BoundedPoints#destroy", function(t) {
  var xInt = makeXInterval()
    , bPts = new BoundedPoints(xInt, 1)
    , yInt = bPts.yInterval
  bPts.destroy()
  t.equals(bPts.pointsets, null)
  t.equals(bPts.xInterval, null)
  t.equals(bPts.yInterval, null)
  t.ok(xInt.interval) // dont destroy X
  t.equals(yInt.pointsets, null) // recursive destroy Y
  t.end()
})

test("BoundedPoints#panBy", function(t) {
  test("move X only", function(t) {
    var xInt = makeXInterval()
      , bPts = new BoundedPoints(xInt, 1)
      , yInt = bPts.yInterval
      , x = 0
    xInt.on("pan:move", function() { x++ })
    yInt.on("pan:move", function() { t.fail() })
    bPts.panBy(4, 0)
    t.equals(x, 1)
    t.end()
  })

  test("move Y only", function(t) {
    var bPts = new BoundedPoints(makeXInterval(), 1)
      , yInt = bPts.yInterval
    bPts.push({yMin:  0, yMax: 60})
    bPts.push({yMin: 40, yMax: 100})
    yInt.zoom(80, 90)
    yInt.panBy(20)
    t.equals(yInt.interval.low,  90)
    t.equals(yInt.interval.high, 100)
    t.end()
  })

  t.end()
})

test("BoundedPoints#panDone", function(t) {
  var xInt = makeXInterval()
    , bPts = new BoundedPoints(xInt, 1)
    , yInt = bPts.yInterval
    , x = 0
  xInt.on("pan:done", function() { x++ })
  yInt.on("pan:done", function() { t.fail() })
  bPts.panBy(4, 0)
  bPts.panDone()
  t.equals(x, 1)
  t.end()
})

test("BoundedPoints#push", function(t) {
  var bPts = makeBPoints()
    , yInt = bPts.yInterval.interval
  // Initial range.
  bPts.push({yMin: 20, yMax: 80})
  t.equals(yInt.low, 0) // 0 is the highest low
  t.equals(yInt.high, 80)
  // Subset: no change.
  bPts.push({yMin: 20, yMax: 70})
  t.equals(yInt.low, 0)
  t.equals(yInt.high, 80)
  // Extend right
  bPts.push({yMin: 20, yMax: 90})
  t.equals(yInt.low, 0)
  t.equals(yInt.high, 90)
  // Extend left
  bPts.push({yMin: -10, yMax: 90})
  t.equals(yInt.low, -10)
  t.equals(yInt.high, 90)
  t.end()
})

test("BoundedPoints#remove", function(t) {
  var bPts   = makeBPoints()
    , yInt   = bPts.yInterval.interval
    , medium = {yMin:  20, yMax: 80}
    , right  = {yMin:  20, yMax: 90}
    , left   = {yMin: -10, yMax: 50}
  bPts.push(medium)
  bPts.push(right)
  bPts.push(left)

  bPts.remove(right)
  t.equals(yInt.low, -10)
  t.equals(yInt.high, 80)
  bPts.remove(left)
  t.equals(yInt.low,  0)
  t.equals(yInt.high, 80)
  t.equals(yInt.min,  0)
  t.equals(yInt.max,  80)
  t.end()
})

test("BoundedPoints#rescale", function(t) {
  test("modify", function(t) {
    var bPts  = makeBPoints()
      , yInt  = bPts.yInterval.interval
      , range = {yMin: 10, yMax: 20}
    bPts.push(range)
    t.equals(yInt.low, 0)
    t.equals(yInt.high, 20)
    range.yMax = 30
    t.equals(yInt.high, 20)
    bPts.rescale()
    t.equals(yInt.high, 30)
    t.end()
  })

  // Simulate 'histkeys', which removes all PlotSets,
  // then adds them all back (with 1 extra or missing).
  test("histkeys", function(t) {
    var bPts = makeBPoints()
      , yInt = bPts.yInterval.interval
      , set1 = {yMin: 5,  yMax: 50}
      , set2 = {yMin: 10, yMax: 100}
    bPts.push(set1)
    bPts.push(set2)
    t.equals(yInt.min, 0)
    t.equals(yInt.max, 100)
    t.equals(yInt.low, 0)
    t.equals(yInt.high, 100)
    bPts.remove(set1)
    bPts.remove(set2)
    t.equals(yInt.min, 0)
    t.equals(yInt.max, 1)
    t.equals(yInt.low, 0)
    t.equals(yInt.high, 1)
    t.end()
  })

  t.end()
})

test("BoundedPoints#setDelta", function(t) {
  var xInt = makeXInterval()
    , bPts = new BoundedPoints(xInt, 1)
    , yInt = bPts.yInterval
  bPts.setDelta(2)
  t.notOk(xInt.delta, undefined)
  t.equals(yInt.delta, 2)
  t.end()
})

test("BoundedPoints#popZoom", function(t) {
  test("no pop", function(t) {
    var bPts = makeBPoints()
    bPts.xInterval.on("zoom", function() { t.fail() })
    bPts.yInterval.on("zoom", function() { t.fail() })
    bPts.popZoom()
    t.end()
  })

  test("pop x", function(t) {
    var bPts = makeBPoints()
      , z = 0
    bPts.xInterval.zoom(10, 20)
    bPts.xInterval.on("zoom", function() { z++ })
    bPts.yInterval.on("zoom", function() { t.fail() })
    bPts.popZoom()
    bPts.popZoom() // the second time should do nothing
    t.equals(z, 1)
    t.end()
  })

  test("pop y", function(t) {
    var bPts = makeBPoints()
      , z = 0
    bPts.yInterval.zoom(10, 20)
    bPts.xInterval.on("zoom", function() { t.fail() })
    bPts.yInterval.on("zoom", function(low, high) {
      t.equals(low, 0)
      t.equals(high, 1)
      z++
    })
    bPts.popZoom()
    bPts.popZoom() // the second time should do nothing
    t.equals(z, 1)
    t.end()
  })

  test("pop most recent (x)", function(t) {
    var bPts = makeBPoints()
      , z = 0
    bPts.yInterval.zoom(100, 200)
    bPts.xInterval.zoom(10, 20)
    bPts.xInterval.on("zoom", function() { z++ })
    bPts.yInterval.on("zoom", function() { t.fail() })
    bPts.popZoom()
    t.equals(z, 1)
    t.end()
  })

  test("pop most recent (y)", function(t) {
    var bPts = makeBPoints()
      , z = 0
    bPts.xInterval.zoom(10, 20)
    bPts.yInterval.zoom(100, 200)
    bPts.xInterval.on("zoom", function() { t.fail() })
    bPts.yInterval.on("zoom", function() { z++ })
    bPts.popZoom()
    t.equals(z, 1)
    t.end()
  })

  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function makeXInterval() { return BoundedPoints.xInterval({}) }

function makeBPoints() {
  return new BoundedPoints(makeXInterval(), 1)
}
