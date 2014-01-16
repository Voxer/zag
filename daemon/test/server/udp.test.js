var test        = require('tap').test
  , UDPServer   = require('../../lib/server/udp')
  , MockRing    = require('./ring.mock')

test("UDPServer", function(t) {
  var ring = new MockRing()
    , udp  = new UDPServer(ring)
  t.equals(udp.ring, ring)
  t.end()
})

test("UDPServer#onMessage", function(t) {
  test("bulk metrics", function(t) {
    var ring = new MockRing()
      , udp  = new UDPServer(ring)

    udp.onMessage(new Buffer
      ( "counter:foo=7\n"
      + "counter:bar=-2\n"
      + "histogram:baz=5.2"), {})
    t.deepEquals(ring.ops, [
      [ "metrics"
      , [ {type: "counter",   key: "foo", value: 7}
        , {type: "counter",   key: "bar", value: -2}
        , {type: "histogram", key: "baz", value: 5.2}
        ]
      , false
      ]])
    t.end()
  })

  test("invalid datagrams", function(t) {
    var ring  = new MockRing()
      , udp   = new UDPServer(ring)

    send("")
    send("abc")
    t.deepEquals(ring.ops, [])
    t.end()

    function send(str) {
      udp.onMessage(new Buffer(str), 0, str.length)
    }
  })

  test("invalid metrics", function(t) {
    var ring = new MockRing()
      , udp  = new UDPServer(ring)

    udp.onMessage(new Buffer
      ( "invalid:foo=7\n"     // invalid type
      + "counter:a?b=8\n"     // invalid key
      + "counter:bar=1.2\n"   // valid
      + "counter:foo=12b\n")) // invalid value

    t.deepEquals(ring.ops, [
      [ "metrics",
        [ {type: "invalid", key: "foo", value: 7}
        , {type: "counter", key: "a?b", value: 8}
        , {type: "counter", key: "bar", value: 1.2}
        ]
      , false]
      ])
    t.end()
  })

  t.end()
})
