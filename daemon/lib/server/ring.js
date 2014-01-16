var PacketQueue = require('../../../agent').PacketQueue

module.exports = MetricsRing

/// socket     - dgram.Socket
/// aggregator - MetricsAggregator
/// ring       - Ring
function MetricsRing(socket, aggregator, ring, host) {
  this.socket     = socket
  this.aggregator = aggregator
  this.ring       = ring
  this.host       = host
  this.queues     = {} // { daemon host : PacketQueue }
}

// metrics - [{type, key, value}]
// isLocal - Boolean, true if the metrics have been forwarded already.
MetricsRing.prototype.metrics = function(metrics, isLocal) {
  for (var i = 0, l = metrics.length; i < l; i++) {
    var metric = metrics[i]
      , type   = metric.type
    if (type === "counter" || type === "histogram") {
      if (isLocal) {
        this.metricLocal(type, metric.key, metric.value)
      } else {
        this.metric(type, metric.key, metric.value)
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Process a metric, forwarding to its home if necessary.
// Also expands rollup keys (`A|B|C`).
//
// type  - "histogram" or "counter"
// mkey  - String
// value - Number
//
MetricsRing.prototype.metric = function(type, mkey, value) {
  var keyParts = mkey.split("|")
    , host     = this.host
  for (var i = 1, l = keyParts.length; i <= l; i++) {
    var keyPart    = keyParts.slice(0, i).join("|")
      , targetHost = this.lookup(keyPart)
    if (targetHost === host) {
      this.metricLocal(type, keyPart, value)
    } else {
      this.getQueue(targetHost).write(type + ":" + keyPart + "=" + value)
    }
  }
}

// Process a metric who's home is known to be this node.
//
// type  - "histogram" or "counter"
// mkey  - String
// value - Number
//
MetricsRing.prototype.metricLocal = function(type, mkey, value) {
  this.aggregator[type](mkey, value)
}

// Returns PacketQueue
MetricsRing.prototype.getQueue = function(host) {
  return this.queues[host]
     || (this.queues[host] = this.makeQueue(host))
}

// Returns PacketQueue
MetricsRing.prototype.makeQueue = function(host) {
  var _this    = this
    , addrport = host.split(":")
  return new PacketQueue(function(buf, off, len) {
    _this.socket.send(buf, off, len, +addrport[1], addrport[0])
  }, {type: "RB"})
}

// Returns String "address:port"
MetricsRing.prototype.lookup = function(key) {
  return this.ring.lookup(key)
}
