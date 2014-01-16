var PointSet = require('./point-set')
  , inherits = require('util').inherits

module.exports = XYDataSet

///
/// options -
///   * data - [{xAttr, yAttr}]
///   * x    - String, X attribute
///   * y    - String, Y attribute
///
function XYDataSet(options) {
  var  xAttr =
  this.xAttr = options.x
  this.yAttr = options.y
  this.getX  = function(pt) { return pt[xAttr] }

  PointSet.call(this, options)
}

inherits(XYDataSet, PointSet)

XYDataSet.prototype.setBounds = function() {
  if (!this.data.length) {
    this.xMin = this.xMax = this.yMin = this.yMax = null
    return
  }

  var xAttr = this.xAttr
    , yAttr = this.yAttr
    , data  = this.data
    , first = data[0]
    , xMin  = first[xAttr], yMin = 0
    , xMax  = first[xAttr], yMax = first[yAttr] || 0

  // Bounds
  for (var i = 1, l = data.length; i < l; i++) {
    var pt = data[i]
      , x  = pt[xAttr]
      , y  = pt[yAttr] || 0
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }

  this.xMin = xMin; this.yMin = yMin
  this.xMax = xMax; this.yMax = yMax
}

XYDataSet.prototype.makePoint = function(index, y) {
  return { y:     this.data[index][this.yAttr] || 0
         , label: this.getLabel(index)
         }
}

//
// index - Integer index to `data`.
//
// Returns Number.
XYDataSet.prototype.getLabel = function(index) {
  return this.data[index][this.yAttr] || 0
}
