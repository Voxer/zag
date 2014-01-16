var test              = require('tap').test
  , MetricsAggregator = require('../../lib/aggregator')

function noop() {}

test("MetricsAggregator", function(t) {
  var ma = new MetricsAggregator(noop, 10)
  t.equals(ma.onSave, noop)
  t.deepEquals(ma.metrics, {})
  t.deepEquals(ma.liveKeys, {})
  t.equals(ma.saveDelta, 10)
  t.end(); ma.destroy()
})

test("MetricsAggregator.reKey", function(t) {
  var re = MetricsAggregator.reKey
  var good =
    [ "a", "abc", "ABC"
    , "ab>cd", "ab|cd"
    , "a>b>c", "a>b|c", "a|b|c"
    , "a/b.c"
    , " ", "  "
    , "_-.()+:123456789"
    , "abc@llq"
    ]
  var bad =
    [ ""
    , "\t", "\n", "\r"
    , "A\t", "\tA"
    , "\x00", "a!", "a="
    , "|a", "a|", ">a", "a>", "a||b", "a>|b", "a>>b"
    , "foo@", "bar@ll"
    ]

  for (var i = 0; i < good.length; i++) {
    t.ok(re.test(good[i]), "good: '" + good[i] + "'")
  }
  for (var i = 0; i < bad.length; i++) {
    t.notOk(re.test(bad[i]), "bad: '" + good[i] + "'")
  }
  t.end()
})

test("MetricsAggregator#counter", function(t) {
  test("save none", function(t) {
    var ma = new MetricsAggregator(function(points) {
      t.deepEquals(points, {})
      t.end(); ma.destroy()
    }, 100)
  })

  test("save some", function(t) {
    var ma = new MetricsAggregator(function(points) {
      var ts = points.foo.ts
      t.deepEquals(points,
        { foo: {ts: ts, count: 20}
        , bar: {ts: ts, count: -5}
        })
      process.nextTick(function() {
        t.deepEquals(ma.metrics, {100: {}}) // reset
        t.end(); ma.destroy()
      })
    }, 100)

    ma.counter("foo", 5)
    ma.counter("foo", 15)
    ma.counter("bar", -5)
  })

  test("valid/invalid", function(t) {
    var ma = new MetricsAggregator(function(points) {
      t.deepEquals(Object.keys(points), ["foo"])
      t.equals(points.foo.count, 2)
      t.end(); ma.destroy()
    })
    t.equals(ma.counter("foo", 2), true)
    t.equals(ma.counter("a!b", 2), false)
  })

  t.end()
})

test("MetricsAggregator#histogram", function(t) {
  test("save some", function(t) {
    var ma = new MetricsAggregator(function(points) {
      var ts = points.foo.ts
      t.deepEquals(points,
        { "foo":
          { ts: ts
          , p10: 0
          , mean: 1, median: 1
          , p75: 2, p95: 2, p99: 2, max: 2
          , count: 3
          , std_dev: 1
          }
        , "foo@llq":
          { ts: ts
          , data: {0: 1, 1: 1, 2: 1}
          }
        })
      t.end(); ma.destroy()
    }, 10)

    ma.histogram("foo", 0)
    ma.histogram("foo", 1)
    ma.histogram("foo", 2)
  })

  test("valid/invalid", function(t) {
    var ma = new MetricsAggregator(function(points) {
      t.deepEquals(Object.keys(points), ["foo", "foo@llq"])
      t.equals(points.foo.mean, 2)
      t.end(); ma.destroy()
    })
    t.equals(ma.histogram("foo", 2), true)
    t.equals(ma.histogram("f!o", 2), false)
  })

  t.end()
})

;[{name: "custom delta",  save: 100, live: 20}
, {name: "default delta", save: 20,  live: 20}
].forEach(function(T) {
  test("MetricsAggregator#onKey " + T.name, function(t) {
    var ma = new MetricsAggregator(noop, T.save)
      , i  = 0
    ma.onKey("foo", T.live, function(point) {
      if (i === 0) t.equals(point.count, 1)
      if (i === 1) t.equals(point.count, 2)
      if (i === 2) {
        t.equals(point.count, 3)
        t.end(); ma.destroy()
      }
      ma.counter("foo", ++i + 1)
    })
    ma.counter("foo", 1)
  })

  test("MetricsAggregator#onKey no points; " + T.name, function(t) {
    var ma = new MetricsAggregator(function(points) {
      t.deepEquals(points, {})
      t.end(); ma.destroy()
    }, T.save)
    ma.onKey("foo", T.live, function(point) {
      t.equals(point.key, "foo")
      t.isa(point.ts, "number")
      t.equals(point.empty, true)
      t.equals(point.count, undefined)
    })
  })

  test("MetricsAggregator#onKey heat map; " + T.name, function(t) {
    var ma = new MetricsAggregator(noop, T.save)
    ma.onKey("foo@llq", T.live, function(point) {
      t.equals(point.key, "foo@llq")
      t.isa(point.ts, "number")
      t.deepEquals(point.data, {16: 1})
      t.end(); ma.destroy()
    })
    ma.histogram("foo", 17)
  })

  test("MetricsAggregator#offKey " + T.name, function(t) {
    var ma = new MetricsAggregator(function(points) {
      t.equals(points.foo.count, 1)
      t.end(); ma.destroy()
    }, T.save)
    ma.onKey("foo",  T.live, onPoint)
    ma.offKey("foo", T.live, onPoint)
    ma.counter("foo", 1)
    function onPoint() { t.fail() }
  })

  test("onKey, onKey, offKey", function(t) {
    var ma = new MetricsAggregator(noop, T.save)
    ma.onKey("foo", T.live, fail)
    ma.onKey("foo", T.live, onPoint)
    ma.offKey("foo", T.live, fail)
    ma.counter("foo", 2)

    function fail() { t.fail() }
    function onPoint(point) {
      t.equals(point.count, 2)
      t.end(); ma.destroy()
    }
  })
})
