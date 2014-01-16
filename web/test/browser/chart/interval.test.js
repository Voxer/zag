var test     = require('tap').test
  , Interval = require('../../../client/js/ui/chart2/models/interval')

test("Interval", function(t) {
  var int = new Interval(2, 3, 1, 4)
  t.equals(int.min,  1)
  t.equals(int.low,  2)
  t.equals(int.high, 3)
  t.equals(int.max,  4)
  t.end()
})

test("Interval#setBounds", function(t) {
  var int = new Interval(2, 3, 1, 4)
  int.on("zoom", function() { t.fail() })
  int.setBounds(0, 100)
  t.equals(int.min, 0)
  t.equals(int.max, 100)
  t.end()
})

test("Interval#isInBounds", function(t) {
  t.equals((new Interval(2, 3, 1, 4)).isInBounds(), true)
  t.equals((new Interval(1, 4, 1, 4)).isInBounds(), true)
  t.equals((new Interval(1, 6, 1, null)).isInBounds(), true)
  t.equals((new Interval(-1, 4, null, 4)).isInBounds(), true)
  t.equals((new Interval(1, 4, null, null)).isInBounds(), true)

  t.equals((new Interval(0, 6, 1, null)).isInBounds(), false)
  t.equals((new Interval(-1, 5, null, 4)).isInBounds(), false)
  t.equals((new Interval(-1, 5, 1, 4)).isInBounds(), false)
  t.end()
})

;[{fn: "zoom",    event: "zoom"}
, {fn: "panMove", event: "pan:move"}
].forEach(function(T) {
  test("Interval#" + T.fn, function(t) {
    var int = new Interval(3, 6, 0, 10)
      , z = 0
    int.on(T.event, function(low, high) {
      t.equals(low, 4)
      t.equals(high, 5)
      t.equals(int.low, 4)
      t.equals(int.high, 5)
      z++
    })
    int[T.fn](4, 5)
    t.equals(z, 1)
    t.equals(int.low, 4)
    t.equals(int.high, 5)
    t.end()
  })

  test("Interval#" + T.fn + " no change", function(t) {
    var int = new Interval(3, 6, 0, 10)
    int.on(T.event, function(low, high) { t.fail() })
    int[T.fn](3, 6)
    t.end()
  })
})

test("Interval#panDone", function(t) {
  test("change", function(t) {
    var int = new Interval(3, 6, 0, 10)
      , e = 0
    int.on("pan:done", function(low, high) {
      t.equals(low, 4)
      t.equals(high, 7)
      e++
    })
    int.panBy(1)
    int.panDone()
    int.panDone() // the second is a noop
    t.equals(e, 1)
    t.end()
  })

  test("no change", function(t) {
    var int = new Interval(3, 6, 0, 10)
    int.on("pan:done", function() { t.fail() })
    int.panDone()
    t.end()
  })
  t.end()
})

test("Interval#panBy", function(t) {
  test("in bounds", function(t) {
    var int = new Interval(3, 6, 0, 10)
      , p = 0
    int.on("pan:move", function(low, high) {
      t.equals(low, 4)
      t.equals(high, 7)
      t.equals(int.low, 4)
      t.equals(int.high, 7)
      p++
    })
    int.panBy(1)
    t.equals(p, 1)
    t.end()
  })

  test("too low", function(t) {
    var int = new Interval(3, 6, 0, 10)
      , p = 0
    int.on("pan:move", function(low, high) {
      t.equals(low, 0)
      t.equals(high, 3)
      p++
    })
    int.panBy(-100)
    t.equals(p, 1)
    t.end()
  })

  test("too high", function(t) {
    var int = new Interval(3, 6, 0, 10)
      , p = 0
    int.on("pan:move", function(low, high) {
      t.equals(low, 7)
      t.equals(high, 10)
      p++
    })
    int.panBy(100)
    t.equals(p, 1)
    t.end()
  })

  test("by 0", function(t) {
    var int = new Interval(3, 6, 0, 10)
    int.on("pan:move", function() { t.fail() })
    int.panBy(0)
    t.end()
  })

  test("min = null", function(t) {
    var int = new Interval(3, 6, null, 10)
      , p = 0
    int.on("pan:move", function(low, high) {
      t.equals(low, 3 - 100)
      t.equals(high, 6 - 100)
      p++
    })
    int.panBy(-100)
    t.equals(p, 1)
    t.end()
  })

  test("max = null", function(t) {
    var int = new Interval(3, 6, 0, null)
      , p = 0
    int.on("pan:move", function(low, high) {
      t.equals(low, 100 + 3)
      t.equals(high, 100 + 6)
      p++
    })
    int.panBy(100)
    t.equals(p, 1)
    t.end()
  })

  t.end()
})
