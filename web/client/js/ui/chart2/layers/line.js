var Plot       = require('./plot')
  , XYPointSet = require('../models/point-set/xy')
  , inherits   = require('util').inherits

module.exports = LineChart

///
/// A simple line plot.
///
function LineChart(chart, options) {
  Plot.call(this, chart, options)
  this.setPoints(new XYPointSet(options))
}

inherits(LineChart, Plot)

LineChart.prototype.render = function() {
  var pointSet = this.points
    , points   = pointSet.data
    , xAttr    = pointSet.xAttr
    , yAttr    = pointSet.yAttr
    , context  = this.context
    , chart    = this.chart
    , xMin     = chart.getXMin(), scaleX = chart.scaleX
    , yMin     = chart.getYMin(), scaleY = chart.scaleY
    , height   = chart.height
    , beginI   = chart.minIndex(pointSet)
    , endI     = chart.maxIndex(pointSet)
    , first    = points[beginI]
    , point

  if (!first) return

  context.beginPath()
  context.moveTo((first[xAttr]       - xMin) * scaleX,
                ((first[yAttr] || 0) - yMin) * scaleY + height)

  for (var i = beginI + 1; i < endI; i++) {
    point = points[i]
    context.lineTo((point[xAttr]       - xMin) * scaleX,
                  ((point[yAttr] || 0) - yMin) * scaleY + height)
  }

  context.strokeStyle = this.color
  context.lineWidth   = 1
  context.stroke()
}
