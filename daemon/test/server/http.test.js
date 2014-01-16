var test       = require('tap').test
  , HTTPServer = require('../../lib/server/http')
  , MockRing   = require('./ring.mock')
  , HOST       = "127.0.0.1"
  , PORT       = 8250

test("HTTPServer", function(t) {
  var ring = new MockRing()
    , hs   = new HTTPServer(ring)
  t.equals(hs.ring, ring)
  t.end()
})

/*
test("POST /api/metrics", function(t) {
  var ring = new MockRing()
    , hs   = new HTTPServer(ring)

  hs.listen(PORT++, HOST, function() {
    // TODO request, pool

    t.deepEquals(ring.ops,
      [ [ "metrics"
        , [ {type: "counter",   key: "foo", value: 5.2}
          , {type: "histogram", key: "bar", value: 400}
          ]
        , false
        ]
      ])
    t.end(); hs.close()
  })
})
*/
