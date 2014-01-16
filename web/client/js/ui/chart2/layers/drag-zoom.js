module.exports = DragZoom

// Click and drag to zoom. If the delta-x of the drag is greater
// than the delta-y, it will zoom in the X direction, and vice-versa.
//
// If the delta is too small, it assumes you zoomed by mistake and will ignore
// it entirely.
//
// Shift click and drag to pan.
//
// options -
//   * ampPan - Number, amplify the pan.
//
function DragZoom(chart, options) {
  this.id        = options.id
  this.chart     = chart
  this.container = chart.container

  this.ampPan     = options.ampPan || 1
  this.dragRegion = null // DOM Element
  this.dragStart  = null // [x, y]
  this.direction  = null // String
  this.isZooming  = false
  this.isPanning  = false

  // The boundaries of the drag rectangle element.
  this.top    = null
  this.left   = null
  this.right  = null
  this.bottom = null

  var _this = this
  d3.select(this.chart.canvas)
    .on("dblclick", function() { _this.onDblClick() })
    .call(d3.behavior.drag()
      .on("dragstart", function() { _this.onDragStart(d3.mouse(this)) })
      .on("drag",      function() { _this.onDragMove(d3.mouse(this)) })
      .on("dragend",   function() { _this.onDragEnd(d3.mouse(this)) }))
}

DragZoom.prototype.destroy = function() {
  d3.select(this.chart.canvas)
    .on("dblclick",  null)
    .on("dragstart", null)
    .on("drag",      null)
    .on("dragend",   null)
  this.chart = this.container = null
  this.dragRegion = this.dragStart = null
}

DragZoom.prototype.render = function() { }

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

// Pop a zoom from the stack on double-click.
DragZoom.prototype.onDblClick = function() { this.chart.controller.popZoom() }

// pt - [x, y]
DragZoom.prototype.onDragStart = function(pt) {
  var ev = d3.event.sourceEvent
  // Only start a drag on left-click.
  if (ev.button !== 0) return
  this.chart.isDragging = true

  // Pan
  if (ev.shiftKey) {
    this.isPanning = true
    this.container.style.cursor = "move"
    return
  }

  // Zoom
  this.isZooming  = true
  this.dragStart  = pt
  this.dragRegion = sail.createElement("div",
    { className: "zoom-region"
    })
  this.container.appendChild(this.dragRegion)
}

DragZoom.prototype.onDragMove = function(pt) {
  if (this.isPanning) {
    this.onPanMove(pt)
  } else if (this.isZooming) {
    this.onZoomMove(pt)
  }
}

DragZoom.prototype.onDragEnd = function(pt) {
  this.chart.isDragging = false
  if (this.isPanning) {
    this.isPanning = false
    this.onPanEnd(pt)
  } else if (this.isZooming) {
    this.isZooming = false
    this.onZoomEnd(pt)
  }
}

////////////////////////////////////////
// Zooming
////////////////////////////////////////

// Draw a rectangle between `this.dragStart` and `pt`, bounded
// by the canvas, but positioned relative the to the container.
//
// pt - [x, y]
//
DragZoom.prototype.onZoomMove = function(pt) {
  var lpad   = this.chart.lpadding
    , tpad   = this.chart.tpadding
    , x0     = this.dragStart[0]
    , y0     = this.dragStart[1]
    , x1     = pt[0]
    , y1     = pt[1]
    , left   = this.left   = Math.max(Math.min(x0, x1), 0)
    , top    = this.top    = Math.max(Math.min(y0, y1), 0)
    , right  = this.right  = Math.min(Math.max(x0, x1), this.chart.width)
    , bottom = this.bottom = Math.min(Math.max(y0, y1), this.chart.height)
    , dx     = right  - left
    , dy     = bottom - top
    , style  = this.dragRegion.style

  // X zoom
  if (dx > dy) {
    style.left  = (left + lpad) + "px"
    style.width = dx    + "px"
    this.setDirection("x")
  // Y zoom
  } else {
    style.top    = (top + tpad) + "px"
    style.height = dy   + "px"
    this.setDirection("y")
  }
}

// pt - [x, y]
DragZoom.prototype.onZoomEnd = function() {
  var dir = this.direction
  if (!dir) return
  // Clean up the drag.
  sail(this.dragRegion).remove()
  this.dragRegion = null
  this.setDirection(null)

  var chart = this.chart
    , isX   = dir === "x"
    , pad   = isX ? chart.lpadding : chart.tpadding
    , v0    = isX ? this.left      : this.bottom
    , v1    = isX ? this.right     : this.top
    , zfn   = isX ? "zoomX"        : "zoomY"
    , conv  = isX ? "domainToPx"   : "rangeToPx"
  // If the range is small, assume it was accidental and don't zoom in.
  if (Math.abs(v1 - v0) < 15) return

  // Actually zoom. Convert to number b/c the time scale returns Date.
  chart.controller[zfn](+chart[conv].invert(v0),
                        +chart[conv].invert(v1))
}

// dir - String "x" or "y".
DragZoom.prototype.setDirection = function(dir) {
  if (this.direction === dir) return
  this.direction = dir
  this.container.style.cursor
    = dir === "x" ? "ew-resize"
    : dir === "y" ? "ns-resize"
    : null

  var region = dir && this.dragRegion.style
  if (dir === "x") {
    region.top    = this.chart.tpadding + "px"
    region.height = this.chart.height   + "px"
  } else if (dir === "y") {
    region.left   = this.chart.lpadding + "px"
    region.width  = this.chart.width    + "px"
  }
}

////////////////////////////////////////
// Panning
////////////////////////////////////////
DragZoom.prototype.onPanMove = function(pt) {
  var ev    = d3.event
    , chart = this.chart
    , amp   = this.ampPan
  chart.controller.panBy(
    -ev.dx / chart.scaleX * amp,
    -ev.dy / chart.scaleY * amp)
}

DragZoom.prototype.onPanEnd = function() {
  this.container.style.cursor = null
  this.chart.controller.panDone()
}
