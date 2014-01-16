var XYDataSet = require('./xy')
  , inherits  = require('util').inherits

module.exports = StackPointSet

/// A single layer of a stack graph.
/// Multiple stacks are kept synced by a `StackLayers`.
///
/// options - +XYDataSet
///   * layers - StackLayers
///
function StackPointSet(options) {
  this.origData = null
  this.layers   = options.layers

  this.origXAttr = options.x
  this.origYAttr = options.y
  options.x      = "x"
  options.y      = "y"
  XYDataSet.call(this, options)

  this.layers.push(this)
}

inherits(StackPointSet, XYDataSet)

StackPointSet.prototype.destroy = function() {
  this.origData = null
  this.layers.remove(this)
  this.layers = null
  XYDataSet.prototype.destroy.call(this)
}

StackPointSet.prototype.getLabel = function(index, y) {
  var point = this.origData[index]
  return point ? point[this.origYAttr] : 0
}

// Recompute stacks if dirty.
StackPointSet.prototype.prepare = function() { this.layers.clean() }

// origData - [{ <xAttr>, <yAttr> }]
StackPointSet.prototype.setData = function(origData) {
  this.origData = origData
  this.layers.setDirty(this)
}

// Get the StackPointSet below this one.
//
// Returns StackPointSet or null
StackPointSet.prototype.prevStack = function() {
  var layers = this.layers.layers
  return layers[layers.indexOf(this) - 1] || null
}

////////////////////////////////////////////////////////////////////////////////
// Stacking
////////////////////////////////////////////////////////////////////////////////

//
// prevStack - StackPointSet or null
//   If null, assume this is the bottom stack.
//
StackPointSet.prototype.restack = function(prevStack) {
  XYDataSet.prototype.setData.call(this,
    prevStack ? this.addTo(prevStack.data)
              : this.addToBottom())
}

///
/// What follows is a bunch of nasty code to stack arrays of points.
///
/// e.g.: If the layer Ys are:
///
///  layer 0: [1, 2, 3, 4, 5, 6, 7, 8, 9]
///  layer 1: [2, 4, 2, 4, 2, 4, 2, 4, 2]
///  layer 2: [1, 1, 1, 1, 1, 1, 1, 1, 1]
///
/// then the stacked versions are:
///
///  layer 0: [1, 2, 3, 4, 5,  6,  7,  8,  9]  (unchanged)
///  layer 1: [3, 6, 5, 8, 7, 10,  9, 12, 11]  (layer 0 + layer 1)
///  layer 2: [4, 7, 6, 9, 8, 11, 10, 13, 12]  (layer 0 + layer 1 + layer 2)
///

// Layer this stack on top of the given one.
// TODO reuse `this.data` if possible so doesn't allocate so many points
//
// points1 - [{x, y}], the layer to build off of.
//
// Returns [Point]
StackPointSet.prototype.addTo = function(points1) {
  var points2  = this.origData
    , pointsTo = []
    , xAttr    = this.origXAttr
    , yAttr    = this.origYAttr
    , length1  = points1.length, pt1 = points1[0]
    , length2  = points2.length, pt2 = points2[0]
    , i1 = 0, i2 = 0

  while (i1 < length1 || i2 < length2) {
    var x1 = pt1 && pt1.x
      , x2 = pt2 && pt2[xAttr]
    if (x1 === x2) {
      pointsTo.push(new Point(x1, pt1.y + pt2[yAttr]))
      pt1 = points1[++i1]
      pt2 = points2[++i2]
    } else if (x2 === undefined || x1 < x2) {
      pointsTo.push(new Point(x1, pt1.y))
      pt1 = points1[++i1]
    } else {
      pointsTo.push(new Point(x2, pt2[yAttr]))
      pt2 = points2[++i2]
    }
  }
  return pointsTo
}

// This stack is on the bottom, so copy it's values from `origData`.
// TODO reuse `this.data`
//
// Returns [Point]
StackPointSet.prototype.addToBottom = function() {
  var origData = this.origData
    , length   = origData.length
    , sumData  = new Array(length)
    , xAttr    = this.origXAttr
    , yAttr    = this.origYAttr

  for (var i = 0; i < length; i++) {
    var origPt = origData[i]
    sumData[i] = new Point(origPt[xAttr], origPt[yAttr])
  }
  return sumData
}

function Point(x, y) {
  this.x = x
  this.y = y || 0
}
