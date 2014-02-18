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
