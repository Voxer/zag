var Channel  = require('./channel')
  , inherits = require('util').inherits

module.exports = CachedChannel

/// Store the points that arrive over the Channel.
/// The points will be stored until `CachedChannel#close` is called.
///
/// api   - APIClient
/// delta - Integer, milliseconds
/// onPoint(point)
///
function CachedChannel(api, delta, onPoint) {
  Channel.call(this, api, delta, this.onLivePoint.bind(this))
  this._onPoint = onPoint
  this._cache   = {} // { mkey : [point] }
  this._max     = 0
}

inherits(CachedChannel, Channel)

// Close down the EventSource.
CachedChannel.prototype.close = function() {
  Channel.prototype.close.call(this)
  this._onPoint = this._cache = null
}

// mkey - String
// Returns [Point]
CachedChannel.prototype.getData = function(mkey) {
  return this._cache[mkey]
}

// point - {key, ts, count ...}
CachedChannel.prototype.onLivePoint = function(point) {
  var mkey  = point.key
    , cache = this._cache[mkey] || (this._cache[mkey] = [])
  cache.push(toDataPoint(point))
  this._max = Math.max(this._max, point.ts)
  this._onPoint(point)
}

// Returns Integer
CachedChannel.prototype.getMaxTime = function() { return this._max }

// Pull the flat data from a LLQ point. Leave other points untouched.
//
// pt - {ts, key, ...}
//
function toDataPoint(pt) { return pt.data || pt }
