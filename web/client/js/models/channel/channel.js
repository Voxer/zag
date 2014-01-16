var subtractItems = require('../../../../lib/subtract-set')
  , EventSource   = (typeof window !== "undefined") && window.EventSource

module.exports = Channel

/// Fetch live metrics over EventSource.
///
/// delta - Integer, milliseconds
///
function Channel(api, delta, onPoint) {
  this.api      = api
  this.delta    = delta
  this.id       = Date.now() + "_" + Math.random()
  this.es       = new EventSource(this.url())
  this.keys     = [] // [String mkey]
  this._onError = this.onError.bind(this)

  var _this = this
  this.es.addEventListener("error", this._onError)
  this.es.addEventListener("init", this.onInit.bind(this))
  this.es.addEventListener("point", function(ev) {
    onPoint(JSON.parse(ev.data))
  })
}

Channel.inject = function(_EventSource) { EventSource = _EventSource }

Channel.prototype.close = function() {
  this.es.close()
  this.es = this.keys = this._onError = null
}

// Returns String EventSource URL.
Channel.prototype.url = function() {
  return "/api/channels/" + encodeURIComponent(this.id)
       + "?delta=" + this.delta
}

Channel.prototype.setKeys = function(newKeys) {
  var add    = subtractItems(newKeys, this.keys)
    , remove = subtractItems(this.keys, newKeys)
  this.updateKeys(add, remove)
}

Channel.prototype.updateKeys = function(add, remove) {
  if (!add.length && !remove.length) return
  for (var i = 0; i < add.length; i++)    this._add(add[i])
  for (var i = 0; i < remove.length; i++) this._remove(remove[i])
  this.setChannelMetrics({add: add, remove: remove})
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

Channel.prototype.setChannelMetrics = function(updates) {
  this.api.setChannelMetrics(this.id, updates, this._onError)
}

Channel.prototype._add    = function(mkey) { this.keys.push(mkey) }
Channel.prototype._remove = function(mkey) {
  this.keys.splice(this.keys.indexOf(mkey), 1)
}

// The "init" event is sent by the server when an EventSource is established.
// It restores the session in cases where the server is restarted and the
// browser retries and reconnects.
//
// ev - Event, but no meaningful data.
//
Channel.prototype.onInit = function(ev) {
  if (this.keys.length) this.setChannelMetrics({add: this.keys})
}

Channel.prototype.onError = function(fail) {
  if (!fail) return
  console.warn("Channel.onError", fail)
}
