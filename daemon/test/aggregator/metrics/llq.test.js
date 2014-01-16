var test = require('tap').test
  , LLQ  = require('../../../lib/aggregator/metrics/llq')

test("LLQ", function(t) {
  var l = new LLQ()
  t.ok(l.llq)
  t.end()
})

test("LLQ#push, LLQ#toJSON", function(t) {
  var l = new LLQ()
  l.push(0)
  l.push(1)
  l.push(16)
  l.push(64)
  l.push(65)
  l.push(130)

  t.deepEquals(l.toJSON(123),
    { ts: 123
    , data:
      { 0:  1
      , 1:  1
      , 16: 1
      , 64: 2
      , 128: 1
      }
    })
  t.end()
})
