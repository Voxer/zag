var test       = require('tap').test
  , lodash     = require('lodash')
  , PointChart = require('../../../../client/js/models/chart/point-chart')
  , settings   = makeSettings({})


test("PointChart#destroy", function(t) {
  var pts = new MockPoints({key2: [5]})
    , pc  = new PointChart(pts, ["key1", "key2"], settings)
  pc.destroy()
  t.equals(pc.isDestroyed, true)
  t.equals(pc.mkeys, null)
  t.equals(pc.ptKeys, null)
  t.equals(pc.points, null)
  t.equals(pc.update, null)
  t.equals(pc.ptCounts, null)
  t.end()
})

test("PointChart#plotAdd", function(t) {
  var pts = new MockPoints({key2: [5]})
    , pc  = new PointChart(pts, ["key1", "key2"], settings)

  t.equals(pts.ops.length, 1)
  pc.plotAdd("key3")
  t.equals(pts.ops.length, 2)
  t.deepEquals(pts.ops,
    [ [ "updateKeys"
      , pc.pID
      , { add:    ["key1", "key2"]
        , remove: []
        }
      ]
    , [ "updateKeys"
      , pc.pID
      , { add:    ["key3"]
        , remove: []
        }
      ]
    ])
  t.end()
})

test("PointChart#isDirty", function(t) {
  var pts = new MockPoints({key2: [5]})
    , pc  = new PointChart(pts, ["key1", "key2"], settings)
  t.equals(pc.isDirty(), true)
  t.equals(pc.isDirty(), false)
  pc.mkeys.push("key3")
  t.equals(pc.isDirty(), true)
  t.equals(pc.isDirty(), false)
  pc.mkeys = pc.mkeys.slice(1)
  t.equals(pc.isDirty(), true)
  t.equals(pc.isDirty(), false)

  pts.points.key2.push(6)
  t.equals(pc.isDirty(), true)
  t.equals(pc.isDirty(), false)

  pc.setSubKey("mean")
  t.equals(pc.isDirty(), true)
  t.equals(pc.isDirty(), false)
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function MockPoints(points) {
  this.points = points || {}
  this.ops    = []
}
MockPoints.prototype.addChart = function() {}
MockPoints.prototype.removeChart = function() {}
MockPoints.prototype.getData = function(mkey) { return this.points[mkey] || [] }
MockPoints.prototype.updateKeys = function(id, updates) {
  this.ops.push(["updateKeys", id, updates])
}

function makeSettings(settings) {
  return lodash.defaults(settings,
    { subkey:   "count"
    , renderer: "line"
    })
}
