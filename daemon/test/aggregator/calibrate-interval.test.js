var test  = require('tap').test
  , calIv = require('../../lib/aggregator/calibrate-interval')

test("calibrateInterval", function(t) {
  var i = 0
  var clear = calIv(function() {
    i++
  }, 5)

  setTimeout(function() {
    t.ok(4 < i < 6)
    var before = i
    clear()
    setTimeout(function() {
      t.equals(i, before)
      t.end()
    }, 20)
  }, 20)
})

test("calibrateInterval calibration", function(t) {
  var i = 0
  var clear = calIv(function() {
    var now = new Date()
      , off = now.getMilliseconds() % 100

    t.ok(off < 15 || off > 85)
    if (i++ === 5) {
      clear()
      t.end()
    }
  }, 100)
})

test("calibrateInterval clear immediately", function(t) {
  var clear = calIv(function() { t.fail() })
  clear()
  setTimeout(function() { t.end() }, 20)
})
