module.exports = HoverLine

/// A line that tracks the mouse position on the chart.
///
/// chart   - ChartView
/// options -
///
function HoverLine(chart, options) {
  this.chart              = chart
  this.line               = document.createElement("div")
  this.line.className     = "hover-track-x"
  this.line.style.top     = chart.tpadding + "px"
  this.line.style.display = "none"
  this.isVisible          = false

  this.onResize()
  this.chart.container.appendChild(this.line)
}

HoverLine.prototype.destroy = function() {
  this.chart = this.line = this._onHoverX = null
}

// Rendering is done in response to mouse events.
HoverLine.prototype.render = function() { }

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

HoverLine.prototype.onResize = function() {
  this.line.style.height = this.chart.height + "px"
}

// left - Integer pixels or null.
HoverLine.prototype.moveTo = function(left) {
  if (!left || left < 0) return this.setVisible(false)
  this.setVisible(true)
  this.line.style.left = left + "px"
}

HoverLine.prototype.setVisible = function(isVisible) {
  if (this.isVisible === isVisible) return
  this.isVisible          = isVisible
  this.line.style.display = isVisible ? null : "none"
}
