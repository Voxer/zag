var reqFrame = require('./utils/raf')
  , LayerSet = require('./models/layer-set')

module.exports = ChartView

function noop() {}

///
///
/// 2d canvas resources:
///   * http://www.w3.org/TR/2dcontext/
///   * http://diveintohtml5.info/canvas.html
///
/// Options
///
///   * plots    - Call plot() for each.
///   * haxXAxis - Boolean, default: true
///   * hasYAxis - Boolean, default: true
///   * hasLabel - Boolean, default: true
///   * canZoom  - Boolean, default: true
///   * ampPan   - Number, default: 1. Multiply the pan distance.
///   * tags     - [{label, color, ts}]
///   * onEditTag(tag)
///   * onNewTag(ts)
///
function ChartView(controller, container, options) {
  options = options || {}

  this.controller = controller
  this.container  = container
  this.layers     = new LayerSet()
  this.isDragging = false

  this.bPoints   = controller.bPoints
  this.xInterval = controller.xInterval
  this.yInterval = controller.yInterval

  this.scaleX = 1
  // `scaleY` is always negative because in canvas2d the Y axis increases down.
  this.scaleY = -1

  this.canvas  = document.createElement("canvas")
  container.appendChild(this.canvas)
  this.context = this.canvas.getContext("2d")

  this.renderPending = false
  var _this = this
  this._renderAllNow = function() { _this.renderAllNow() }

  /// Initialize canvas dimensions.
  this.lpadding = options.lpadding || 40
  this.tpadding = options.tpadding || 20
  this.onResize(true)

  this._stacks = null // StackLayer

  /// Initial layers.
  if (options.hasXAxis !== false) this.plot({type: "xaxis", id: "_xAxis"}, true)
  if (options.hasYAxis !== false) this.plot({type: "yaxis", id: "_yAxis"}, true)
  if (options.hasLabel !== false) this.plot({type: "label", id: "_label"}, true)
  if (options.canZoom  !== false) this.plot({type: "zoom",  id: "_zoom", ampPan: options.ampPan}, true)

  /// Tags
  this.plot(
    { type:   "tags"
    , id:     "_tags"
    , editTag: options.onEditTag || noop
    , newTag:  options.onNewTag  || noop
    }, true)
  if (options.tags) this.setTags(options.tags, true)

  if (options.plots) {
    this.plotMany(options.plots)
  } else {
    this.renderAll()
  }
  this.onAspectRatioChange()
}

var Axis = require('./layers/axis')

ChartView.Layers =
  { line:  require('./layers/line')
  , stack: require('./layers/stack')
  , heat:  require('./layers/heat')
  , label: require('./layers/hover-label')
  , zoom:  require('./layers/drag-zoom')
  , tags:  require('./layers/tags')
  , xaxis: Axis.X
  , yaxis: Axis.Y
  }

////////////////////////////////////////////////////////////////////////////////
// Rendering
////////////////////////////////////////////////////////////////////////////////

// Redraw everything (on the next animation frame).
ChartView.prototype.renderAll = function() {
  if (this.renderPending) return
  this.renderPending = true
  reqFrame(this._renderAllNow)
}

// Redraw everything (immediately).
ChartView.prototype.renderAllNow = function() {
  if (!this.controller) return // prevent RAF race

  this.renderPending = false
  this.layers.prepare()

  var context = this.context
  context.clearRect(0, 0, this.width, this.height);
  this.layers.render()
}

// Call this when the container is resized.
ChartView.prototype.onResize = function(init) {
  if (!init) this.context.clearRect(0, 0, this.width, this.height);

  this.fullWidth  = this.container.clientWidth
  this.fullHeight = this.container.clientHeight - 3
  this.width      = this.fullWidth  - 2 * this.lpadding
  this.height     = this.fullHeight - 2 * this.tpadding
  d3.select(this.canvas)
    .attr("width",  this.width)
    .attr("height", this.height)
    .style(
      { position: "relative"
      , left: this.lpadding + "px"
      , top:  this.tpadding + "px"
      })

  if (init) return

  this.layers.onResize()
  this.onAspectRatioChange()
  this.renderAll()
}

ChartView.prototype.destroy = function() {
  this.layers.destroy()
  this.layers = null
  this.bPoints = this.xInterval = this.yInterval = null

  this._stacks && this._stacks.destroy()
  this._stacks = null

  this.controller = null
  this.container = this.canvas = this.context = null
}

// Add a layer.
//
// options        - {id, type} and other Layer options.
// suppressRender - Boolean For internal use.
//
// Returns the new Layer.
ChartView.prototype.plot = function(options, suppressRender) {
  var layer = new ChartView.Layers[options.type](this, options)
  this.layers.push(layer)
  if (!suppressRender) this.renderAll()
  return layer
}

// Bulk plot.
//
// plots          - An Array of `ChartView#plot` options.
// suppressRender - Boolean
//
ChartView.prototype.plotMany = function(plots, suppressRender) {
  // Create all the  layers before rendering any so that the graph will
  // get resized (at most) once.
  for (var i = 0, l = plots.length; i < l; i++) {
    this.plot(plots[i], true)
  }
  if (!suppressRender) this.renderAll()
}

// Remove a plot.
//
// layerID        - String
// suppressRender - Boolean. For internal use.
//
ChartView.prototype.unplot = function(layerID, suppressRender) {
  this.layers.remove(layerID)
  if (!suppressRender) this.renderAll()
}


// Re-use the ChartView object for a completely different set of Plots.
//
// newPlots - Array of Plot options.
//
ChartView.prototype.reset = function(newPlots) {
  var plots = this.layers.getPlots()
  for (var i = 0; i < plots.length; i++) {
    this.unplot(plots[i].id, true)
  }
  this.plotMany(newPlots)
}

////////////////////////////////////////////////////////////////////////////////
// Bounds
////////////////////////////////////////////////////////////////////////////////

// Call this whenever the aspect ratio changes (on resize or zoom).
ChartView.prototype.onAspectRatioChange = function() {
  var x0 = this.getXMin(), y0 = this.getYMin()
    , x1 = this.getXMax(), y1 = this.getYMax()
  this.scaleX =  this.width  / (x1 - x0)
  this.scaleY = -this.height / (y1 - y0)
  this.domainToPx = d3.time.scale().domain([x0, x1]).range([0, this.width])
  this.rangeToPx  = d3.scale.linear().domain([y0, y1]).range([this.height, 0])
}


////////////////////////////////////////////////////////////////////////////////
// Coordinate conversion
////////////////////////////////////////////////////////////////////////////////

// Find the nearest index in the `data` to `x`.
//
// The `x` value that is returned is the offset relative to the unscaled chart.
//
// x - Float, pixels relative to the chart.
//
// Returns {ts, x}.
ChartView.prototype.findX = function(x) {
  var layers   = this.layers.getPlots()
    , ts       = +this.domainToPx.invert(x)
    , bestDiff = Infinity
    , bestPoint

  for (var i = 0, l = layers.length; i < l; i++) {
    var pointSet = layers[i].points
      , index    = pointSet.xToIndexApprox(ts)

    // Out of bounds.
    if (index === -1) continue

    var nearestTs = pointSet.getX(pointSet.data[index])
      , diff      = Math.abs(nearestTs - ts)
    if (diff < bestDiff) {
      bestDiff  = diff
      bestPoint =
        { ts: nearestTs
        , x:  Math.floor(this.domainToPx(nearestTs)) + this.lpadding
        }
    }
  }
  return bestPoint
}

// Find the nearest visible point in the `data` to `y`.
//
// ts - Number, exact X value to search at. (the X)
// y  - Float, pixels relative to canvas.
//
// Returns {label, layer, yOffset}
ChartView.prototype.findY = function(ts, y) {
  var layers    = this.layers.getPlots()
    , rangeToPx = this.rangeToPx
    , tpadding  = this.tpadding
    , yMin      = this.getYMin()
    , yMax      = this.getYMax()
    , currentDiff, currentPoint
  for (var i = 0, l = layers.length; i < l; i++) {
    var layer    = layers[i]
      , pointSet = layer.points
      , point    = pointSet.findPoint(ts, rangeToPx.invert(y))
    if (!point) continue

    var yValue = point.y
    // Only return visible points.
    if (yValue > yMax || yValue < yMin) continue

    var yOffset = rangeToPx(yValue)
      , diff    = Math.abs(yOffset - y)
    if (!currentPoint || diff < currentDiff) {
      currentDiff          = diff
      currentPoint =
        { yOffset: yOffset + tpadding
        , layer:   layer
        , label:   point.label
        }
    }
  }
  return currentPoint
}

// Get the index of the first point to plot.
// Inclusive.
//
// Returns Integer Index in `data`.
ChartView.prototype.minIndex = function(pointset) {
  return Math.max(0, pointset.xToIndexApprox(this.getXMin()) - 1)
}

// Get the index of the last point to plot.
// Exclusive.
//
// Returns Integer Index in `data`.
ChartView.prototype.maxIndex = function(pointset) {
  return Math.min(pointset.data.length, pointset.xToIndexApprox(this.getXMax()) + 2)
}

ChartView.prototype.getXMin  = function() { return this.xInterval.interval.low }
ChartView.prototype.getXMax  = function() { return this.xInterval.interval.high }
ChartView.prototype.getYMin  = function() { return this.yInterval.interval.low }
ChartView.prototype.getYMax  = function() { return this.yInterval.interval.high }
ChartView.prototype.getPYMin = function() { return this.yInterval.pLow }
ChartView.prototype.getPYMax = function() { return this.yInterval.pHigh }

////////////////////////////////////////////////////////////////////////////////

ChartView.prototype.setTags = function(tags, suppressRender) {
  this.layers.byID._tags.setData(tags, suppressRender)
}
