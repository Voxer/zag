var test        = require('tap').test
  , RunningMean = require('../../lib/monitor/running-mean')

test("RunningMean", function(t) {
  var m = new RunningMean()
  t.equals(m.mean, 0)
  m.push(0)
  t.equals(m.mean, 0)
  m.push(10)
  t.equals(m.mean, 5)
  m.push(20)
  t.equals(m.mean, 10)
  t.end()
})
