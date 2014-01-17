var dateToString = require('../../../../../lib/date-utils').dateToString
  , PointSet     = require('../models/point-set/point-set')
  , translate    = require('../utils/translate')
  , transform    = translate.transform

module.exports = TagLayer

/// Display labelled markers at points in time on the graph.
///
/// A Tag is `{label, color, ts}`.
///
/// options -
///   * editTag(tag)
///   * newTag(ts)
///
function TagLayer(chart, options) {
  this.id        = options.id
  this.chart     = chart
  this.container = chart.container
  // Pretend to be a plot so that (min|max)Index work.
  this.points    = new PointSet({data: [], getX: getTS})
  this.editTag   = options.editTag
  this.newTag    = options.newTag

  this.current = null // Element

  this.used  = 0
  this.total = 0

  var _this = this
  this.el   = d3.select(chart.container).append("div")
    .attr("class", "tag-container")
    .on("mouseover",   function() { _this.onMouseOver(d3.event) })
    .on("mouseout",    function() { _this.onMouseOut(d3.event) })
    .on("click",       function() { _this.onClick(d3.event) })
    .on("contextmenu", function() { _this.onRightClick(d3.event) })
    .node()

  this.onResize()
}

TagLayer.prototype.destroy = function() {
  this.editTag = this.newTag = null
  this.points.destroy()
  this.chart = this.container = this.el = this.points = this.current = null
}

////////////////////////////////////////////////////////////////////////////////
// Rendering
////////////////////////////////////////////////////////////////////////////////

TagLayer.prototype.render = function() {
  var chart      = this.chart
    , domainToPx = chart.domainToPx
    , pointSet   = this.points
    , tags       = pointSet.data
    , minIndex   = chart.minIndex(pointSet)
    , maxIndex   = chart.maxIndex(pointSet)
    , width      = chart.width

  this.populate(maxIndex - minIndex)
  var tagEls = this.el.children

  for (var i = minIndex; i < maxIndex; i++) {
    var tag      = tags[i]
      , left     = Math.round(domainToPx(tag.ts))
      , tagEl    = tagEls[i - minIndex]
      , tagStyle = tagEl.style
    tagEl.dataset.i = i
    tagStyle.left = left + "px"
    tagStyle.backgroundColor = tag.color
  }
}

TagLayer.prototype.populate = function(n) {
  var oldUsed = this.used
  this.used = n
  if (this.total >= n) {
    var tags = this.el.children
    if (oldUsed < n) {
      for (var i = oldUsed; i < n; i++) tags[i].style.display = null
    } else if (oldUsed > n) {
      for (var i = n; i < oldUsed; i++) tags[i].style.display = "none"
    }
    return
  }
  this.total = n

  var html = ''
  for (var i = 0; i < n; i++) {
    html += '<div class="tag-line"></div>'
  }
  this.el.innerHTML = html
}

////////////////////////////////////////////////////////////////////////////////
// Updating
////////////////////////////////////////////////////////////////////////////////

TagLayer.prototype.onResize = function() {
  var chart = this.chart
  this.el.style[transform] = translate(chart.lpadding, chart.height + chart.tpadding)
  this.el.style.width      = chart.width + "px"
}

// Update the tags and redraw.
TagLayer.prototype.setData = function(tags, suppressRender) {
  this.points.setData(tags)
  if (!suppressRender) this.render()
}

TagLayer.prototype.setCurrent = function(i) {
  var current = this.current
  if (i === null) {
    if (current) current.style.display = "none"
    return
  }

  var tag = this.points.data[i]
  if (!current) {
    current = this.current = d3.select(this.container).append("div").node()
    current.className = "tag-current"
    current.innerHTML = '<div class="tag-current-label hover-label hover-tag-label"></div>'
  }

  var chart = this.chart
    , style = current.style
    , label = current.firstElementChild
  style[transform]      = translate(chart.lpadding + chart.domainToPx(tag.ts), chart.tpadding)
  style.height          = chart.height + "px"
  style.backgroundColor = tag.color
  style.display         = null

  label.style.borderColor = tag.color
  label.textContent       = tag.label
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

TagLayer.prototype.onMouseOver = function(ev) {
  if (ev.target.className === "tag-line") {
    this.setCurrent(ev.target.dataset.i)
  }
}

TagLayer.prototype.onMouseOut = function(ev) { this.setCurrent(null) }

// Edit a tag.
TagLayer.prototype.onClick = function(ev) {
  if (ev.target.className === "tag-line") {
    this.editTag(this.points.data[+ev.target.dataset.i])
  }
}

// Create a tag.
TagLayer.prototype.onRightClick = function(ev) {
  ev.preventDefault()
  var chart = this.chart
    , date  = chart.domainToPx.invert(ev.layerX - chart.lpadding)
  this.newTag(date.getTime())
}

function getTS(tag) { return tag.ts }
