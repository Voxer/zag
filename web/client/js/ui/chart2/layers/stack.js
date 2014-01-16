var Plot          = require('./plot')
  , StackPointSet = require('../models/point-set/stack')
  , StackLayers   = require('../models/stack-layers')
  , inherits      = require('util').inherits

module.exports = StackChart

/// A stacked area plot.
///
/// options -
///   * id    - String
///   * data  - [{xAttr, yAttr}]
///   * x, y  - String, Point property name mappings.
///   * color - String
///   * label - String
///
function StackChart(chart, options) {
  Plot.call(this, chart, options)

  var fill = d3.rgb(this.color).hsl()
  fill.l = 0.8
  this.fillColor = fill.toString()

  options.layers = chart._stacks || (chart._stacks = new StackLayers())
  this.setPoints(new StackPointSet(options))
}

inherits(StackChart, Plot)

StackChart.prototype.render = function() {
  var chart      = this.chart
    , context    = this.context
    , pointSet   = this.points
    , upper      = pointSet.data
    , lowerStack = pointSet.prevStack()
    , lower      = lowerStack && lowerStack.data
    , beginI     = chart.minIndex(pointSet)
    , endI       = chart.maxIndex(pointSet)
    , first      = upper[beginI]
    , domainToPx = chart.domainToPx
    , rangeToPx  = chart.rangeToPx
    , point, last

  context.beginPath()
  context.moveTo(domainToPx(first.x), rangeToPx(first.y))

  // Start at the upper bounds.
  for (var i = beginI + 1; i < endI; i++) {
    point = upper[i]
    if (!point) continue
    last  = point
    context.lineTo(domainToPx(point.x), rangeToPx(point.y) + 1.5)
  }

  context.strokeStyle = this.color
  context.lineWidth   = 2.5
  context.stroke()

  // Now down to the lower bounds (backwards, so it doesn't cross itself).
  if (lower) {
    for (var i = endI - 1; i >= beginI; i--) {
      point = lower[i]
      if (!point) continue
      context.lineTo(domainToPx(point.x), rangeToPx(point.y))
    }
  // The bottom.
  } else {
    context.lineTo(domainToPx(last.x),  rangeToPx(0))
    context.lineTo(domainToPx(first.x), rangeToPx(0))
  }

  context.fillStyle = this.fillColor
  context.fill()
}
