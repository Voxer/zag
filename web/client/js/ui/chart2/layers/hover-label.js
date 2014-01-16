var dateToString = require('../../../../../lib/date-utils').dateToString
  , reqFrame     = require('../utils/raf')
  , HoverLine    = require('./hover-line')
  , formatYBig   = d3.format(",.2f")
  , formatYSmall = d3.format(",.4f")
  , SHOW         = null
  , HIDE         = "none"

module.exports = HoverLabel


// Display a label when hovering over the graph on the nearest point,
// displaying its actual value and key name.
//
// The hover label consists of DOM nodes, not canvas.
//
// The while label consists of 4 elements:
//   .hover-circle: A hollow circle that hovers over the nearest plot point.
//      It's rim's color is the same as the line's.
//   .hover-value-label: A label that is next to the circle with the point's value.
//   .hover-date-label: A label at the top of the plot showing the nearest date.
//   .hover-track-x: A vertical line showing what `.hover-date-label` is referring to.
//
function HoverLabel(chart, options) {
  this.id    = options.id
  this.chart = chart

  // HTML elements.
  this.circle    = makeLabel("hover-circle")
  this.valLabel  = makeLabel("hover-label hover-value-label")
  this.dateLabel = makeLabel("hover-label hover-date-label", chart.tpadding)
  this.vLine     = new HoverLine(chart)
  this.vLineBack = new HoverLine(chart)
  this.onResize()

  sail(this.chart.container)
    .append(this.dateLabel)
    .append(this.valLabel)
    .append(this.circle)

  this.isVisible    = HIDE
  this.isValVisible = HIDE
  this.markerType   = null // null or String (e.g. "heat")
  // requestAnimationFrame info.
  this.hasAnimReq   = false
  this.animEv       = null

  var _this = this
  d3.select(chart.canvas)
    .on("mousemove.label", function() { _this.onMouseMove(d3.event) })
  d3.select(chart.container)
    .on("mouseout.label",  function() { _this.onMouseOut(d3.mouse(this), d3.event) })

  var _this = this
  this.chart.xInterval.on("hover:x", this._onHoverX = function(x, ts) {
    _this.vLine.moveTo(x)
    _this.vLineBack.moveTo(x === null ? x : backLineDelta(chart, ts))
  })
}

HoverLabel.prototype.destroy = function() {
  // Since an updateNow might be waiting on nextTick, prevent it from drawing.
  this.isVisible = HIDE
  this.vLine.destroy()
  this.vLineBack.destroy()
  this.chart.xInterval.removeListener("hover:x", this._onHoverX)

  this.chart = null
  this.circle = this.valLabel = this.dateLabel = null
  this.vLine = this.vLineBack = this._onHoverX = null
}

// Redraw using the most recent mouse event.
HoverLabel.prototype.render = function() {
  if (this.animEv) this.update(this.animEv)
}

HoverLabel.prototype.onResize = function() {
  this.vLine.onResize()
  this.vLineBack.onResize()
  // Hiding is better than being temporarily mis-positioned when the bounds change.
  this.hide()
}

// Draw/redraw the label.
// This doesn't repaint immediately, it will wait until the next animation frame.
//
// x - Integer, pixel offset relative to the canvas.
// y - Integer, pixel offset relative to the canvas.
//
HoverLabel.prototype.update = function(ev) {
  this.animEv = ev
  if (this.hasAnimReq) return

  var _this = this
  reqFrame(function() { _this.updateNow() })
  this.hasAnimReq = true
}

HoverLabel.prototype.updateNow = function() {
  this.hasAnimReq = false
  if (this.isVisible === HIDE) return

  var ev       = this.animEv
    , x        = ev.offsetX
    , y        = ev.offsetY
    , chart    = this.chart
    , xPoint   = chart.findX(x)
    , offsetX  = xPoint && xPoint.x
    , offsetTs = xPoint && xPoint.ts

  if (!xPoint) return

  /// Vertical line.
  this.onHoverX(offsetX, offsetTs)

  var left = null, right = null
  // Swing the labels around to the side with more room.
  if (offsetX - chart.lpadding < chart.fullWidth / 2) {
    left  = offsetX + "px"
  } else {
    right = (chart.fullWidth - offsetX - 1) + "px"
  }

  /// Date label.
  this.dateLabel.style.left  = left
  this.dateLabel.style.right = right
  this.dateLabel.textContent = dateToString(new Date(offsetTs))

  /// Value label.
  var yPoint = chart.findY(offsetTs, y)
  if (!yPoint) {
    return this.setValueDisplay(HIDE)
  }
  this.setValueDisplay(SHOW)

  var offsetY = yPoint.yOffset
    , layer   = yPoint.layer
    , label   = yPoint.label
    , format  = typeof label === "string" ? ident
              : label < 1 ? formatYSmall : formatYBig

  this.valLabel.style.top   = offsetY + "px"
  this.valLabel.style.left  = left
  this.valLabel.style.right = right
  this.valLabel.textContent = layer.label + " : " + format(label)

  // Circle marker
  this.circle.style.left        = offsetX + "px"
  this.circle.style.top         = offsetY + "px"
  this.circle.style.borderColor = layer.color
  this.setMarkerType(layer.labelMarker, layer)
}

////////////////////////////////////////
// Visibility
////////////////////////////////////////

HoverLabel.prototype.show = function() { this.setDisplay(SHOW) }
HoverLabel.prototype.hide = function() { this.setDisplay(HIDE) }

// style - HIDE or SHOW.
HoverLabel.prototype.setDisplay = function(style) {
  if (this.isVisible === style && this.isValVisible === style) return
  this.isVisible = this.dateLabel.style.display = style
  if (style === HIDE) this.onHoverX(null)
  this.setValueDisplay(style)
}

// The value labels have a separate visibility.
//
// They can be invisible while the vline/date are visible when their target
// point is off-canvas.
//
// style - HIDE or SHOW.
//
HoverLabel.prototype.setValueDisplay = function(style) {
  if (this.isValVisible === style) return
  this.isValVisible           = style
  this.valLabel.style.display = style
  this.circle.style.display   = style
}

// TODO this is too tightly bound to heat maps
//
// type - null or String
//
HoverLabel.prototype.setMarkerType = function(type, extra) {
  if (type === this.markerType) return
  this.circle.className
    = "hover-circle"
    + (type ? " hover-mark-" + type : "")

  var style = this.circle.style
  if (type === "rect") {
    var w = extra.blockW
      , h = extra.blockH
    style.width  = w + "px"
    style.height = h + "px"
    this.markerType = type + ":" + w + ":" + h
  } else {
    style.width  = null
    style.height = null
    this.markerType = type
  }
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////
HoverLabel.prototype.onMouseMove = function(ev) {
  if (this.chart.isDragging) {
    if (this.isVisible === SHOW) this.hide()
    return
  }
  if (this.isVisible === HIDE) this.show()
  this.update(ev)
}

// Hide on mouse out.
HoverLabel.prototype.onMouseOut = function(pt, ev) {
  var x     = pt[0]
    , y     = pt[1]
    , chart = this.chart
  if (x <= chart.lpadding || x >= chart.lpadding + chart.width
   || y <= chart.tpadding || y >= chart.tpadding + chart.height
   || (ev.relatedTarget && !contains(this.chart.container, ev.relatedTarget))) {
    this.hide()
  }
}

HoverLabel.prototype.onHoverX = function(left, ts) {
  this.chart.xInterval.interval.emit("hover:x", left, ts)
}

function contains(container, target) {
  return target.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_CONTAINS
}

function makeLabel(className, top) {
  var label = document.createElement("div")
  label.className = className
  label.style.display = "none"
  if (top !== undefined) {
    label.style.top = top + "px"
  }
  return label
}

function ident(x) { return x }

var dayMS  = 1000 * 60 * 60 * 24
  , weekMS = dayMS * 7
// chart  - ChartView
// origTs - Integer timestamp
// Returns Integer timestamp or null
function backLineDelta(chart, origTs) {
  var dx   = chart.getXMax() - chart.getXMin()
    , back = dx < dayMS  ? null
           : dx < weekMS ? dayMS
           : weekMS
    , left = chart.domainToPx(origTs - back)
  return back && left > 0 && (left + chart.lpadding)
}
