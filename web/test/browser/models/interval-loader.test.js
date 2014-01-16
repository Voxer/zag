var test           = require('tap').test
  , IntervalLoader = require('../../../client/js/models/interval-loader')
  , Interval       = IntervalLoader.Interval
  , db             = require('./points.json')
  , requests       = 0
  , lastReq        = null

test("IntervalLoader", function(t) {
  var il = new IntervalLoader(fn)
  t.deepEquals(il._load, fn)
  t.deepEquals(il.intervals, {})
  t.end()

  function fn() { }
})

test("IntervalLoader#load simple", function(t) {
  var il = new IntervalLoader(getMetrics)
    , r  = requests
  il.load("foo@1", 2, 4, function(fail, pi) {
    if (fail) throw fail
    t.equals(r + 1, requests)
    t.equals(pi.mkey, "foo@1")
    t.deepEquals(pi.data, [12, 13])
    t.equals(pi.start, 2)
    t.equals(pi.end, 4)
    t.end()
  })
})

test("IntervalLoader#load data with gaps", function(t) {
  var il = new IntervalLoader(getMetrics)
    , r  = requests
  il.load("empty_partial@1", 1, 4, function(fail, pi) {
    if (fail) throw fail
    t.equals(r + 1, requests)
    t.end()
  })
})

test("IntervalLoader#load is cached", function(t) {
  var il = new IntervalLoader(getMetrics)
    , r  = requests
  il.load("foo@1", 2, 4, function(fail, pi) {
    if (fail) throw fail
    t.equals(r + 1, requests)
    t.deepEquals(pi.data, [12, 13])
    // It is cached.
    il.load("foo@1", 2, 4, function(fail, pi2) {
      if (fail) throw fail
      t.equals(r + 1, requests)
      t.deepEquals(pi2.data, [12, 13])
      t.equals(pi2, pi)
      t.end()
    })
  })
})

test("IntervalLoader#load stitch continuous", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.load("foo@1", 2, 4, function(fail, pi) {
    if (fail) throw fail
    t.deepEquals(pi.data, [12, 13])
    il.load("foo@1", 4, 6, function(fail, pi) {
      if (fail) throw fail
      t.deepEquals(pi.data, [12, 13, 14, 15])
      t.equals(pi.start, 2)
      t.equals(pi.end, 6)
      t.end()
    })
  })
})

test("IntervalLoader#load fill gap on the left", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.load("foo@1", 0, 2, function(fail, pi) {
    if (fail) throw fail
    t.deepEquals(pi.data, [10, 11])
    il.load("foo@1", 6, 9, function(fail, pi) {
      if (fail) throw fail
      t.deepEquals(pi.data, [10, 11, 12, 13, 14, 15, 16, 17, 18])
      t.deepEquals(lastReq,
        { start: 2
        , end:   9
        , delta: 1
        })
      t.equals(pi.start, 0)
      t.equals(pi.end, 9)
      t.end()
    })
  })
})

test("IntervalLoader#load fill gap on the right", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.load("foo@1", 6, 9, function(fail, pi) {
    if (fail) throw fail
    t.deepEquals(pi.data, [16, 17, 18])
    il.load("foo@1", 0, 2, function(fail, pi) {
      if (fail) throw fail
      t.deepEquals(pi.data, [10, 11, 12, 13, 14, 15, 16, 17, 18])
      t.deepEquals(lastReq,
        { start: 0
        , end:   6
        , delta: 1
        })
      t.equals(pi.start, 0)
      t.equals(pi.end, 9)
      t.end()
    })
  })
})

test("IntervalLoader#load fill on both sides", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.load("foo@1", 4, 6, function(fail, pi) {
    if (fail) throw fail
    t.deepEquals(pi.data, [14, 15])
    var r = requests
    il.load("foo@1", 0, 9, function(fail, pi) {
      if (fail) throw fail
      t.deepEquals(pi.data, [10, 11, 12, 13, 14, 15, 16, 17, 18])
      t.equals(r + 2, requests)
      t.deepEquals(lastReq,
        { start: 6
        , end:   9
        , delta: 1
        })
      t.equals(pi.start, 0)
      t.equals(pi.end, 9)
      t.end()
    })
  })
})

test("IntervalLoader#load only 1 load() concurrently per key", function(t) {
  var il      = new IntervalLoader(_getMetrics)
    , running = 0

  t.plan(5)
  il.load("foo@1", 2, 4, onLoad)
  il.load("foo@1", 2, 5, onLoad)
  il.load("foo@1", 2, 6, onLoad)
  il.load("foo@1", 2, 5, onLoad)
  il.load("foo@1", 2, 6, onLoad)

  function onLoad(fail, pi) {
    if (fail) throw fail
    t.equals(running, 0)
  }

  function _getMetrics(key, start, end, callback) {
    running++
    getMetrics(key, start, end, function(fail, pi) {
      running--
      callback(fail, pi)
    })
  }
})


test("IntervalLoader#load dont stitch different delta", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.load("foo@1", 2, 4, function(fail, pi) {
    if (fail) throw fail
    t.deepEquals(pi.data, [12, 13])
    il.load("foo@5", 4, 6, function(fail, pi2) {
      if (fail) throw fail
      t.deepEquals(pi2.data, [54, 55])
      t.notEquals(pi2, pi)
      t.equals(pi2.start, 4)
      t.equals(pi2.end, 6)
      t.end()
    })
  })
})


test("IntervalLoader#loadMany", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.loadMany(["foo@1", "bar@1", "qqq@1"], 1, 4, function(fail) {
    if (fail) throw fail
    t.isa(il.get("foo@1"), Interval)
    t.isa(il.get("bar@1"), Interval)
    t.isa(il.get("qqq@1"), Interval)
    t.end()
  })
})

test("IntervalLoader#get", function(t) {
  var il = new IntervalLoader(getMetrics)
  il.load("foo@1", 2, 4, function(fail, pi) {
    if (fail) throw fail
    t.equals(il.get("foo@1"), pi)
    t.end()
  })
})


test("Interval.diff", function(t) {
  var iD = Interval.diff
  // Includes
  t.deepEquals(iD(4, 8, 5, 7), [])
  // Shared edge; no overlap
  t.deepEquals(iD(4, 8, 0, 4), [[0, 4]]) // left
  t.deepEquals(iD(4, 8, 8, 10), [[8, 10]]) // right
  // Shared edge; overlap
  t.deepEquals(iD(4, 8, 0, 8), [[0, 4]]) // shared max
  t.deepEquals(iD(4, 8, 4, 10), [[8, 10]]) // shared min
  // Overlap
  t.deepEquals(iD(4, 8, 0, 6), [[0, 4]]) // extra on left
  t.deepEquals(iD(4, 8, 6, 12), [[8, 12]]) // extra on left
  // Gap
  t.deepEquals(iD(4, 8, 0, 2), [[0, 4]]) // left
  t.deepEquals(iD(4, 8, 12, 14), [[8, 14]]) // right
  // Double-interval
  t.deepEquals(iD(4, 8, 0, 14), [[0, 4], [8, 14]])
  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////


// { mkey : { delta : [points] } }
function getMetrics(key, start, end, callback) {
  requests++
  var split = key.split("@")
    , mkey  = split[0]
    , delta = +split[1]
  lastReq = {start: start, end: end, delta: delta}
  process.nextTick(function() {
    callback(null, db[mkey][delta].slice(start, end))
  })
}
