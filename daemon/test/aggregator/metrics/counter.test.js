var test    = require('tap').test
  , Counter = require('../../../lib/aggregator/metrics/counter')

test("Counter", function(t) {
  var c = new Counter()
  t.equals(c.count, 0)
  t.end()
})

test("Counter#push", function(t) {
  var c = new Counter()
  c.push(10)
  t.equals(c.count, 10)
  c.push(-5)
  t.equals(c.count, 5)
  t.end()
})

test("Counter#toJSON", function(t) {
  var c = new Counter()
  c.push(12)
  t.deepEquals(c.toJSON(123),
    { ts:    123
    , count: 12
    })
  t.end()
})
