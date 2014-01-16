var VersionedInterval = require('./versioned-interval')
  , inherits          = require('util').inherits

module.exports = ScalingInterval

/// Y
/// A Scaling Interval is bounded by it's member PointSets.
/// Its zoom history is scoped by delta.
///
/// opts -
///   * pointsets - [{yMin, yMax}]
///     This list should be kept up-to-date with the current PointSets
///     external to this module. Call `rescale` when it changes to update.
///   * delta     - Integer
///   * lowProp   - "yMin", required
///   * highProp  - "yMax", required
///
function ScalingInterval(opts) {
  VersionedInterval.call(this, 0, 1, 0, 1, opts.delta)
  this.pointsets = opts.pointsets
  // String: PointSets property names.
  this.lowProp   = opts.lowProp
  this.highProp  = opts.highProp
  // Number: Cumulative PointSet bounds.
  this.pLow      = null
  this.pHigh     = null
}

inherits(ScalingInterval, VersionedInterval)

ScalingInterval.prototype.destroy = function() {
  this.pointsets = null
  VersionedInterval.prototype.destroy.call(this)
}

// The delta has changed, so reset the zoom.
//
// delta - Integer
//
ScalingInterval.prototype.setDelta = function(delta) {
  if (this.delta !== delta) {
    this.delta = delta
    this.resetZoom()
  }
}

// The `pointsets` list changed, so re-compute the bounds.
ScalingInterval.prototype.rescale = function() {
  // The range doesn't change if this is zoomed, but the correct pLow/pHigh
  // values still need to be set so that heat maps can compute their rows.
  // Also, min/max will be adjusted, so a zoom can occur.
  if (this.isZoomed) {
    this.setPBounds()
    if (!this.interval.isInBounds()) {
      this._resetZoom()
    }
  } else this.resetZoom()
}

// Set the low/high bounds to be the pointsets' range.
ScalingInterval.prototype.resetZoom = function() {
  this.setPBounds()
  this._resetZoom()
}

///
/// PointSet management
///

// pointSet - PointSet
ScalingInterval.prototype.push = function(pointSet) {
  this.pointsets.push(pointSet)
  this.rescale()
}

// pointSet - PointSet
ScalingInterval.prototype.remove = function(pointSet) {
  var index = this.pointsets.indexOf(pointSet)
  if (index !== -1) {
    this.pointsets.splice(index, 1)
    this.rescale()
  }
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Set low/high to be pLow/pHigh. Assumes pLow/pHigh have already been computed.
ScalingInterval.prototype._resetZoom = function() {
  this.isZoomed = false
  this.interval.zoom(this.pLow, this.pHigh)
}

// Update pLow/pHigh.
//
// On charts with many plots, it would be far more efficient to determine the
// pBounds incrementally, perhaps storing each PointSets range in a tree.
ScalingInterval.prototype.setPBounds = function() {
  var pointsets = this.pointsets
  if (pointsets.length === 0) {
    this.interval.setBounds(this.pLow = 0, this.pHigh = 1)
    return
  }

  var lowProp  = this.lowProp
    , highProp = this.highProp
    , currentLow, currentHigh
  for (var i = 0; i < pointsets.length; i++) {
    var pointset = pointsets[i]
      , low      = pointset[lowProp]
      , high     = pointset[highProp]
    if (i === 0 || low  < currentLow)  currentLow  = low
    if (i === 0 || high > currentHigh) currentHigh = high
  }
  this.interval.setBounds(this.pLow = Math.min(0, currentLow), this.pHigh = currentHigh)
}
