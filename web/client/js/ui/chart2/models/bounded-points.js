var CappedInterval  = require('./capped-interval')
  , ScalingInterval = require('./scaling-interval')

module.exports = BoundedPoints

/// Combine X and a Y intervals.
///
/// `xInterval` is not created here because it is shared if the chart is synced.
///
/// xInterval - CappedInterval
/// delta     - Integer
///
function BoundedPoints(xInterval, delta) {
  this.pointsets = []
  this.xInterval = xInterval
  this.yInterval = new ScalingInterval(
    { lowProp:   "yMin"
    , highProp:  "yMax"
    , delta:      delta
    , pointsets:  this.pointsets
    })
}

// opts -
//   low, high - Number, default xMin (required)
//   min, max  - Number, (max aka theEnd), (optional)
// Returns CappedInterval
BoundedPoints.xInterval = function(opts) { return new CappedInterval(opts) }

BoundedPoints.prototype.destroy = function() {
  this.yInterval.destroy()
  this.pointsets = this.xInterval = this.yInterval = null
}

// dx, dy - Number
BoundedPoints.prototype.panBy = function(dx, dy) {
  if (dx) this.xInterval.panBy(dx)
  if (dy) this.yInterval.panBy(dy)
}

BoundedPoints.prototype.panDone = function() {
  this.xInterval.panDone()
  this.yInterval.panDone()
}

// pointSet - PointSet
BoundedPoints.prototype.push   = function(pointSet) { this.yInterval.push(pointSet) }
BoundedPoints.prototype.remove = function(pointSet) { this.yInterval.remove(pointSet) }
// Called when the `pointsets` has had a member added/removed/modified.
BoundedPoints.prototype.rescale = function() { this.yInterval.rescale() }
// Changing the delta can change the Y scale, but the X scale stays the same,
// so only the Y should get its zoom reset.
BoundedPoints.prototype.setDelta = function(delta) { this.yInterval.setDelta(delta) }

// Pop the most recent zoom from one or the other interval.
BoundedPoints.prototype.popZoom = function() {
  var xClock = this.xInterval.getZoomClock()
    , yClock = this.yInterval.getZoomClock()
  if      (!xClock && !yClock) return
  else if ( xClock && !yClock) this.xInterval.popZoom()
  else if (!xClock &&  yClock) this.yInterval.popZoom()
  else if ( xClock  <  yClock) this.yInterval.popZoom()
  else                         this.xInterval.popZoom()
}
