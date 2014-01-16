var Stream   = require('stream')
  , inherits = require('util').inherits
  , reMetric = /^(\w+):([^=]+)=(\-?\d+\.?\d*)$/

module.exports = MetricsStream

/// onMetrics([{type, key, value}])
function MetricsStream(onMetrics) {
  this.onMetrics = onMetrics
  this.buffer    = ""
  this.writable  = true
}

MetricsStream.parse = parseMetrics

inherits(MetricsStream, Stream)

MetricsStream.prototype.write = function(data) {
  this.buffer += data.toString()
  this.flush()
}

MetricsStream.prototype.end = function() {
  this.buffer += "\n"
  this.flush()
  this.destroy()
}

MetricsStream.prototype.destroy = function() {
  this.onMetrics = null
  this.buffer    = ""
  this.writable  = false
}

MetricsStream.prototype.flush = function() {
  var data = this.buffer
    , end  = data.lastIndexOf("\n")
  if (end === -1) return

  var metrics = parseMetrics(data.slice(0, end))
  if (metrics.length) this.onMetrics(metrics)

  this.buffer = end === data.length - 1 ? "" : data.slice(end)
}


// message - String, "\n"-delimited metrics.
// Returns [{type, key, value}]
function parseMetrics(message) {
  var metricStrs = message.split("\n")
    , metrics    = []
  for (var i = 0; i < metricStrs.length; i++) {
    var match = reMetric.exec(metricStrs[i])
    if (match) {
      metrics.push({type: match[1], key: match[2], value: +match[3]})
    }
  }
  return metrics
}
