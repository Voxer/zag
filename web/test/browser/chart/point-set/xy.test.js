var test       = require('tap').test
  , XYPointSet = require('../../../../client/js/ui/chart2/models/point-set/xy')

test("XYPointSet", function(t) {
  var data = []
    , ps   = new XYPointSet({data: data, x: "xx", y: "yy"})
  t.equals(ps.data, data)
  t.equals(ps.xAttr, "xx")
  t.equals(ps.yAttr, "yy")
  t.end()
})

test("XYPointSet#setBounds", function(t) {
  var ps = new XYPointSet(
    { data: [{a: 1, b: 2}, {a: 3, b: 4}, {a: 5, b: 6}]
    , x: "a"
    , y: "b"
    })
  t.equals(ps.xMin, 1)
  t.equals(ps.xMax, 5)
  t.equals(ps.yMin, 0)
  t.equals(ps.yMax, 6)

  ps.data.push({a: 7, b: 4})
  ps.setBounds()
  t.equals(ps.xMin, 1)
  t.equals(ps.xMax, 7)
  t.equals(ps.yMin, 0)
  t.equals(ps.yMax, 6)
  t.end()
})


test("XYPointSet#makePoint", function(t) {
  var ps = new XYPointSet(
    { data: [{a: 1, b: 2}, {a: 3, b: 4}, {a: 5, b: 6}]
    , x: "a"
    , y: "b"
    })
  t.deepEquals(ps.makePoint(0, 0),
    { y:     2
    , label: 2
    })
  t.end()
})

test("XYPointSet#getLabel", function(t) {
  var ps = new XYPointSet(
    { data: [{a: 1, b: 2}, {a: 3, b: 4}, {a: 5, b: 6}]
    , x: "a"
    , y: "b"
    })
  t.equals(ps.getLabel(0), 2)
  t.equals(ps.getLabel(1), 4)
  t.end()
})
