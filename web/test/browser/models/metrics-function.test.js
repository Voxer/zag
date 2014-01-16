var test            = require('tap').test
  , MetricsFunction = require('../../../client/js/models/metrics-function')

test("MetricsFunction.get", function(t) {
  var mkey = "{ {abc} / {def@mean} + 2 }"
    , fn   = MetricsFunction.get(mkey)
  t.equals(fn.mkey, mkey)
  t.isa(fn.fn, "function")
  t.equals(fn.fn({abc: {count: 10}, def: {mean: 2}}), 7)
  t.deepEquals(fn.args, ["abc", "def"])

  // Cached function and args.
  var fn2 = MetricsFunction.get(mkey)
  t.equals(fn2, fn)
  t.end()
})

test("MetricsFunction.get duplicate arguments", function(t) {
  var fn = MetricsFunction.get("{ {abc} / {abc} }")
  t.deepEquals(fn.args, ["abc"])
  t.end()
})

test("MetricsFunction#process", function(t) {
  var fn = MetricsFunction.get("{ {abc} + {def@mean} }")
  t.deepEquals(
    fn.process(
      { abc:
        [ {ts: 1, count: 4}
        , {ts: 2, count: 5}
        , {ts: 3, count: 6}
        , {ts: 4, count: 7}
        ]
      , def:
        [ {ts: 1, mean: 8}
        , {ts: 2, mean: 10}
        , {ts: 3, mean: 12}
        , {ts: 4, mean: 14}
        ]
      }),
    [ {ts: 1, count: 4 + 8}
    , {ts: 2, count: 5 + 10}
    , {ts: 3, count: 6 + 12}
    , {ts: 4, count: 7 + 14}
    ])

  // Empty
  t.deepEquals(fn.process({abc: [], def: []}), [])

  t.end()
})
