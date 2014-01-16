var ChartView    = require('./chart-view')
  , Chart        = require('../models/chart')
  , ChartSet     = Chart.Set
  , PointEmitter = require('../models/point-emitter')
  , PointLoader  = require('../models/point-loader')
  , ProgressBar  = require('./views/progress-bar')
  , Spinner      = require('./views/spinner')
  , parseMKey    = require('../../../lib/mkey')

module.exports = ChartViewSet

// ChartViewSet places and sizes charts.
//
// layout - Layout
//
function ChartViewSet(layout) {
  var settings = layout.settings

  this.layout    = layout
  this.settings  = settings
  this.syncKey   = "main"
  this.container = document.querySelector(".graph-group")
  this.charts    = new ChartSet(this.addChart.bind(this), this.getType.bind(this), settings)
  this.spinner   = new Spinner(this.container)

  var progress = this.progress = new ProgressBar()
  this.container.appendChild(progress.el)

  var pointLoader = new PointLoader()
  pointLoader.on("progress",      progress.setValue.bind(progress))
  pointLoader.on("loading:start", this.spinner.more.bind(this.spinner))
  pointLoader.on("loading:end",   this.spinner.less.bind(this.spinner))
  this.points = new PointEmitter(pointLoader.loader, settings)
}

// This string will be used to construct a CSS class name, such as
// "chart-dashboard" or "chart-half".
//
// Returns String
ChartViewSet.prototype.layoutToClass = function() {
  var layout = this.charts.layout
  return layout === ChartSet.LAYOUT_ONE       ? "full"
       : layout === ChartSet.LAYOUT_HISTOGRAM ? "half"
       : layout === ChartSet.LAYOUT_MANY      ? "full"
       : layout === ChartSet.LAYOUT_DASHBOARD ? "dashboard"
       : "unknown"
}

////////////////////////////////////////////////////////////////////////////////
// Graphing
////////////////////////////////////////////////////////////////////////////////

ChartViewSet.prototype.reload = function() {
  this.points.setRange(this.settings.start, this.settings.end, this.settings.delta)
}

ChartViewSet.prototype.extendRange = function() {
  var maxTs  = this.points.getMaxTime()
    , theEnd = this.settings.theEnd
  if (theEnd < maxTs) {
    this.layout.setRangeMax(maxTs)
  }
}

// tags - [Tag]
ChartViewSet.prototype.setTags = function(tags) {
  var charts = this.charts.charts
  for (var i = 0, l = charts.length; i < l; i++) {
    charts[i].setTags(tags)
  }
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

ChartViewSet.prototype.onResize = function() {
  var charts = this.charts.charts
  for (var i = 0, l = charts.length; i < l; i++) {
    charts[i].onResize()
  }
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

///
/// ChartSet
///

// chartOpts - {keys, subkey, renderer, title, id}
ChartViewSet.prototype.addChart = function(chartOpts) {
  var chart  = new Chart(this.points, chartOpts.keys, chartOpts)
    , isDash = this.charts.layout === ChartSet.LAYOUT_DASHBOARD
  return new ChartView(chart, this, isDash && this.layout.dashboard())
}

// mkey - String
// callback(fail, type)
ChartViewSet.prototype.getType = function(mkey, callback) {
  if (parseMKey.isFunction(mkey)) {
    return callback(null, "counter")
  }
  var spinner = this.spinner
  spinner.more()
  this.layout.tree.loadOne(mkey, function(fail, leaf) {
    spinner.less()
    if (fail) return callback(fail)
    callback(null, leaf.type)
  })
}
