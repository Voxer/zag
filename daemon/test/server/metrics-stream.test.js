var test          = require('tap').test
  , MetricsStream = require('../../lib/server/metrics-stream')
  , parse         = MetricsStream.parse

function noop() {}

test("MetricsStream", function(t) {
  var ms = new MetricsStream(noop)
  t.equals(ms.onMetrics, noop)
  t.equals(ms.buffer, "")
  t.equals(ms.writable, true)
  t.end()
})

test("MetricsStream#write, MetricsStream#end", function(t) {
  var metrics = []
    , ms      = new MetricsStream(metrics.push.bind(metrics))
    , set1    =
      [ {type: "counter",   key: "foo", value: 2}
      , {type: "histogram", key: "bar", value: -12}
      ]
  ms.write("counter:foo=2")
  t.deepEquals(metrics, [])
  ms.write("\nhistogram:bar=-12\n\n")
  t.deepEquals(metrics, [set1])
  ms.write("counter:baz=5.2")
  t.deepEquals(metrics, [set1])
  ms.end()
  t.deepEquals(metrics, [set1, [{type: "counter", key: "baz", value: 5.2}]])
  t.equals(ms.buffer, "")
  t.end()
})

test("MetricsStream.parse", function(t) {
  var invalid = ["", "a", "a=1", "a:b", "a:1", "counter:foo=A"]
  for (var i = 0; i < invalid.length; i++) {
    t.deepEquals(parse(invalid[i]), [])
  }

  t.deepEquals(parse("counter:a=1"),    [{type: "counter", key: "a", value:  1}])
  t.deepEquals(parse("counter:a=1.2"),  [{type: "counter", key: "a", value:  1.2}])
  t.deepEquals(parse("counter:a=-1.2"), [{type: "counter", key: "a", value: -1.2}])

  t.deepEquals(parse("counter:foo=1\nhistogram:bar=2"),
    [ {type: "counter",   key: "foo", value: 1}
    , {type: "histogram", key: "bar", value: 2}
    ])
  t.end()
})
