var PointSet = require('./point-set')
  , inherits = require('util').inherits

module.exports = HeatMapPointSet

///
/// options -
///   * data - [ [x, y, freq, gradient, ...], ...]
///   * yMax - Number, the top of the highest block.
///   * dy   - Number, the height of each block.
///
function HeatMapPointSet(options) {
  this.getX = getFirst
  this.yMax = options.yMax
  this.dy   = options.dy

  PointSet.call(this, options)
}

inherits(HeatMapPointSet, PointSet)

HeatMapPointSet.prototype.setBounds = function() {
  var data = this.data
  if (data.length) {
    this.xMin = data[0][0]
    this.xMax = data[data.length - 1][0]
  }
  this.yMin = 0
  // yMax is passed in on `options`.
}

HeatMapPointSet.prototype.makePoint = function(index, y) {
  var column = this.data[index]
    , dy     = this.dy
    , yValue, freq
  // TODO binary search
  for (var i = 1; i < column.length; i+=3) {
    yValue = column[i]
    if (yValue <= y && y <= yValue + dy) {
      return { y:     yValue + dy/2
             , label: HeatMapPointSet.format(yValue)
                    + " \u2192 "
                    + HeatMapPointSet.format(yValue + dy) // "\u2192" is "&rarr;"
                    + " (f="
                    +   HeatMapPointSet.format(column[i + 1])
                    + ")"
             }
    }
  }
  return null
}

HeatMapPointSet.format = format

function format(n) {
  return n < 1 ? n.toFixed(3) : Math.round(n).toString()
}

function getFirst(arr) { return arr[0] }
