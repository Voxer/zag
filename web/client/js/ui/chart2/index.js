var ChartView     = require('./view')
  , BoundedPoints = require('./models/bounded-points')
  , syncSets      = {} // syncKey : SyncedSet

function noop() {}

module.exports = ChartController

///
///
/// container - DOM element
/// options -
///   * lockXMin - Number, default: false
///   * lockXMax - Number, default: false
///   * sync     - String. All charts with the same "sync" have
///                syncronized X bounds.
///   * delta    - Integer
///
/// ChartView options
///
///   * plots    - Call plot() for each.
///   * haxXAxis - Boolean, default: true
///   * hasYAxis - Boolean, default: true
///   * hasLabel - Boolean, default: true
///   * canZoom  - Boolean, default: true
///   * ampPan   - Number, default: 1. Multiply the pan distance.
///   * tags     - [{label, color, ts}]
///   * onEditTag(tag)
///   * onNewTag(ts)
///   * lpadding, tpadding - Integer, pixels
///
function ChartController(container, options) {
  var syncID = this.syncID = options.sync
    , xOpts  = {max: options.max, low: options.xMin, high: options.xMax}
    , _this  = this
  this.xInterval = syncID ? ChartController.sync(syncID, xOpts) : BoundedPoints.xInterval(xOpts)
  this.xInterval.setDefaultRange(xOpts.low, xOpts.high)

  this.bPoints   = new BoundedPoints(this.xInterval, options.delta)
  this.yInterval = this.bPoints.yInterval

  this.xInterval.on("zoom",     this._onZoom    = function(low, high) { _this.onZoom() })
  this.xInterval.on("pan:move", this._onPanMove = function(low, high) { _this.onPanMove() })
  this.xInterval.on("pan:done", this._onPanDone = function(low, high) { _this.onPanDone() })
  this.yInterval.on("zoom",     this._onZoom)
  this.yInterval.on("pan:move", this._onPanMove)
  this.yInterval.on("pan:done", this._onPanDone)

  this.view = new ChartView(this, container, options)
}

// opts - {max, low, high}
//   max  - Number, theEnd
//   low  - default xMin
//   high - default xMax
ChartController.sync = function(syncID, opts) {
  return syncSets[syncID]
     || (syncSets[syncID] = BoundedPoints.xInterval(opts))
}

////////////////////////////////////////////////////////////////////////////////
// Public
////////////////////////////////////////////////////////////////////////////////

ChartController.prototype.destroy = function() {
  this.view.destroy()

  // Detach from the X interval.
  this.xInterval.removeListener("zoom",     this._onZoom)
  this.xInterval.removeListener("pan:move", this._onPanMove)
  this.xInterval.removeListener("pan:done", this._onPanDone)
  this._onZoom = this._onPanMove = this._onPanDone = null
  if (!this.syncID) this.xInterval.destroy()
  // Tear down the Y interval.
  this.yInterval.removeAllListeners("zoom")
  this.yInterval.removeAllListeners("pan:move")
  this.yInterval.removeAllListeners("pan:done")
  this.bPoints.destroy()

  this.xInterval = this.yInterval = this.bPoints = this.view = null
}

ChartController.prototype.reload = function(lowX, highX, delta) {
  this.zoomX(lowX, highX)
  this.setDelta(delta)
  this.view.renderAll()
}

// Re-use the Chart with a completely different set of plots.
//
// plots - Array of Plot options.
//
ChartController.prototype.reset = function(plots) { this.view.reset(plots) }

// Update a plot's data.
//
// layerID - String
// data    - [Point]
//
ChartController.prototype.setData = function(layerID, data) {
  this.view.layers.byID[layerID].setData(data)
}

////////////////////////////////////////////////////////////////////////////////
// Plotting
////////////////////////////////////////////////////////////////////////////////

// plotOpts - Object
// callback(fail)
ChartController.prototype.plot = function(plotOpts) { this.view.plot(plotOpts) }

// layerID - String
ChartController.prototype.unplot = function(layerID) { this.view.unplot(layerID) }

/// Proxy to ChartView
ChartController.prototype.onResize = function() { this.view.onResize() }
ChartController.prototype.setTags  = function(tags) { this.view.setTags(tags) }

////////////////////////////////////////////////////////////////////////////////
// BoundPoints
////////////////////////////////////////////////////////////////////////////////

ChartController.prototype.zoomX   = function(xLow, xHigh) { this.xInterval.zoom(xLow, xHigh) }
ChartController.prototype.zoomY   = function(yLow, yHigh) { this.yInterval.zoom(yLow, yHigh) }
ChartController.prototype.popZoom = function()            { this.bPoints.popZoom() }
ChartController.prototype.panBy   = function(dx, dy)      { this.bPoints.panBy(dx, dy) }
ChartController.prototype.panDone = function()            { this.bPoints.panDone() }
ChartController.prototype.setDelta = function(delta)      { this.bPoints.setDelta(delta) }

///
/// Range events
///

// Zoom, but don't push to the stack.
ChartController.prototype.onZoom = function() {
  // Don't bother until ChartController is initialized.
  if (!this.view) return

  this.view.onAspectRatioChange()
  this.view.renderAll()
}

ChartController.prototype.onPanMove = ChartController.prototype.onZoom
ChartController.prototype.onPanDone = function() {}
