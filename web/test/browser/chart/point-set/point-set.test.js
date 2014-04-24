var test     = require('tap').test
  , PointSet = require('../../../../client/js/ui/chart2/models/point-set/point-set')

test("PointSet", function(t) {
  var data = []
    , ps   = new PointSet({data: data, getX: getX})
  t.equals(ps.data, data)
  t.equals(ps.getX, getX)
  t.equals(ps.xMin, null)
  t.equals(ps.xMax, null)
  t.equals(ps.yMin, null)
  t.equals(ps.yMax, null)
  t.end()

  function getX() {}
})

test("PointSet#destroy", function(t) {
  var ps = new PointSet({data: [], getX: function() {}})
  t.ok(ps.data)
  t.ok(ps.getX)
  ps.destroy()
  t.equals(ps.data, null)
  t.equals(ps.getX, null)
  t.end()
})

test("PointSet#prepare", function(t) {
  var ps = new PointSet({data: []})
  ps.prepare()
  t.end()
})

test("PointSet#setData", function(t) {
  var data = []
    , ps   = new PointSet({data: []})
  ps.setData(data)
  t.equals(ps.data, data)
  t.end()
})

test("PointSet#findPoint", function(t) {
  var ps = new PointSet({ data: [[0, 1], [2, 3], [4, 5]] })
  ps.getX = function(pair) { return pair[0] }
  ps.makePoint = function(index, y) { return {index: index, y: y} }

  t.deepEquals(ps.findPoint(2, 0), {index: 1, y: 0})
  // Nonexistant timestamp
  t.equals(ps.findPoint(1, 0), null)
  t.end()
})

test("PointSet#xToIndexApprox", function(t) {
  var ps = new PointSet({data: [ [0, 1], [2, 3], [4, 5], [6, 7] ]})
  ps.getX = function(pt) { return pt[0] }

  // Exact
  t.equals(ps.xToIndexApprox(0), 0)
  t.equals(ps.xToIndexApprox(2), 1)
  t.equals(ps.xToIndexApprox(4), 2)
  t.equals(ps.xToIndexApprox(6), 3)

  // Extremes round
  t.equals(ps.xToIndexApprox(-10), 0)
  t.equals(ps.xToIndexApprox(10), 3)

  // Approximate
  t.equals(ps.xToIndexApprox(1.6), 1) // under
  t.equals(ps.xToIndexApprox(4.2), 2) // over

  t.end()
})

test("PointSet#xToIndexApprox duplicate X", function(t) {
  var ps = new PointSet({data: [ [0, 1], [2, 3], [2, 3], [2, 3], [2, 3], [4, 5], [6, 7] ]})
  ps.getX = function(pt) { return pt[0] }

  // Exact
  t.equals(ps.xToIndexApprox(0), 0)
  t.equals(ps.xToIndexApprox(6), 6)

  t.end()
})

test("PointSet#xToIndexApprox empty", function(t) {
  var ps = new PointSet({data: []})
  ps.getX = function() { t.fail() }
  t.equals(ps.xToIndexApprox(10), -1)
  t.end()
})

test("PointSet#xToIndexExact", function(t) {
  var ps = new PointSet({data: [ [0, 1], [2, 3], [4, 5], [6, 7] ]})
  ps.getX = function(pt) { return pt[0] }

  // Exact
  t.equals(ps.xToIndexExact(0), 0)
  t.equals(ps.xToIndexExact(2), 1)
  t.equals(ps.xToIndexExact(4), 2)
  t.equals(ps.xToIndexExact(6), 3)

  // Misses
  t.equals(ps.xToIndexExact(-1), -1) // under first
  t.equals(ps.xToIndexExact(10), -1) // over last
  t.equals(ps.xToIndexExact(1), -1) // between

  t.end()
})

test("PointSet#xToIndexExact empty", function(t) {
  var ps = new PointSet({data: []})
  ps.getX = function() { t.fail() }
  t.equals(ps.xToIndexExact(10), -1)
  t.end()
})


function pt(x, y) { return {x: x, y: y} }
