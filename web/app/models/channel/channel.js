var qs          = require('querystring')
  , LiveRequest = require('./request')
  , flattenLLQ  = require('../../metrics/flatten-llq')
  , isLLQ       = /@llq$/

module.exports = MetricsChannel

/// pool  - Pool of metrics-daemons.
/// delta - Integer
/// es    - EventSource
function MetricsChannel(pool, delta, es) {
  this.pool     = pool
  this.delta    = delta
  this.es       = es // EventSource
  this.requests = {} // { mkey : LiveRequest }
  this._touch   = Date.now()
  this._onPoint = this.onPoint.bind(this)

  // Let the client know that it is OK to send their key list.
  this.es.emit("init", {})
}

// Clean up all pending requests.
MetricsChannel.prototype.destroy = function() {
  var requests = this.requests
    , mkeys    = Object.keys(requests)
  for (var i = 0; i < mkeys.length; i++) {
    this.remove(mkeys[i])
  }
  this.es.end()
  this.pool = this.requests = this.es = this._onPoint = null
}

// Bump the time till expiration.
MetricsChannel.prototype.touch = function() { this._touch = Date.now() }

// Returns Boolean: true if the channel has expired.
MetricsChannel.prototype.isExpired = function() {
  return Date.now() - this._touch > 20 * 60 * 1000
}

// Poll a metrics daemon for a live stream of points on the given metrics key.
//
// mkey - String
//
MetricsChannel.prototype.add = function(mkey) {
  this.touch()
  if (this.requests[mkey]) return
  var host = this.pool.get_endpoint().name
    , url  = "http://" + host + "/api/live/" + encodeURIComponent(mkey)
           + "?" + qs.stringify({delta: this.delta})
  this.requests[mkey] = new LiveRequest(url, this._onPoint)
}

// Stop listening to the given key.
//
// mkey - String
//
MetricsChannel.prototype.remove = function(mkey) {
  this.touch()
  this.requests[mkey].destroy()
  delete this.requests[mkey]
}

MetricsChannel.prototype.onPoint = function(point) {
  if (isLLQ.test(point.key)) {
    point.data = flattenLLQ([point])[0]
  }
  this.es.emit("point", point)
}
