var ChartCanvas       = require('./chart2')
  , api               = require('../api')
  , ChartSet          = require('../models/chart').Set
  , KeyTree           = require('../models/key-tree')
  , Tag               = require('../models/tag')
  , DashboardTree     = require('../models/dashboard-tree')
  , MetricsFunction   = require('../models/metrics-function')
  , History           = require('../history')
  , Router            = require('../models/router')
  , ChartViewSet      = require('./chart-view-set')
  , handleKeys        = require('./keybindings')
  , SettingsView      = require('./settings')
  , SidebarView       = require('./sidebar')
  , DashboardTreeView = require('./dashboard-tree-view')
  , openNewTab        = require('open-new-tab')
  , parseMKey         = require('../../../lib/mkey')

module.exports = Layout

// Layout places and sizes charts.
//
// settings - PlotSettings
//
function Layout(settings) {
  this.container  = document.querySelector(".container")
  this.settings   = settings
  this.tree       = new KeyTree(api)
  this.chartViews = new ChartViewSet(this)
  this.charts     = this.chartViews.charts

  var _this = window.LAYOUT = this
  this.xInterval = ChartCanvas.sync(this.chartViews.syncKey,
    { low:  settings.start
    , high: settings.end
    , max:  settings.theEnd
    }).on("zoom",     onRange)
      .on("pan:done", onRange)
  function onRange(xLow, xHigh) { _this.setRange(xLow, xHigh) }

  this.sidebar    = new SidebarView(this.tree, this)
  this.header     = new SettingsView(this, this.sidebar)
  this.treeView   = this.sidebar.tree
  this.router     = new Router(document.location, this.settings)
  this.history    = new History(this.router)
  this._dashboard = null

  this.treeView
    .on("select:one",    this.graphOne.bind(this))
    .on("select:many",   this.graphMany.bind(this))
    .on("select:add",    this.graphAdd.bind(this))
    .on("select:remove", this.graphRemove.bind(this))
    .on("select:open",   this.openGraph.bind(this))
  this.router
    .on("select:one",       this.graphOne.bind(this))
    .on("select:many",      this.graphMany.bind(this))
    .on("select:dashboard", this.graphDashboardID.bind(this))
    .on("range:real",       this.setRangeReal.bind(this))
    .on("delta",            this.setDelta.bind(this))
    .on("renderer",         this.setRenderer.bind(this))
    .on("subkey",           this.setSubKey.bind(this))
    .on("histkeys",         this.setHistKeys.bind(this))
  this.header
    .on("range",            this.setRange.bind(this))
    .on("range:real",       this.setRangeReal.bind(this))
    .on("delta",            this.setDelta.bind(this))
    .on("renderer",         this.setRenderer.bind(this))
    .on("subkey",           this.setSubKey.bind(this))
    .on("histkeys",         this.setHistKeys.bind(this))
    .on("select:dashboard", this.graphDashboardID.bind(this))

  this.settings.loadTags(this.onTags.bind(this))
  Tag.onChange = this.onTagsChange.bind(this)

  var onKey = handleKeys(this)
  sail(document.body).on("keydown", function(ev) {
    if (ev.target.nodeName === "BODY") onKey(ev)
  })
}

////////////////////////////////////////////////////////////////////////////////
// ChartSet-ish
////////////////////////////////////////////////////////////////////////////////

Layout.prototype.graphNone = function() {
  if (this.charts.graphNone()) return
  this.treeView.deselectAll()
  this.updateHistory()
  this.header.dirty("plottype")
}

// mkey - String
Layout.prototype.graphOne = function(mkey) {
  var _this = this
  if (this.charts.graphOne(mkey, onGraphed)) return
  this.treeView.selectOne(mkey)
  this.updateHistory()
  function onGraphed(fail) {
    if (fail) return console.error("Layout#graphOne error", fail)
    _this.header.dirty("plottype")
  }
}

// mkeys - [String]
Layout.prototype.graphMany = function(mkeys) {
  if (this.charts.graphMany(mkeys)) return
  this.treeView.selectMany(mkeys)
  this.updateHistory()
  this.header.dirty("plottype")
}

// Open all of the graph members of the dashboard.
//
// dashboardID - String dashboard ID.
//
Layout.prototype.graphDashboardID = function(dashboardID) {
  var _this = this
  if (this.charts.graphDashboardID(dashboardID, onGraphed)) return
  this.sidebar.hide()
  this.treeView.deselectAll()
  this.updateHistory()
  function onGraphed(fail, dashboard) {
    if (fail) return console.error("ChartSet#graphDashboardID fail", fail)
    _this.dashboard().setCurrent(dashboard)
    _this.header.dirty("plottype")
  }
}

// Fullscreen a graph that is already plotted as a dashboard chart.
//
// chart - Chart
//
Layout.prototype.graphChart = function(chart) {
  var opts = chart.toJSON()
  if (opts.subkey)   this.setSubKey(opts.subkey)
  if (opts.renderer) this.setRenderer(opts.renderer)
  if (opts.histkeys) this.setHistKeys(opts.histkeys)

  var mkeys = opts.keys.slice()
  if (opts.keys.length === 1) {
    this.graphOne(parseMKey.base(opts.keys[0]))
  } else {
    this.graphMany(opts.keys)
  }
}

///
/// MODE_GRAPH
///

// Plot.
//
// mkey - String
//
Layout.prototype.graphAdd = function(mkey) {
  if (this.charts.graphAdd(mkey)) return
  this.treeView.selectAdd(mkey)
  this.header.dirty("plottype")
  this.updateHistory()
}

// Unplot.
//
// mkey - String
//
Layout.prototype.graphRemove = function(mkey) {
  var _this = this
  if (this.charts.graphRemove(mkey, onGraphed)) return
  this.treeView.selectRemove(mkey)
  this.updateHistory()
  function onGraphed(fail) {
    if (fail) return console.error("Layout#graphRemove error", fail)
    _this.header.dirty("plottype")
  }
}

///
/// LAYOUT_MANY
///

// The LAYOUT_MANY subkey has changed.
//
// subkey - String
//
Layout.prototype.setSubKey = function(subkey) {
  if (this.charts.setSubKey(subkey)) return
  this.settings.subkey = subkey
  this.header.dirty("plottype")
  this.updateHistory()
}

// The LAYOUT_MANY renderer has changed.
//
// renderer - String
//
Layout.prototype.setRenderer = function(renderer) {
  if (this.charts.setRenderer(renderer)) return
  this.settings.renderer = renderer
  this.header.dirty("plottype")
  this.updateHistory()
}

///
/// LAYOUT_HISTOGRAM
///

// The histogram subkeys have changed.
//
// histkeys - [String]
//
Layout.prototype.setHistKeys = function(histkeys) {
  if (this.charts.setHistKeys(histkeys)) return
  this.settings.histkeys = histkeys
  this.header.dirty("plottype")
  this.updateHistory()
}

///
/// MODE_DASHBOARD
///

// Remove a chart from the current dashboard.
//
// chartViews - ChartView
//
Layout.prototype.graphDashboardRemove = function(chartView) {
  this.charts.graphDashboardRemove(chartView)
}


////////////////////////////////////////////////////////////////////////////////
// Settings
////////////////////////////////////////////////////////////////////////////////

///
/// Range
///

// Called when the `start` or `end` changes.
//
// start, end - Integer timestamp
//
Layout.prototype.setRange = function(start, end) {
  if (this.settings.start === start && this.settings.end === end) return
  this.settings.setRange(start, end)
  this.onRange()
}

// Called when the default range changes.
//
// startReal - String
// endReal   - String
//
Layout.prototype.setRangeReal = function(startReal, endReal) {
  if (this.settings.startReal === startReal && this.settings.endReal === endReal) return
  this.settings.setRangeReal(startReal, endReal)
  this.header.dirty("range")
  this.updateHistory()
  this.onRange()
}

// Like `Layout#setRangeReal`, but the end is "now".
Layout.prototype.setRangeRealStart = function(startReal) {
  this.setRangeReal(startReal, null)
}

Layout.prototype.setRangeMax = function(theEnd) {
  var sett   = this.settings
    , oldEnd = sett.theEnd
  sett.theEnd = theEnd
  this.xInterval.setBounds(null, theEnd)
  if (sett.end === oldEnd) {
    this.setRange(sett.start + (theEnd - oldEnd), theEnd)
  }
}

Layout.prototype.onRange = function() {
  this.header.dirty("delta")
  this.settings.loadTags(this.onTags.bind(this))
  this.chartViews.reload()
}

///
/// Delta
///

// Called when the `delta` (downsample interval) changes.
//
// delta - Integer
//
Layout.prototype.setDelta = function(delta) {
  if (this.settings.deltaReal === delta) return
  this.settings.setDelta(delta)
  this.header.dirty("delta")
  this.updateHistory()
  this.chartViews.reload()
}

///
/// Tags
///

// Called when the tags need updating.
//
// fail - Boolean
// tags - [Tag]
//
Layout.prototype.onTags = function(fail, tags) {
  if (fail) return console.error("Error fetching tags", fail)
  this.chartViews.setTags(tags)
}

Layout.prototype.onTagsChange = function() { this.onTags(null, Tag.all()) }

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// Update the URL to reflect the current state.
Layout.prototype.updateHistory = function() {
  this.history.update(this.modeToString(), this.modeInfo())
}

// Get a permalink to the current graph.
//
// Returns String
Layout.prototype.permalink = function() {
  return this.router.permalink(this.modeToString(), this.modeInfo())
}

// Returns [String] or String
Layout.prototype.modeInfo = function() {
  return this.charts.mode === ChartSet.MODE_DASHBOARD
       ? this.charts.dashboardID
       : this.charts.mkeys
}

// Returns String "graph" or "dashboard"
Layout.prototype.modeToString = function() {
  var mode = this.charts.mode
  return mode === ChartSet.MODE_GRAPH     ? "graph"
       : mode === ChartSet.MODE_DASHBOARD ? "dashboard"
       : ""
}

Layout.prototype.layoutToString = function() {
  var layout = this.charts.layout
  return layout === ChartSet.LAYOUT_ONE       ? "counter"
       : layout === ChartSet.LAYOUT_HISTOGRAM ? "histogram"
       : layout === ChartSet.LAYOUT_MANY      ? "many"
       : layout === ChartSet.LAYOUT_DASHBOARD ? "dashboard"
       : ""
}

// Get the plot type label.
//
// Returns String
Layout.prototype.plotTypeToString = function() {
  var charts = this.charts
    , layout = charts.layout
  if (layout === ChartSet.LAYOUT_HISTOGRAM
   && isHeatMap(charts.histkeys))           return "heat map"
  if (layout === ChartSet.LAYOUT_HISTOGRAM) return "histogram"
  if (layout === ChartSet.LAYOUT_ONE)       return "counter"
  if (layout === ChartSet.LAYOUT_DASHBOARD) return charts.dashboardID
  if (layout === ChartSet.LAYOUT_MANY) {
    var renderer = charts.renderer
      , rLabel   = renderer === "line" ? "" : ", " + renderer
    return charts.subkey + rLabel
  }
  return "?"
}

function isHeatMap(histkeys) { return histkeys.indexOf("llquantize") > -1 }

// Open the graph in a new tab.
//
// mkeys - [String]
//
Layout.prototype.openGraph = function(mkeys) {
  openNewTab(this.router.getGraphURL(mkeys))
}

Layout.prototype.onResize = function() {
  // Dashboards' graphs are a fixed size, so they don't need to be re-rendered
  // when the window is resized.
  if (this.charts.mode === ChartSet.MODE_GRAPH) {
    this.chartViews.onResize()
  }
}

// pane - String "sidebar" or "function"
Layout.prototype.showPane = function(pane) {
  this.container.className += " container-has-" + pane
  this.onResize()
}

// pane - String "sidebar" or "function"
Layout.prototype.hidePane = function(pane) {
  sail.removeClass(this.container, "container-has-" + pane)
  this.onResize()
}

////////////////////////////////////////////////////////////////////////////////
// Dashboards
////////////////////////////////////////////////////////////////////////////////

Layout.prototype.dashboard = function() {
  return this._dashboard || (this._dashboard = new DashboardTreeView(this))
}

Layout.prototype.dashboardNewChart = function() {
  if (this.charts.mode === ChartSet.MODE_DASHBOARD) {
    this.dashboard().newChart()
  } else { // MODE_GRAPH
    this.dashboard().saveChart()
  }
}
