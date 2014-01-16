var test        = require('tap').test
  , lodash      = require('lodash')
  , LLQPointSet = require('../../../../client/js/ui/chart2/models/point-set/llq')

test("LLQPointSet", function(t) {
  var data = [ [1, 2, 3] ]
    , ps   = new LLQPointSet(
      { data: data
      , base:  10
      , steps: 20
      , rows:  100
      })
  t.ok(ps.data)
  t.equals(ps.origData, data)

  t.equals(ps.base, 10)
  t.equals(ps.steps, 20)
  t.equals(ps.rows, 100)

  t.isa(ps.xMin, "number")
  t.isa(ps.xMax, "number")
  t.isa(ps.yMin, "number")
  t.isa(ps.yMax, "number")
  t.isa(ps.dy, "number")
  t.end()
})

test("LLQPointSet#destroy", function(t) {
  var ps   = makeLLQ()
    , heat = ps.heat
  t.ok(ps.heat)
  t.ok(ps.origData)
  t.ok(ps.data)
  t.ok(ps.getX)
  t.ok(heat.points)

  ps.destroy()
  t.notOk(ps.heat)
  t.notOk(ps.origData)
  t.notOk(ps.data)
  t.notOk(ps.getX)
  t.notOk(heat.points) // .destroy() the heat map
  t.end()
})

test("LLQPointSet#setData", function(t) {
  var ps  = makeLLQ({data: [[1, 2, 3]]})
    , pts =
      [ [0, 2, 1, 4, 3]
      , [1, 2, 3, 4, 1]
      ]
  ps.setData(pts)
  t.equals(ps.origData, pts)
  t.equals(ps.xMin, 0)
  t.equals(ps.xMax, 1)
  t.equals(ps.yMin, 0)
  t.isa(ps.yMax, "number")
  t.equals(ps.data.length, 2)
  t.equals(ps.data[0][0], 0)
  t.equals(ps.data[1][0], 1)

  t.end()
})

test("LLQPointSet#setRows", function(t) {
  var ps  = makeLLQ({})
    , pts = ps.data
  ps.setRows(5)
  t.notEquals(ps.data, pts)
  t.equals(ps.rows, 5)
  t.end()
})

test("LLQPointSet#setRows ignore duplicate", function(t) {
  var ps  = makeLLQ({rows: 10})
    , pts = ps.data
  ps.setRows(10)
  t.equals(ps.data, pts)
  t.equals(ps.rows, 10)
  t.end()
})


function makeLLQ(opts) {
  var defaultOps =
    { data:  [[1, 2, 3]]
    , base:  10
    , steps: 20
    , rows:  100
    }
  return new LLQPointSet(lodash.extend(defaultOps, opts))
}
