module.exports = PointSet

/// A collection of points to render. They must at least have an X coordinate.
///
/// options -
///   * getX(Point)->Number (optional)
///   * data - [Point]
///
function PointSet(options) {
  this.xMin = this.xMin == null ? null : this.xMin
  this.xMax = this.xMax == null ? null : this.xMax
  this.yMin = this.yMin == null ? null : this.yMin
  this.yMax = this.yMax == null ? null : this.yMax
  this.getX = this.getX || options.getX

  this.setData(options.data)
}

PointSet.prototype.destroy = function() {
  this.data = this.getX = null
}

PointSet.prototype.prepare = function() {}

PointSet.prototype.setData = function(data) {
  this.data = data
  this.setBounds()
}

/// Override
PointSet.prototype.setBounds = function() {}
PointSet.prototype.makePoint = function(index, y) {}

////////////////////////////////////////////////////////////////////////////////
// Point finding
////////////////////////////////////////////////////////////////////////////////

PointSet.prototype.findPoint = function(ts, y) {
  var index = this.xToIndexExact(ts)
  if (index === -1) return null
  return this.makePoint(index, y)
}

// Get the offset in the plot's data to the point nearest to the given X value.
//
// ts - Number, x coordinate (usually a timestamp).
//
// Returns Integer offset in the data Array.
// Returns -1 if there are no points.
PointSet.prototype.xToIndexApprox = function(ts) {
  var points = this.data
    , getX   = this.getX
    , min    = 0
    , max    = points.length - 1

  while (min <= max) {
    var mid   = Math.floor((min + max) / 2)
      , point = points[mid]
      , cmp   = getX(point)
    // ...*.X...
    if (cmp < ts) {
      var nextPoint = points[mid + 1]
      if (!nextPoint || ts - cmp < Math.abs(getX(nextPoint) - ts)) {
        return mid
      }
      min = mid + 1
    // ...X.*...
    } else if (cmp > ts) {
      var prevPoint = points[mid - 1]
      if (!prevPoint || cmp - ts < Math.abs(getX(prevPoint) - ts)) {
        return mid
      }
      max = mid - 1
    } else { return mid }
  }
  return -1
}

// Get the offset in the plot's data to the point with the given X value.
//
// ts - Number, x coordinate.
//
// Returns Integer index of the timestamp.
// Returns -1 if not found.
PointSet.prototype.xToIndexExact = function(ts) {
  var points = this.data
    , getX   = this.getX
    , min    = 0
    , max    = points.length - 1

  while (min <= max) {
    var mid   = Math.floor((min + max) / 2)
      , point = points[mid]
      , cmp   = getX(point)
    if      (cmp < ts) min = mid + 1
    else if (cmp > ts) max = mid - 1
    else return mid
  }
  return -1
}
