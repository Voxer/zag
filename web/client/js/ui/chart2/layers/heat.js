var Plot            = require('./plot')
  , LLQPointSet     = require('../models/point-set/llq')
  , HeatMapPointSet = require('../models/point-set/heat')
  , inherits        = require('util').inherits
  , ROWS            = 40

module.exports = HeatMap

HeatMapPointSet.format = d3.format(",.1f")

/// TODO separate view for LLQ/Heat
/// A heat map.
///
/// options -
///   * id    - String
///   * data  - [ [ts, yOffset, freqGradient, ...] ]
///   * color - String
///   * label - String
///
function HeatMap(chart, options) {
  Plot.call(this, chart, options)
  this.blockW = null
  this.blockH = null
  this.setPoints(new LLQPointSet(
    { base:   2
    , steps: 16
    , rows:  ROWS
    , data:  options.data
    }))
}

inherits(HeatMap, Plot)

HeatMap.prototype.labelMarker = "rect"

HeatMap.prototype.render = function() {
  var pointSet = this.points
    , chart    = this.chart
    , xMin     = chart.getXMin(), xMax = chart.getXMax()
    , yMin     = chart.getYMin(), yMax = chart.getYMax()
    , scaleX   = chart.scaleX
    , scaleY   = chart.scaleY
  pointSet.setRows(
    ROWS * Math.round( (chart.getPYMax() - chart.getPYMin())
                     / (yMax             - yMin) ))

  // Need at least 2 columns to determine the block width.
  var columns = pointSet.data
  if (columns.length < 2) return

  var context  = this.context
    , interpol = interpolate(this.color)
    , height   = chart.height
    , beginI   = chart.minIndex(pointSet)
    , endI     = chart.maxIndex(pointSet)
    , dy       = pointSet.dy
    , blockW   = this.blockW =  scaleX * (columns[1][0] - columns[0][0])
    , blockH   = this.blockH = -scaleY * dy
  for (var i = beginI; i < endI; i++) {
    var column = columns[i]
      , ts     = column[0]
      , x      = (ts - xMin) * scaleX - blockW / 2
    for (var row = 1, rowL = column.length; row < rowL; row += 3) {
      var yOff = column[row]
      // Don't render non-visible blocks
      if (yOff > yMax) break
      if (yOff < yMin - dy) continue

      context.fillStyle = interpol(column[row + 2])
      context.fillRect(
        x,      (yOff - yMin) * scaleY + height - blockH,
        blockW, blockH)
    }
  }
}

// Create a color gradient for the base color.
function interpolate(base) {
  var light = d3.hsl(base)
  light.s = 0
  light.l = 0.9
  return d3.interpolateHsl(light, base)
}
