var test       = require('tap').test
  , Rule       = require('../../lib/monitor/rule')
  , RuleTester = require('../../lib/monitor/rule-tester')

test("RuleTester", function(t) {
  var rule   = makeRule()
    , tester = new RuleTester("foo", rule)
  t.equals(tester.mkey, "foo")
  t.equals(tester.rule, rule)
  t.end()
})

;[{name: "counter, too high",        point: {count: 31},           warns: [{field: "count", cmp: ">"}]}
, {name: "counter, too low",         point: {count: 9},            warns: [{field: "count", cmp: "<"}]}
, {name: "counter, ok",              point: {count: 30},           warns: []}
, {name: "histogram, mean too high", point: {count: 20, mean: 56}, warns: [{field: "mean", cmp: ">"}]}
, {name: "histogram, mean too low",  point: {count: 20, mean: 44}, warns: [{field: "mean", cmp: "<"}]}
, {name: "histogram, ok",            point: {count: 22, mean: 52}, warns: []}
, {name: "histogram, both warns",    point: {count: 0,  mean: 0},  warns: [{field: "count", cmp: "<"}, {field: "mean", cmp: "<"}]}
].forEach(function(T) {
  test("RuleTester#test " + T.name, function(t) {
    var hours = {}
      , hour  = (new Date).getHours()
    hours[hour] =
      { count: 20, count_var: 10*10
      , mean:  50, mean_var:  5*5
      }

    var rule   = makeRule({fields: Object.keys(T.point), hours: hours})
      , tester = new RuleTester("foo", rule)
      , warns  = tester.test(T.point)

    t.equals(warns.length, T.warns.length)
    for (var i = 0; i < warns.length; i++) {
      t.equals(warns[i].mkey,  "foo")
      t.equals(warns[i].field, T.warns[i].field)
      t.equals(warns[i].cmp,   T.warns[i].cmp)
    }
    t.end()
  })
})

function makeRule(opts) {
  opts = opts || {}
  return new Rule(
    { ts:     opts.ts     || Date.now()
    , fields: opts.fields || ["count"]
    , hours:  opts.hours  || {}
    })
}
