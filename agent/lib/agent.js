var dgram        = require('dgram')
  , PacketQueue  = require('./packet-queue')
  , ScopedAgent  = require('./scoped-agent')
  , EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits

module.exports = MetricsAgent

// The number of metrics that should be sent to a daemon before selecting a new one.
var MAX_SEQNO     = 1000
  , unhealthyNode = {healthy: false}
  , lines         = new Error().stack

/// Send metrics to a metrics server over UDP.
///
/// daemonPool - Pool
///
/// Events:
///   * error(err)
///
function MetricsAgent(daemonPool) {
  this.pool         = daemonPool
  this.offlineQueue = []
  this.seqno        = 0
  this.currentNode  = unhealthyNode
  this.socket       = dgram.createSocket("udp4")

  var _this = this
  this.queue = new PacketQueue(function(buf, off, len) {
    _this.sendBulk(buf, off, len)
  })

  this.socket.on("error", function(err) { _this.emit("error", err) })
  daemonPool.on("health", function() { _this.onPoolHealth() })
}

inherits(MetricsAgent, EventEmitter)

// Close the UDP socket and clean up.
MetricsAgent.prototype.close = function() {
  this.socket.close()
  this.queue.destroy()
  this.pool.close()
  this.pool = this.offlineQueue = this.currentNode = this.socket = this.queue = null
}

// Create an agent that scopes all of its metrics under `scope`.
//
// scope - String
//
// Returns ScopedAgent
MetricsAgent.prototype.scope = function(scope) {
  return new ScopedAgent(this, scope)
}

// Measure a distribution of values.
//
// mkey  - String metrics key
// value - Number
//
MetricsAgent.prototype.histogram = function(mkey, value) {
  this.send("histogram:" + mkey + "=" + value)
}

// Measure a cumulative value.
//
// mkey  - String metrics key
// value - Number (default: 1)
//
MetricsAgent.prototype.counter = function(mkey, value) {
  this.send("counter:" + mkey + "=" + (value === undefined ? 1 : value))
}

// Value
MetricsAgent.prototype.gauge = function(mkey, value) { /* TODO */ }

// Rate
MetricsAgent.prototype.meter = function(mkey, value) { /* TODO */ }


////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// data - String "<type>:<mkey>=<value>"
MetricsAgent.prototype.send = function(data) {
  if (!this.currentNode.healthy) {
    this.offlineQueue.push(data)
    return
  }

  if (this.seqno++ > MAX_SEQNO) {
    this.selectNode()
    return this.send(data)
  }
  this.queue.write(data)
}

// buffer - Buffer
// offset - Integer, starting offset within the buffer.
// length - Integer
MetricsAgent.prototype.sendBulk = function(buffer, offset, length) {
  this.socket.send(buffer, offset, length, this.currentNode.port, this.currentNode.address)
}

///
/// Offline
///

MetricsAgent.prototype.goOnline = function() {
  if (this.selectNode()) this.flushOffline()
}

// Flush the offline queue.
MetricsAgent.prototype.flushOffline = function() {
  var queue = this.offlineQueue
  if (!queue.length) return

  for (var i = 0; i < queue.length; i++) {
    this.send(queue[i])
  }
  this.offlineQueue = []
}

///
/// Pool
///

MetricsAgent.prototype.onPoolHealth = function() {
  if (!this.currentNode.healthy) this.goOnline()
}

MetricsAgent.prototype.selectNode = function() {
  this.seqno = 0
  return this.currentNode = this.pool.get_node()
}

MetricsAgent.prototype.pingAll = function(callback) {
  var nodes     = this.pool.endpoints
    , remaining = nodes.length
  if (remaining === 0) return process.nextTick(callback)

  for (var i = 0; i < Math.min(4, remaining); i++) {
    pingOne(nodes[i])
  }

  function pingOne(node) {
    if (!node) return
    node.ping(function(err, res) {
      node.setHealthy(!err && res && res.statusCode === 200)
      if (--remaining === 0) callback()
      pingOne(nodes[i++])
    })
  }
}
