var inherits   = require('util').inherits
  , formatTime = require('../utils/format-time')
  , formatSI   = require('../utils/format-si')
  , translate  = require('../utils/translate')
  , transform  = translate.transform
  , TICK_LONG  = 5
  , TICK_SHORT = 1
  , AXIS_BG    = "#333"

exports.X = XAxis
exports.Y = YAxis

var tickStyle = 'background:' + AXIS_BG + ';'
  , xTickHTML = '<div style="'
              +   tickStyle
              +   transform + ':translateX(-50%);'
              +   'margin-left:50%;'
              +   'height:' + TICK_LONG  + 'px;'
              +   'width:'  + TICK_SHORT + 'px;'
              + '"></div>'
  , yTickHTML = '<div style="'
              +   tickStyle
              +   'height:' + TICK_SHORT + 'px;'
              +   'width:'  + TICK_LONG  + 'px;'
              + '"></div>'


function Axis(chart, options) {
  this.id    = options.id
  this.chart = chart
  this.axis  = d3.select(chart.container).append("div").node()
  // The number of visible tick marks.
  this.used  = 0
  // The total number of tick mark elements, including hidden ones.
  this.total = -1
}

Axis.prototype.destroy = function() {
  this.chart = this.axis = null
}

// Rather than repopulating the axis by setting `innerHTML` every time, reuse
// tick marks, hide the ones that aren't in use.
//
// type - Character "x" or "y"
// n    - Integer, The number of ticks needed.
//
Axis.prototype.populate = function(type, n) {
  var oldUsed = this.used
  this.used = n
  if (this.total >= n) {
    var ticks = this.axis.children
    if (oldUsed < n) {
      for (var i = oldUsed; i < n; i++) ticks[i].style.display = null
    } else if (oldUsed > n) {
      for (var i = n; i < oldUsed; i++) ticks[i].style.display = "none"
    }
    return
  }
  this.total = n

  var html     = ''
    , tickHTML = type === "x" ? xTickHTML : yTickHTML
  for (var i = 0; i < n; i++) {
    html += '<div class="axis-' + type + '-tick">'
          +   tickHTML
          +   '<span class="axis-' + type + '-tick-text">'
          +   '</span>'
          + '</div>'
  }
  this.axis.innerHTML = html + '<div class="axis-line"></div>'
  this.resizeLine()
}

// Get the axis' actual line (horizonal for X, vertical for Y).
//
// Returns DOM Element.
Axis.prototype.getLine = function() { return this.axis.lastElementChild }

////////////////////////////////////////////////////////////////////////////////

// A plot axis.
function XAxis(chart, options) {
  Axis.call(this, chart, options)
  this.axis.className = "axis-x"
  this.onResize()
}

inherits(XAxis, Axis)

XAxis.prototype.render = function() {
  var chart      = this.chart
    , domainToPx = chart.domainToPx
    , tickArg    = Math.floor(chart.width / 80)
    , ticks      = domainToPx.ticks(tickArg)
    //, format     = domainToPx.tickFormat(tickArg)
    , lpadding   = chart.lpadding

  // Generate the axis HTML.
  this.populate("x", ticks.length)

  var tickEls = this.axis.children
  for (var i = 0, l = ticks.length; i < l; i++) {
    var x  = domainToPx(ticks[i]) + lpadding
      , el = tickEls[i]
    el.style.left = x + "px"
    el.lastElementChild.textContent = formatTime(ticks[i])
  }
}

XAxis.prototype.onResize = function() {
  // Reposition chart on resize.
  var chart = this.chart
    , style = this.axis.style
  style[transform] = translate(0, chart.height + chart.tpadding)
  style.width      = chart.fullWidth + "px"
  style.height     = chart.tpadding  + "px"

  this.resizeLine()
}

XAxis.prototype.resizeLine = function() {
  var line      = this.getLine()
  if (!line) return
  var lineStyle = line.style
  lineStyle.width = this.chart.width + "px"
  lineStyle.right = this.chart.lpadding + "px"
}

////////////////////////////////////////////////////////////////////////////////

function YAxis(chart, options) {
  Axis.call(this, chart, options)
  this.axis.className = "axis-y"
  this.onResize()
}

inherits(YAxis, Axis)

YAxis.prototype.render = function() {
  var chart     = this.chart
    , rangeToPx = chart.rangeToPx
    , tickArg   = Math.floor(chart.height / 60)
    , ticks     = rangeToPx.ticks(tickArg)
    , tpadding  = chart.tpadding

  this.populate("y", ticks.length)

  var tickEls = this.axis.children
    , transX  = chart.lpadding - 4
  for (var i = 0, l = ticks.length; i < l; i++) {
    var y  = rangeToPx(ticks[i]) + tpadding
      , el = tickEls[i]
    el.style[transform]             = translate(transX, y)
    el.lastElementChild.textContent = formatSI(ticks[i])
  }
}

YAxis.prototype.onResize = function() {
  var chart = this.chart
    , style = this.axis.style
  style.width  = chart.lpadding + "px"
  style.height = (chart.height + 2*chart.tpadding) + "px"

  this.resizeLine()
}

YAxis.prototype.resizeLine = function() {
  var line = this.getLine()
  if (line) {
    line.style.height = this.chart.height   + "px"
    line.style.top    = this.chart.tpadding + "px"
  }
}
