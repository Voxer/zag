var Channel      = require('./channel')
  , EventEmitter = require('events').EventEmitter
  , api          = require('../api')

module.exports = PointEmitter

/// Charts register themselves and their keys with a PointEmitter singleton.
/// The PointEmitter calls their `update()` functions whenever they need to be
/// redrawn.
///
/// loader   - IntervalLoader
/// settings - {start, end, delta}
///
function PointEmitter(loader, settings) {
  this.loader  = loader
  this.ee      = new EventEmitter()
  this.charts  = {} // { chartID : Function }
  this.keys    = {} // { String mkey : true }
  this.channel = null // Channel
  this.start   = settings.start
  this.end     = settings.end
  this.delta   = settings.delta // Integer, milliseconds
  this.maybeChannel()
}

// chartID - String
// listener(start, end)
PointEmitter.prototype.addChart = function(chartID, listener) {
  this.charts[chartID] = listener
}

// chartID - String
PointEmitter.prototype.removeChart = function(chartID) {
  delete this.charts[chartID]
}

// chartID - String
// updates - {add, remove}
PointEmitter.prototype.updateKeys = function(chartID, updates) {
  var addKeys    = updates.add
    , rmKeys     = updates.remove
    , channelAdd = []
    , channelRm  = []
  for (var i = 0; i < addKeys.length; i++) {
    var mkey  = addKeys[i]
      , isNew = this.addKey(chartID, mkey)
    if (isNew) channelAdd.push(mkey)
  }
  for (var i = 0; i < rmKeys.length; i++) {
    var mkey = rmKeys[i]
    if (this.removeKey(chartID, mkey)) channelRm.push(mkey)
  }
  if (this.channel) {
    this.channel.updateKeys(channelAdd, channelRm)
  }
  if (channelAdd.length) this.loadAll()
}

// start - Integer
// end   - Integer
PointEmitter.prototype.setRange = function(start, end, delta) {
  var oldDelta = this.delta
  this.start   = start
  this.end     = end
  this.delta   = delta
  if (oldDelta !== delta) {
    this.destroyChannel()
    this.maybeChannel()
  }
  this.loadAll()
}

PointEmitter.prototype.loadAll = function() {
  if (this.channel) return this.updateAll()

  var start = this.start
    , end   = this.end
    , lKeys = this.getLoaderKeys()
    , _this = this
  if (!lKeys.length) return

  this.loader.loadMany(lKeys, start, end, function(fail) {
    if (fail) return console.warn("PointEmitter#loadAll error", fail)
    _this.updateAll()
  })
}

// mkey - String
// Returns [Point]
PointEmitter.prototype.getData = function(mkey) {
  return (this.channel ? this.channel.getData(mkey)
                       : this.loader.getData(this.loaderKey(mkey)))
                      || []
}

// For live metrics, the max time is always increasing.
//
// Returns Integer
PointEmitter.prototype.getMaxTime = function() {
  return this.channel ? this.channel.getMaxTime() : 0
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Call all of the listeners.
PointEmitter.prototype.updateAll = function() {
  var charts   = this.charts
    , chartIDs = Object.keys(charts)
  for (var i = 0; i < chartIDs.length; i++) {
    charts[chartIDs[i]]()
  }
}

// point - {key, ts, count ...}
PointEmitter.prototype.onLivePoint = function(point) {
  this.ee.emit(point.key)
}

///
/// Key management
///

// chartID - String
// mkey    - String
// Returns Boolean: whether or not the key was added to the channel
PointEmitter.prototype.addKey = function(chartID, mkey) {
  var isNewKey = !this.keys[mkey]
  this.ee.on(mkey, this.charts[chartID])
  if (isNewKey) {
    this.keys[mkey] = true
    return true
  }
}

// chartID - String
// mkey    - String
// Returns Boolean: whether or not the key was removed from the channel
PointEmitter.prototype.removeKey = function(chartID, mkey) {
  this.ee.removeListener(mkey, this.charts[chartID])
  if (this.ee.listeners(mkey).length === 0) {
    delete this.keys[mkey]
    return true
  }
}

///
/// Getting keys
///

// Returns [String]
PointEmitter.prototype.getKeys = function() {
  return Object.keys(this.keys)
}

// Returns [String "<mkey>#<delta>"]
PointEmitter.prototype.getLoaderKeys = function() {
  var keys  = this.getKeys()
    , delta = this.delta
    , lKeys = []
  for (var i = 0; i < keys.length; i++) {
    lKeys.push(this.loaderKey(keys[i]))
  }
  return lKeys
}

// mkey - String
// Returns String "<mkey>#<delta>"
PointEmitter.prototype.loaderKey = function(mkey) {
  return loaderKey(mkey, this.delta)
}

///
/// Channels
///

PointEmitter.prototype.maybeChannel = function() {
  var delta = this.delta
  if (isLiveDelta(delta)) {
    this.channel = new Channel(api, delta, this.onLivePoint.bind(this))
    this.channel.setKeys(this.getKeys())
  }
}

// Close the EventSource.
PointEmitter.prototype.destroyChannel = function() {
  var channel = this.channel
  if (channel) channel.close()
  this.channel = null
}


// Returns Boolean
function isLiveDelta(delta) { return delta < 60000 }

// mkey  - String "<key>" or "<key>@<subkey>"
// delta - Integer
//
// Returns "<key>[@llq]#<delta>"
function loaderKey(mkey, delta) { return mkey + "#" + delta }
