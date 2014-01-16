var parseMetrics = require('./metrics-stream').parse

module.exports = MetricsUDPServer

/// ring - MetricsRing
function MetricsUDPServer(ring) {
  this.ring = ring
}

// bulkMessage - Buffer
// rinfo       - Object
MetricsUDPServer.prototype.onMessage = function(bulkMessage, rinfo) {
  var message = parseBulkMessage(bulkMessage)
  if (!message) return
  var metrics = parseMetrics(message.data)
  if (metrics.length) {
    this.ring.metrics(metrics, message.type === "RB")
  }
}

// Returns UDPMessage or nothing.
function parseBulkMessage(buffer) {
  var str    = buffer.toString("utf8")
    , type   = str.slice(0, 3) === "RB\n" ? "RB" : ""
    , offset = type ? (type.length + 1) : 0
  return (type === "" || type === "RB") && new UDPMessage(type, str.slice(offset))
}

function UDPMessage(type, data) {
  this.type = type
  this.data = data
}
