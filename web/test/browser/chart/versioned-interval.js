var test              = require('tap').test
  , Interval          = require('../../../client/js/ui/chart2/models/interval')
  , VersionedInterval = require('../../../client/js/ui/chart2/models/versioned-interval')

test("VersionedInterval", function(t) {
  var vInt = new VersionedInterval(3, 6, 0, 10, 60)
  t.equals(vInt.delta, 60)
  t.deepEquals(vInt.zoomStack, [])
  t.equals(vInt.isZoomed, false)

  var interval = vInt.interval
  t.isa(interval, Interval)
  t.equals(interval.low, 3)
  t.equals(interval.high, 6)
  t.equals(interval.min, 0)
  t.equals(interval.max, 10)
  t.end()
})

test("VersionedInterval#destroy", function(t) {
  var vInt = new VersionedInterval([], {})
  vInt.destroy()
  t.notOk(vInt.interval)
  t.notOk(vInt.zoomStack)
  t.end()
})

///
/// Interval controls
///

test("VersionedInterval#zoom", function(t) {
  var vInt = new VersionedInterval(0, 20, 0, 20, 5)
    , z = 0

  vInt.on("zoom", function(low, high) {
    t.equals(low, 8)
    t.equals(high, 12)
    z++
  })

  vInt.zoom(8, 12)
  vInt.zoom(8, 12) // the second does nothing
  t.equals(z, 1)
  t.equals(vInt.zoomStack.length, 1)
  t.equals(vInt.isZoomed, true)
  var zoom = vInt.zoomStack[0]
  t.equals(zoom.low, 8)
  t.equals(zoom.high, 12)
  t.equals(zoom.delta, 5)
  t.isa(zoom.clock, "number")

  t.end()
})

test("VersionedInterval#panMove", function(t) {
  var vInt = new VersionedInterval(0, 10, null, null)
    , ev = 0
  vInt.on("pan:move", function(low, high) {
    t.equals(low, 2)
    t.equals(high, 12)
    ev++
  })
  vInt.zoom(0, 10)
  vInt.panMove(2, 12)
  t.equals(ev, 1)
  t.end()
})

test("VersionedInterval#panDone", function(t) {
  var vInt = new VersionedInterval(0, 10, null, null)
    , e = 0
  vInt.on("pan:done", function() { e++ })
  vInt.panBy(1)
  vInt.panDone()
  t.equals(e, 1)
  t.equals(vInt.interval.high, 11)
  t.end()
})

test("VersionedInterval#getZoomClock", function(t) {
  test("null", function(t) {
    var vInt = new VersionedInterval([], {})
    t.equals(vInt.getZoomClock(), null)
    t.end()
  })

  test("Integer", function(t) {
    var vInt = new VersionedInterval([], {})
    vInt.zoom(1, 2)
    var first = vInt.getZoomClock()
    t.isa(first, "number")
    t.equals(first, vInt.zoomStack[0].clock)
    vInt.zoom(2, 4)
    var second = vInt.getZoomClock()
    t.isa(second, "number")
    t.equals(second - first, 1)
    t.equals(second, vInt.zoomStack[1].clock)
    t.end()
  })

  t.end()
})
