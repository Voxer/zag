module.exports = Plot

/// A generic plot.
function Plot(chart, options) {
  this.chart   = chart // ChartView
  this.context = chart.context
  this.id      = options.id // String
  this.label   = options.label
  this.color   = options.color || "#ff0000"
  this.points  = null
}

Plot.prototype.isPlot = true

// Default: circle
Plot.prototype.labelMarker = null

Plot.prototype.destroy = function() {
  this.chart.bPoints.remove(this.points)
  this.points.destroy()
  this.chart = this.context = this.points = null
}

// points - PointSet
Plot.prototype.setPoints = function(points) {
  this.points = points
  points.prepare()
  this.chart.bPoints.push(points)
}

Plot.prototype.setData = function(data) {
  this.points.setData(data)
  // The Y min/max may have changed.
  this.chart.bPoints.rescale()
}
