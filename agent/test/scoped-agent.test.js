var test         = require('tap').test
  , EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , ScopedAgent  = require('../lib/scoped-agent')

test("ScopedAgent", function(t) {
  var ma = new MockAgent()
    , sa = new ScopedAgent(ma, "scope")
  t.equals(sa.agent, ma)
  t.equals(sa._scope, "scope")
  t.end()
})

test("ScopedAgent#close", function(t) {
  var ma = new MockAgent()
    , sa = new ScopedAgent(ma, "scope")
  sa.close()
  t.deepEquals(ma.ops, ["close"])
  t.end()
})

test("ScopedAgent#on", function(t) {
  var ma    = new MockAgent()
    , sa    = new ScopedAgent(ma, "scope")
    , error = new Error
  sa.on("error", function(err) {
    t.equals(err, error)
    t.end()
  })
  ma.emit("error", error)
})

test("ScopedAgent#scope", function(t) {
  var ma     = new MockAgent()
    , parent = new ScopedAgent(ma, "scope1")
    , child  = parent.scope("scope2")
  t.isa(child, ScopedAgent)
  t.equals(child.agent, ma)
  t.equals(child._scope, "scope1>scope2")
  t.end()
})

;["histogram", "counter"].forEach(function(metric) {
  test("ScopedAgent#" + metric, function(t) {
    var ma     = new MockAgent()
      , parent = new ScopedAgent(ma, "scope1")
    parent[metric]("child", 1.2)
    t.deepEquals(ma.ops, [[metric, "scope1>child", 1.2]])
    t.end()
  })
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function MockAgent() { this.ops = [] }

inherits(MockAgent, EventEmitter)

MockAgent.prototype.close = function() { this.ops.push("close") }
MockAgent.prototype.scope = function(scope) {
  return new ScopedAgent(this, scope)
}

MockAgent.prototype.histogram = makeMetric("histogram")
MockAgent.prototype.counter   = makeMetric("counter")

function makeMetric(fn) {
  return function(mkey, value) { this.ops.push([fn, mkey, value]) }
}
