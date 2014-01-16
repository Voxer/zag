var ChartCanvas = require('./chart2')
  , TagDialog   = require('./tags')
  , ChartHeader = require('./views/chart-header')
  , ID          = 0

module.exports = ChartView

function noop() {}

//
// chart     - Chart
// views     - ChartViewSet
// dashboard - DashboardTreeView (optional)
//
function ChartView(chart, views, dashboard) {
  this.chart        = chart
  this.chart.update = this.reload.bind(this)
  var className     = views.layoutToClass()
  this.el           = sail.createElement("div", {className: "chart chart-" + className})
  this.canvas       = null
  this.header       = null
  this.views        = views
  this.settings     = views.settings
  this.chartSync    = views.syncKey
  this.editTag      = views.editTag || noop
  this.points       = views.points
  this.isDashboard  = !!dashboard
  this.isDestroyed  = false
  this._delta       = null

  views.container.appendChild(this.el)
  if (dashboard) {
    this.header = new ChartHeader(dashboard, this)
  }

  this.reload()
}

ChartView.prototype.destroy = function() {
  if (this.isDestroyed) return
  this.isDestroyed = true

  if (this.canvas) this.canvas.destroy()
  if (this.header) this.header.destroy()
  this.chart.destroy()

  sail(this.el).remove()
  this.chart = this.el = this.canvas = this.header = null
  this.views = this.settings = this.editTag = this._plots = null
}

////////////////////////////////////////////////////////////////////////////////
// Initialization
////////////////////////////////////////////////////////////////////////////////

// points - Array of point Objects.
ChartView.prototype.reload = function() {
  var plots = (this.isDirty() || !this.canvas)
           &&  this.chart.getPlots()

  if (this.canvas) {
    if (plots) this.canvas.reset(plots)
    this.canvas.reload(this.settings.start, this.settings.end, this._delta = this.settings.delta)
    this.views.extendRange()
  } else {
    this.canvas = new ChartCanvas(this.el,
      { plots:     plots
      , ampPan:    2
      , tags:      this.settings.getTags()
      , onEditTag: TagDialog.edit
      , onNewTag:  TagDialog.createAt
      , sync:      this.chartSync
      , xMin:      this.settings.start
      , xMax:      this.settings.end
      , delta:     this._delta = this.settings.delta
      , lpadding:  this.isDashboard ? 20 : 40
      , tpadding:  20
      })
  }
}

ChartView.prototype.isDirty = function() {
  return this.chart.isDirty()
     || (this._delta !== this.settings.delta)
}

////////////////////////////////////////////////////////////////////////////////
// Updating
////////////////////////////////////////////////////////////////////////////////

// Proxy setters to Chart, then `reset()`.
;["plotAdd", "plotRemove", "setSubKey", "setRenderer", "setHistKeys"].forEach(function(fn) {
  ChartView.prototype[fn] = function(value) {
    this.chart[fn](value)
    this.reload()
  }
})

// Returns Object.
ChartView.prototype.getID  = function()   { return this.chart.getID() }
ChartView.prototype.setID  = function(id) { return this.chart.setID(id) }
ChartView.prototype.toJSON = function()   { return this.chart.toJSON() }


ChartView.prototype.onResize = function() { this.canvas && this.canvas.onResize() }
ChartView.prototype.setTags = function(tags) { this.canvas && this.canvas.setTags(tags) }
