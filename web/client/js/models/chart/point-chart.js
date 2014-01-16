var Chart     = require('./chart')
  , parseMKey = require('../../../../lib/mkey')
  , subtract  = require('../../../../lib/subtract-set')
  , inherits  = require('util').inherits
  , same      = require('./util').sameSorted
  , ID        = 0

module.exports = PointChart

function noop() {}

/// A data-aware Chart changes to the active keys are forwarded along to
/// the PointEmitter.
///
/// points   - PointEmitter
/// mkeys    - [String] "key" or "key@subkey"
/// settings - {subkey, renderer, histkeys, title, id}
///
function PointChart(points, mkeys, settings) {
  Chart.call(this, mkeys, settings)
  this.pID      = "chart-" + (ID++)
  this.ptKeys   = [] // [String]
  this.points   = points
  this.points.addChart(this.pID, this.onUpdate.bind(this))
  // Override this function.
  this.update   = noop
  this.ptCounts = {} // { String mkey : Integer point count }
  this._isDirty = false
  this.updateKeys()
}

inherits(PointChart, Chart)

PointChart.prototype.destroy = function() {
  if (this.isDestroyed) return

  this.mkeys = []
  this.updateKeys()
  this.points.removeChart(this.pID)

  this.ptKeys = this.update = this.points = this.ptCounts = null
  Chart.prototype.destroy.call(this)
}

;["plotAdd", "plotRemove", "setHistKeys"].forEach(function(fn) {
  PointChart.prototype[fn] = function(arg1) {
    Chart.prototype[fn].call(this, arg1)
    this._isDirty = true
    this.updateKeys()
  }
})

PointChart.prototype.getPlots = function() {
  var plots = Chart.prototype.getPlots.call(this)
  for (var i = 0; i < plots.length; i++) {
    var plot = plots[i]
    plot.data = this.getData(plot.id)
  }
  return plots
}

// fullkey - String "<key>@<subkey>"
// Returns String "<key>[@llq]"
PointChart.prototype.getData = function(fullkey) {
  return this.points.getData(loaderKey(fullkey))
}

;["setRenderer", "setSubKey"].forEach(function(fn) {
  PointChart.prototype[fn] = function(val) {
    this._isDirty = true
    Chart.prototype[fn].call(this, val)
  }
})

// Update and compare mkey snapshots.
//
// Returns Boolean: whether or not the keys changed since the last snapshot.
PointChart.prototype.isDirty = function() {
  var oldCounts = this.ptCounts
    , newCounts = this.ptCounts = this.getPointCounts()
    , oldKeys   = Object.keys(oldCounts)
    , newKeys   = Object.keys(newCounts)
    , dirty     = this._isDirty
  this._isDirty = false

  if (!same(oldKeys, newKeys)) return true
  for (var i = 0; i < oldKeys.length; i++) {
    var mkey = oldKeys[i]
    if (oldCounts[mkey] !== newCounts[mkey]) return true
  }
  return dirty
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

PointChart.prototype.getPointCounts = function() {
  var counts = {}
    , mkeys  = this.mkeys
  for (var i = 0; i < mkeys.length; i++) {
    var mkey = mkeys[i]
    counts[mkey] = this.getData(mkey).length
  }
  return counts
}

PointChart.prototype.updateKeys = function() {
  // Don't update the keys until the initial `updateKeys` call in the
  // PointChart constructor.
  if (!this.ptKeys) return

  var oldKeys = this.ptKeys
    , newKeys = loaderKeys(this.mkeys)
  this.points.updateKeys(this.pID,
    { add:    subtract(newKeys, oldKeys)
    , remove: subtract(oldKeys, newKeys)
    })
  this.ptKeys = newKeys
}

PointChart.prototype.onUpdate = function() { this.update() }

// mkey - String "<key>" or "<key>@<subkey>"
// Returns "<key>[@llq]"
function loaderKey(mkey) {
  var keyObj   = parseMKey.isFunction(mkey) ? {key: mkey} : parseMKey(mkey)
    , cacheKey = keyObj.key
  if (keyObj.subkey === "llquantize") {
    cacheKey += "@llq"
  }
  return cacheKey
}

function loaderKeys(mkeys) { return mkeys.map(loaderKey) }
