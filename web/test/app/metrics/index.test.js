var test          = require('tap').test
  , MetricsLoader = require('../../../app/metrics')
  , helpers       = require('./helpers')
  , makeEmpty     = helpers.makeEmpty
  , makeCounter   = helpers.makeCounter
  , makeHistogram = helpers.makeHistogram
  , makeLLQ       = helpers.makeLLQ

test("MetricsLoader", function(t) {
  var ml = new MetricsLoader(loadRaw, writeCache, [1, 55, 5])
  t.equals(ml.loadRaw, loadRaw)
  t.equals(ml.writeCache, writeCache)
  t.deepEquals(ml.levels, [1, 5, 55])
  t.deepEquals(ml.levelDownMap, {1: null, 5: 1, 55: 5})
  t.equals(ml.minLevel, 1)
  t.end()

  function loadRaw() { t.fail() }
  function writeCache() { t.fail() }
})

test("MetricsLoader#load (err)", function(t) {
  var ml    = new MetricsLoader(loadRaw, fail(t), [1, 2, 5])
    , error = new Error("broken")
    , count = 0

  ml.load("keyC", {start: 1, end: 2, delta: 2}, function(err, points, type) {
    t.equals(err, error)
    t.notOk(points)
    t.notOk(type)
    t.end()
  })

  function loadRaw(key, delta, intervals, callback) {
    if (count++) t.fail()
    process.nextTick(function() { callback(error) })
  }
})

test("MetricsLoader#load cascade", function(t) {
  var points1 = allPoints.keyC
  var points2 =
    [ makeCounter(0, 2), makeCounter(2, 10), makeCounter(4, 18)
    , makeCounter(6, 4), makeCounter(8, 12), makeCounter(10, 20)
    ]
  var points6 = [makeCounter(0, 30), makeCounter(6, 36)]

  test_cascade("delta=1",
    { start: 2, end: 4, delta: 1
    , result: points1.slice(2, 5)
    })

  test_cascade("no points at initial delta",
    { start: 1, end: 7, delta: 6
    , result: points6
    , cacheR: {"0,10@2": [], "0,6@6": []}
    , cacheW:
      { 2: points2
      , 6: points6
      }
    })

  test_cascade("misses cache, writes cache",
    { start: 2, end: 5, delta: 2
    , result: points2.slice(1, 3)
    , cacheR: {"2,4@2": []}
    , cacheW: {2: points2.slice(1, 3)}
    })

  test_cascade("total cache hit",
    { start: 2, end: 5, delta: 2
    , result: points2.slice(1, 3)
    , cacheR: {"2,4@2": points2.slice(1, 3)}
    })

  test_cascade("partial cache hit",
    { start: 0, end: 6, delta: 6
    , result: points6
    , cacheR:
      { "0,10@2": points2.slice(3)
      , "0,6@6": []
      }
    , cacheW:
      { 2: points2.slice(0, 3)
      , 6: points6
      }
    })

  test_cascade("write an empty point",
    { start: 11, end: 12, delta: 2
    , result: [points2[5], makeEmpty(12)]
    , cacheR: {"10,12@2": []}
    , cacheW: {2: [points2[5], makeEmpty(12)]}
    })

  test_cascade("write all empty points",
    { start: 20, end: 23, delta: 2
    , result: [makeEmpty(20), makeEmpty(22)]
    , cacheR: {"20,22@2": []}
    , cacheW: {2: [makeEmpty(20), makeEmpty(22)]}
    })

  test_cascade("read empty points",
    { start: 1, end: 2, delta: 2
    , result: [makeEmpty(0), makeEmpty(2)]
    , cacheR: {"0,2@2": [makeEmpty(0), makeEmpty(2)]}
    })

  test_cascade("read non-level delta",
    { start: 1, end: 3, delta: 10
    , cacheR: {"0,8@2": []}
    , cacheW: {2: points2.slice(0, 5)}
    , result: [makeCounter(0, 46)]
    })

  t.end()

  function test_cascade(desc, T) {
    T.cacheR = T.cacheR || {}
    T.cacheW = T.cacheW || {}
    test(desc, function(t) {
      var ml   = new MetricsLoader(loadRaw, writeCache, [1, 2, 6])
        , done = plan(_done, 1 + Object.keys(T.cacheW).length)

      ml.load("keyC", {start: T.start, end: T.end, delta: T.delta}, function(err, points, type) {
        if (err) throw err
        t.deepEquals(points, T.result)
        t.deepEquals(T.cacheR, {})
        t.equals(type, "counter")
        done()
      })

      function loadRaw(key, delta, intervals, callback) {
        t.equals(key, "keyC")
        t.equals(intervals.length, 1)
        if (delta === 1) return loadPoints.apply(null, arguments)
        var intv     = intervals[0]
          , cacheKey = intv.start + "," + intv.end + "@" + delta
          , cachePts = T.cacheR[cacheKey]
        if (!cachePts) t.fail()
        delete T.cacheR[cacheKey]
        callback(null, cachePts)
      }

      function writeCache(key, delta, points, callback) {
        t.equals(key, "keyC")
        t.deepEquals(points, T.cacheW[delta])
        delete T.cacheW[delta]
        done()
      }

      function _done() {
        t.deepEquals(T.cacheW, {})
        t.end()
      }
    })
  }
})


test("MetricsLoader#load histogram, delta>1", function(t) {
  var ml = new MetricsLoader(loadPoints, writePoints, [1, 2, 5])
  ml.load("keyH", {start: 1, end: 2, delta: 2}, function(err, points, type) {
    if (err) throw err
    t.deepEquals(points,
      [ makeHistogram(0, 1, 17, 2)
      , makeHistogram(2, 5, 13, 6)
      ])
    t.equals(type, "histogram");
    t.end()
  })
})

test("MetricsLoader#load llquantize, delta>1", function(t) {
  var ml = new MetricsLoader(loadPoints, writePoints, [1, 2, 5])
  ml.load("keyH@llq", {start: 1, end: 2, delta: 2}, function(err, points, type) {
    if (err) throw err
    t.deepEquals(points,
      [ [0, 1, 2, 2, 3]
      , [2, 3, 4, 4, 5]
      ])
    t.equals(type, "llquantize");
    t.end()
  })
})

test("MetricsLoader#load llquantize, delta>1, empty range", function(t) {
  var ml = new MetricsLoader(loadPoints, writePoints, [1, 2, 5])
  ml.load("keyH@llq", {start: 10, end: 12, delta: 2}, function(err, points, type) {
    if (err) throw err
    t.deepEquals(points, [[10], [12]])
    t.equals(type, "llquantize");
    t.end()
  })
})

test("MetricsLoader#load nocacheR:true", function(t) {
  var ml = new MetricsLoader(loadRaw, writePoints, [1, 2, 5])

  ml.load("keyC",
  { start:    1
  , end:      2
  , delta:    2
  , nocacheR: true
  }, function(err, points, type) {
    if (err) throw err
    t.deepEquals(points, [makeCounter(0, 2), makeCounter(2, 10)])
    t.equals(type, "counter")
    process.nextTick(function() { t.end() })
  })

  function loadRaw(key, delta, intervals, callback) {
    if (delta !== 1) t.fail()
    loadPoints.apply(null, arguments)
  }
})

test("MetricsLoader#load nocacheW:true", function(t) {
  var ml  = new MetricsLoader(loadPoints, fail(t), [1, 2, 5])
    , pts = [makeCounter(0, 2), makeCounter(2, 10)]
  ml.load("keyC",
  { start:    1
  , end:      2
  , delta:    2
  , nocacheW: true
  }, function(err, points, type) {
    if (err) throw err
    t.deepEquals(points, pts)
    t.equals(type, "counter")
    process.nextTick(function() { t.end() })
  })
})

test("MetricsLoader#load future points", function(t) {
  var ml = new MetricsLoader(loadPoints, fail(t), [1, 2, 5])
  ml.load("keyC",
  { start: Date.now() + 20
  , end:   Date.now() + 50
  , delta: 2
  }, function(err, points, type) {
    if (err) throw err
    t.equals(type, "counter")
    for (var i = 0; i < points.length; i++) {
      t.equals(points[i].empty, true)
    }
    process.nextTick(function() { t.end() })
  })
})


////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

test("MetricsLoader#loadRawCache nocacheR:true dont check the cache", function(t) {
  var ml   = new MetricsLoader(fail(t), writePoints, [5, 10, 100])
  ml.loadRawCache("key",
  { delta:    100
  , nocacheR: true
  }, [{start: 1, end: 5}], function(err, points) {
    if (err) throw err
    t.deepEquals(points, [])
    t.end()
  })
})

test("MetricsLoader#levelDown", function(t) {
  var ml = new MetricsLoader(fail(t), fail(t), [1, 60, 5, 1440])
  // Presets
  t.equals(ml.levelDown(5), 1)
  t.equals(ml.levelDown(60), 5)
  t.equals(ml.levelDown(1440), 60)
  // Custom
  t.equals(ml.levelDown(1500), 60)
  t.equals(ml.levelDown(120), 60)
  t.equals(ml.levelDown(140), 5)
  t.equals(ml.levelDown(125), 5)
  t.equals(ml.levelDown(126), 1)
  t.equals(ml.levelDown(3), 1)
  t.equals(ml.levelDown(2), 1)
  t.end()
})


test("MetricsLoader.mapDown", function(t) {
  var map = MetricsLoader.mapDown
  t.deepEquals(map([]),        {})
  t.deepEquals(map([1]),       {1: null})
  t.deepEquals(map([1, 2]),    {1: null, 2: 1})
  t.deepEquals(map([1, 2, 3]), {1: null, 2: 1, 3: 2})
  t.end()
})

test("MetricsLoader.floor", function(t) {
  var floor = MetricsLoader.floor
  t.equals(floor(5, 2), 4)
  t.equals(floor(10, 10), 10)
  t.equals(floor(10, 5), 10)
  t.equals(floor(14, 5), 10)
  t.end()
})

test("MetricsLoader.identify", function(t) {
  var ident = MetricsLoader.identify
  t.equals(ident({}), null)
  t.equals(ident(makeEmpty(45)), null)
  t.equals(ident(makeCounter(45, 4)), "counter")
  t.equals(ident(makeHistogram(45, 4, 2)), "histogram")
  t.equals(ident(makeLLQ(45, {1: 2, 3: 4})), "llquantize")
  t.end()
})

test("MetricsLoader.resolveType", function(t) {
  var res = MetricsLoader.resolveType
  t.equals(res(null, "counter"), "counter")
  t.equals(res("counter", null), "counter")
  t.equals(res("histogram", "counter"), "histogram")
  t.equals(res("counter", "histogram"), "histogram")
  t.equals(res("llquantize", "counter"), "llquantize")
  t.equals(res("counter", "llquantize"), "llquantize")
  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

var allPoints =
  { keyC:
    [ makeCounter(0, 0), makeCounter(1,  2), makeCounter(2,  4)
    , makeCounter(3, 6), makeCounter(4,  8), makeCounter(5, 10)
    , makeCounter(6, 1), makeCounter(7,  3), makeCounter(8, 5)
    , makeCounter(9, 7), makeCounter(10, 9), makeCounter(11, 11)
    ]
  , keyH:
    [ makeHistogram(0,  0, 9), makeHistogram(1,  2, 8), makeHistogram(2,  4, 7)
    , makeHistogram(3,  6, 6), makeHistogram(4,  8, 5), makeHistogram(5, 10, 4)
    , makeHistogram(6, 12, 3), makeHistogram(7, 14, 2), makeHistogram(8, 16, 1)
    , makeHistogram(9, 18, 0)
    ]
  , "keyH@llq":
    [ makeLLQ(0, {1: 2}), makeLLQ(1, {2: 3}), makeLLQ(2, {3: 4})
    , makeLLQ(3, {4: 5}), makeLLQ(4, {5: 6}), makeLLQ(4, {5: 6})
    ]
  }

function loadPoints(key, delta, intervals, callback) {
  if (delta !== 1) {
    return process.nextTick(function() { callback(null, []) })
  }

  var pointss = []
  for (var i = 0; i < intervals.length; i++) {
    var intv = intervals[i]
    pointss.push(allPoints[key].slice(intv.start, intv.end + 1))
  }

  process.nextTick(function() {
    callback(null, Array.prototype.concat.apply([], pointss))
  })
}

function writePoints(key, delta, points, callback) {
  process.nextTick(callback)
}

function plan(fn, n) {
  return function() {
    if (!--n) fn()
  }
}

function fail(t) {
  return function() { t.fail() }
}
