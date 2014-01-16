var test            = require('tap').test
  , HeatMapPointSet = require('../../../../client/js/ui/chart2/models/point-set/heat')

test("HeatMapPointSet", function(t) {
  var data = [ [2, 1, 5], [4, 100, 3], [6, 5, 2] ]
    , ps   = new HeatMapPointSet({data: data, yMax: 10, dy: 2})
  t.equals(ps.data, data)
  t.equals(ps.dy, 2)
  t.equals(ps.xMin, 2)
  t.equals(ps.xMax, 6)
  t.equals(ps.yMin, 0)
  t.equals(ps.yMax, 10)
  t.end()
})

test("HeatMapPointSet#getX", function(t) {
  var ps = new HeatMapPointSet({data: [], yMax: 10, dy: 2})
  t.equals(ps.getX([3, 2, 1]), 3)
  t.end()
})

test("HeatMapPointSet#setBounds", function(t) {
  var data = [ [2, 1, 5], [4, 100, 3], [6, 5, 2] ]
    , ps   = new HeatMapPointSet({data: data, yMax: 10, dy: 2})

  data.push([8, 200, 1])
  ps.setBounds()
  t.equals(ps.xMin, 2)
  t.equals(ps.xMax, 8)
  t.equals(ps.yMin, 0)
  t.equals(ps.yMax, 10)
  t.end()
})

test("HeatMapPointSet#makePoint", function(t) {
  var ps = new HeatMapPointSet(
      { data:
        [ [2]
        , [ 4
          ,  0, 1, 0
          , 10, 2, 0
          , 20, 3, 0
          , 30, 4, 0
          , 40, 5, 0]
        , [6]
        ]
      , yMax: 100
      , dy:   10
      })
  t.deepEquals(ps.makePoint(1, 27),
    { y:      25
    , label: "20 \u2192 30 (f=3)"
    })
  t.deepEquals(ps.makePoint(1, 31),
    { y:      35
    , label: "30 \u2192 40 (f=4)"
    })
  t.end()
})
