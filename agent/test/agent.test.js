var test         = require('tap').test
  , dgram        = require('dgram')
  , MetricsAgent = require('../lib/agent')
  , EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , PORT         = 8250

test("MetricsAgent", function(t) {
  var pool = new MockPool()
    , mc   = new MetricsAgent(pool)
  t.equals(mc.pool, pool)
  t.ok(mc.socket)
  t.ok(mc.queue)
  t.end(); mc.close()
})

test("MetricsAgent#scope", function(t) {
  var mc    = new MetricsAgent(new MockPool())
    , child = mc.scope("top")
  t.equals(child.agent, mc)
  t.equals(child._scope, "top")
  t.end(); mc.close()
})

test("MetricsAgent#counter", function(t) {
  test("online", function(t) {
    var mc, done
    dgramServer(function(pool, _done) {
      mc = new MetricsAgent(pool)
      pool.emit("health")
      mc.counter("foo")
      mc.counter("foo|bar", 123)
      mc.counter("foo>bar", 12.3)
      done = _done
    }, function(msg) {
      var data = msg.toString()
      t.equals(data, "counter:foo=1\ncounter:foo|bar=123\ncounter:foo>bar=12.3")
      t.end(); done(); mc.close()
    })
  })

  test("offline", function(t) {
    var mc, done
    dgramServer(function(pool, _done) {
      mc = new MetricsAgent(pool)
      mc.counter("foo")
      mc.counter("foo|bar", 123)
      mc.counter("foo>bar", -12.3)
      pool.emit("health")
      done = _done
    }, function(msg) {
      var data = msg.toString()
      t.equals(data, "counter:foo=1\ncounter:foo|bar=123\ncounter:foo>bar=-12.3")
      t.end(); done(); mc.close()
    })
  })

  t.end()
})

test("MetricsAgent#histogram", function(t) {
  var mc, done
  dgramServer(function(pool, _done) {
    mc = new MetricsAgent(pool)
    pool.emit("health")
    mc.histogram("foo|bar", 123)
    mc.histogram("foo>bar", 12.3)
    done = _done
  }, function(msg) {
    var data = msg.toString()
    t.equals(data, "histogram:foo|bar=123\nhistogram:foo>bar=12.3")
    t.end(); done(); mc.close()
  })
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// cb(pool, done)
// onMessage(buffer)
function dgramServer(cb, onMessage) {
  var socket   = dgram.createSocket("udp4", onMessage)
    , port     = PORT++
  socket.on("listening", function() {
    cb(new MockPool(["127.0.0.1:" + port]), socket.close.bind(socket))
  })
  socket.bind(port)
}

function MockPool(hosts) {
  this.hosts = hosts
  this.ops   = []
}

inherits(MockPool, EventEmitter)

MockPool.prototype.get_node = function() {
  return { address: "127.0.0.1"
         , port:    +this.hosts[0].split(":")[1]
         , healthy: true
         }
}

MockPool.prototype.close = function() { }
