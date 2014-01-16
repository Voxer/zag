var test         = require('tap').test
  , IntervalList = require('../../lib/aggregator/interval-list')

function noop() {}

test("IntervalList", function(t) {
  var intervals = new IntervalList()
  t.deepEquals(intervals.intervals, {})
  t.deepEquals(intervals.counts, {})
  t.end()
})

test("IntervalList#has", function(t) {
  var intervals = new IntervalList()
  t.equals(intervals.has(5), false)
  intervals.setInterval(noop, 5)
  t.equals(intervals.has(5), true)
  intervals.decr(5)
  t.equals(intervals.has(5), false)

  t.deepEquals(intervals.intervals, {5: null})
  t.deepEquals(intervals.counts, {5: 0})
  t.end()
})

test("IntervalList#incr", function(t) {
  var intervals = new IntervalList()
  intervals.setInterval(noop, 5)
  t.deepEquals(intervals.counts, {5: 1})
  intervals.incr(5)
  t.deepEquals(intervals.counts, {5: 2})
  t.end(); intervals.destroy()
})

test("IntervalList#decr", function(t) {
  var intervals = new IntervalList()
  intervals.setInterval(noop, 5)
  intervals.incr(5)
  intervals.decr(5)
  t.deepEquals(intervals.counts, {5: 1})
  intervals.decr(5)
  t.deepEquals(intervals.intervals, {5: null})
  t.deepEquals(intervals.counts, {5: 0})
  t.end()
})

test("IntervalList#setInterval", function(t) {
  var intervals = new IntervalList()
    , start = Date.now()
    , i = 0
  intervals.setInterval(function() {
    if (i++ === 20) {
      t.equals(Math.round((Date.now() - start) / i), 5)
      intervals.destroy()
      t.end()
    }
  }, 5)
})
