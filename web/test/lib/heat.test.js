var test       = require('tap').test
  , llquantize = require('llquantize')
  , HeatMap    = require('../../lib/heat')

test("HeatMap", function(t) {
  var pts = []
    , hm  = new HeatMap(10, 5, pts, 20)
  t.equals(hm.base, 10)
  t.equals(hm.steps, 5)
  t.equals(hm.points, pts)
  t.equals(hm.rows, 20)
  t.end()
})

test("HeatMap#destroy", function(t) {
  var hm = new HeatMap(10, 20, [], 10)
  t.ok(hm.points)
  hm.destroy()
  t.equals(hm.points, null)
  t.end()
})

test("HeatMap#getColumns", function(t) {
  var hm = new HeatMap(10, 20,
    [ [123, 20, 5, 30, 10, 40, 10]
    ], 20)
  hm._setYMax(100)
  t.deepEquals(hm.getColumns(),
    [ [ 123
      , 20, 5,  0.5
      , 30, 10, 1.0
      , 40, 10, 1.0
      ]
    ])
  t.end()
})


/// HeatMap#getColumn
;[{ desc: "steps=rows"
  , base: 10, steps: 20, rows: 20, yMax: 100
  , points:
    [ 123
    , 20,  5
    , 30, 10
    , 40,  5
    , 45, 10
    , 50,  5
    , 55,  5
    ]
  , result:
    [ 123
    , 20,  5, 0
    , 30, 10, 0
    , 40,  5, 0
    , 45, 10, 0
    , 50,  5, 0
    , 55,  5, 0
    ]
  }
, { desc: "merge: ~4 points/cell, steps>rows"
  , base: 10, steps: 20, rows: 5, yMax: 100
  , points:
    [ 123
    , 20,  5 // 20
    , 30, 10 //  .
    , 40,  5 // 40
    , 45,  5 //  .
    , 50,  2 //  .
    , 55,  3 //  .
    , 60,  5 // 60
    , 65,  5 //  .
    ]
  , result:
    [ 123
    , 20, 15, 0
    , 40, 15, 0
    , 60, 10, 0
    ]
  }
, { desc: "split: 2 cells/point, steps<rows"
  , base: 10, steps: 5, rows: 10, yMax: 100
  , points:
    [ 123
    , 20, 2, 40, 2, 60, 4, 80, 2
    ]
  , result:
    [ 123
    , 20, 1, 0, 30, 1, 0
    , 40, 1, 0, 50, 1, 0
    , 60, 2, 0, 70, 2, 0
    , 80, 1, 0, 90, 1, 0
    ]
  }
].forEach(function(T) {
  test("HeatMap#getColumn " + T.desc, function(t) {
    var hm = new HeatMap(T.base, T.steps, [T.points], T.rows)
    hm._setYMax(T.yMax)
    t.deepEquals(hm.getColumn(0), T.result)
    t.end()
  })
})


;[{ desc: "steps=rows"
  , steps: 10, rows: 10
  , map: // step : [cell, pct, ...]
    { 1:  [0, 1.0], 2: [0, 1.0], 3: [0, 1.0]
    , 4:  [0, 1.0], 5: [0, 1.0], 6: [0, 1.0]
    , 7:  [0, 1.0], 8: [0, 1.0], 9: [0, 1.0]
    , 10: [10, 1.0]
    , 20: [20, 1.0]
    , 30: [30, 1.0]
    , 200:
      [ 200, 0.1, 210, 0.1, 220, 0.1, 230, 0.1, 240, 0.1
      , 250, 0.1, 260, 0.1, 270, 0.1, 280, 0.1, 290, 0.1
      ]
    }
  }
, { desc: "steps>rows"
  , steps: 20, rows: 10
  , map:
    { 1: [0, 1.0], 2: [0, 1.0], 9: [0, 1.0]
    , 10: [10, 1.0], 15: [10, 1.0]
    , 20: [20, 1.0], 25: [20, 1.0]
    , 30: [30, 1.0], 35: [30, 1.0]
    , 40: [40, 1.0], 45: [40, 1.0]
    , 200: [200, 0.2, 210, 0.2, 220, 0.2, 230, 0.2, 240, 0.2]
    }
  }
, { desc: "steps<rows"
  , steps: 5, rows: 10
  , map:
    { 1: [0, 1.0], 7: [0, 1.0]
    , 20: [20, 0.5, 30, 0.5]
    , 40: [40, 0.5, 50, 0.5]
    , 60: [60, 0.5, 70, 0.5]
    , 80: [80, 0.5, 90, 0.5]
    , 200:
      [ 200, 0.05, 210, 0.05, 220, 0.05, 230, 0.05, 240, 0.05
      , 250, 0.05, 260, 0.05, 270, 0.05, 280, 0.05, 290, 0.05
      , 300, 0.05, 310, 0.05, 320, 0.05, 330, 0.05, 340, 0.05
      , 350, 0.05, 360, 0.05, 370, 0.05, 380, 0.05, 390, 0.05
      ]
    }
  }
, { desc: "weird offset"
  , steps: 10, rows: 3
  , map:
    { 1: [0, 1.0], 2: [0, 1.0], 9: [0, 1.0]
    , 10: [0, 1.0]
    , 20: [0, 1.0]
    , 30: [0, 1/3, 100/3, 2/3]
    , 40: [100/3, 1.0]
    , 50: [100/3, 1.0]
    , 60: [100/3, 2/3, 200/3, 1/3]
    , 70: [200/3, 1.0]
    , 80: [200/3, 1.0]
    , 90: [200/3, 1.0]
    , 300: [300, 1/3, 300 + 100/3, 1/3, 300 + 200/3, 1/3]
    }
  }
].forEach(function(T) {
  test("HeatMap#stepToCells " + T.desc, function(t) {
    var hm    = new HeatMap(T.base || 10, T.steps, [], T.rows)
      , cases = T.map
    hm._setYMax(T.yMax || 100)
    Object.keys(cases).forEach(function(step) {
      var expect = cases[step]
        , cells  = hm.stepToCells(+step)
      t.equals(cells.length, expect.length)
      // floating points, close enough
      for (var i = 0; i < expect.length; i++) {
        if (cells[i].toFixed(10) !== expect[i].toFixed(10)) {
          t.fail("expected: " + JSON.stringify(cells) + " === " + JSON.stringify(expect))
          break
        }
      }
    })
    t.end()
  })
})


test("HeatMap#getYMax", function(t) {
  t.equals((new HeatMap(10, 5,
    [ [0, 1, 2, 3, 4, 5, 6, 7, 8]
    , [1, 2, 3, 4, 5, 6, 7, 80, 9]
    , [2, 3, 4, 5, 6, 7, 8, 9, 10]
    ], 10)).getYMax(), 80 + 20)
  t.end()
})

test("HeatMap#getCellHeight", function(t) {
  var hm = new HeatMap(10, 20, [ [0, 30, 1] ], 10)
  t.equals(hm.getCellHeight(), (30 + (100 / 20)) / 10)
  t.end()
})

test("HeatMap#getStepHeight", function(t) {
  var hm10 = new HeatMap(10, 10, [], 99)
  t.equals(hm10.getStepHeight(2), 1)
  t.equals(hm10.getStepHeight(16), 10)
  t.equals(hm10.getStepHeight(56), 10)
  t.equals(hm10.getStepHeight(101), 100)

  var hm5 = new HeatMap(10, 5, [], 99)
  t.equals(hm5.getStepHeight(16), 20)
  t.equals(hm5.getStepHeight(45), 20)
  t.equals(hm5.getStepHeight(77), 20)

  var hm20 = new HeatMap(10, 20, [], 99)
  t.equals(hm20.getStepHeight(96), 5)
  t.equals(hm20.getStepHeight(356), 50)

  var hm16 = new HeatMap(2, 16, [], 99)
  t.equals(hm16.getStepHeight(65), 8)
  t.equals(hm16.getStepHeight(127), 8)

  t.end()
})

test("HeatMap.quantile", function(t) {
  var q = function(n) { return HeatMap.quantile(n, 2) }
  t.equals(q(0), 0)
  t.equals(q(3), 1)
  t.equals(q(4), 2)
  t.equals(q(7), 2)
  t.equals(q(8), 3)
  t.equals(q(15), 3)
  t.equals(q(260), 8)

  var q10 = function(n) { return HeatMap.quantile(n, 10) }
  t.equals(q10(1), 0)
  t.equals(q10(10), 1)
  t.equals(q10(100), 2)
  t.equals(q10(1000), 3)
  t.equals(q10(10000), 4)
  t.end()
})

test("HeatMap.rankGradient", function(t) {
  var rank = HeatMap.rankGradient
  t.deepEquals(rank([[123]]), [[123]])
  t.deepEquals(rank( // simple
    [[ 123
    , 1, 10, 0
    , 2, 15, 0
    ]]),
    [[ 123
    , 1, 10, 0.5
    , 2, 15, 1.0
    ]])
  t.deepEquals(rank( // uniques dont count
    [[123, 1, 10,   0, 2, 15,   0, 3, 10,   0]]),
    [[123, 1, 10, 0.5, 2, 15, 1.0, 3, 10, 0.5]])
  t.deepEquals(rank(
    [[123, 1, 10,   0, 2, 15,   0, 3, 5,   0]]),
    [[123, 1, 10, 2/3, 2, 15, 1.0, 3, 5, 1/3]])
  t.end()
})

test("HeatMap.columnFrequencies", function(t) {
  var freqs = HeatMap.columnFrequencies
  t.deepEquals(freqs([[1]]), [])
  t.deepEquals(freqs([[1, 2, 3, 0]]), [3])
  t.deepEquals(freqs([[1, 2, 3, 0, 4, 5, 0, 6, 7, 0]]), [3, 5, 7])
  t.deepEquals(freqs([[1, 2, 3, 0, 4, 7, 0, 6, 5, 0]]), [3, 7, 5])
  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// XXX
function flattenLLQ(objs) {
  var points = []
  for (var i = 0; i < objs.length; i++) {
    var obj     = objs[i]
      , column  = [obj.ts]
      , buckets = Object.keys(obj.llq)
    for (var b = 0; b < buckets.length; b++) {
      var bucket = buckets[b]
        , freq   = obj.llq[bucket]
      column.push(+bucket)
      column.push(freq)
    }
    points.push(column)
  }
  return points
}
