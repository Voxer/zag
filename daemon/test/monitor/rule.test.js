var test = require('tap').test
  , Rule = require('../../lib/monitor/rule')

test("Rule", function(t) {
  var rule = new Rule(
    { ts:     123
    , fields: ["a", "b"]
    , hours:  {2: {}}
    })
  t.equals(rule.ts, 123)
  t.deepEquals(rule.fields, ["a", "b"])
  t.deepEquals(rule.hours, {2: {}})
  t.end()
})

test("Rule#isExpired", function(t) {
  var rule1 = new Rule({ts: Date.now(), fields: ["mean"], hours: {}})
  t.equals(rule1.isExpired(), true)

  var rule2 = new Rule({ts: Date.now(), fields: [], hours: {}})
  t.equals(rule2.isExpired(), false)

  var hours = {}
  hours[(new Date).getHours()] = {}
  var rule3 = new Rule(
    { ts:     Date.now() - 2*Rule.interval
    , fields: ["mean"]
    , hours:  hours
    })
  t.equals(rule3.isExpired(), true)

  var rule4 = new Rule({ts: Date.now(), fields: ["mean"], hours: hours})
  t.equals(rule4.isExpired(), false)
  t.end()
})
