var test      = require('tap').test
  , Histogram = require('../../../lib/aggregator/metrics/histogram')

test("Histogram", function(t) {
  var h = new Histogram()
  t.ok(h.hist)
  t.end()
})

test("Histogram#push, Histogram#toJSON", function(t) {
  var h = new Histogram()
  h.push(0)
  h.push(0.5)
  h.push(1)
  t.deepEquals(h.toJSON(123),
    { ts:      123
    , count:   3
    , max:     1
    , mean:    0.5
    , std_dev: 0.5
    , p10:     0
    , median:  0.5
    , p75:     1
    , p95:     1
    , p99:     1
    })
  t.end()
})

test("Histogram#push one", function(t) {
  var h = new Histogram()
  h.push(5)
  t.equals(h.toJSON(123).std_dev, 0)
  t.end()
})

test("Histogram#getMean", function(t) {
  var h = new Histogram()
  t.equals(h.getMean(), 0)
  h.push(10)
  t.equals(h.getMean(), 10)
  h.push(20)
  t.equals(h.getMean(), 15)
  t.end()
})

test("Histogram#getVariance", function(t) {
  var h = new Histogram()
  t.equals(h.getVariance(), 0)
  h.push(0)
  t.equals(h.getVariance(), 0)
  h.push(10)
  h.push(20)
  t.equals(h.getVariance(), 100)
  t.end()
})
