var DashboardTree = require('../dashboard-tree')
  , util          = require('./util')
  , parseMKey     = require('../../../../lib/mkey')
  , sameSorted    = util.sameSorted

module.exports = ChartSet

var MODE_GRAPH       = ChartSet.MODE_GRAPH       = 1 // GRAPH_*
  , MODE_DASHBOARD   = ChartSet.MODE_DASHBOARD   = 2 // chart multiplexing
var LAYOUT_ONE       = ChartSet.LAYOUT_ONE       = 1 // a single counter
  , LAYOUT_HISTOGRAM = ChartSet.LAYOUT_HISTOGRAM = 2 // histogram/counter split (histkeys)
  , LAYOUT_MANY      = ChartSet.LAYOUT_MANY      = 3 // overlay (subkey)
  , LAYOUT_DASHBOARD = ChartSet.LAYOUT_DASHBOARD = 4 // chart multiplexing

/// A ChartSet coordinates what is currently plotted, and the state transitions
/// between the different layouts, subkeys, and renderers.
///
/// This is the definitive state of what is currently graphed.
///
/// makeChart({keys, histkeys, subkey, renderer}) -> Chart
/// getType(mkey, callback(fail, type))
///   * mkey - String
///   * fail - true or null
///   * type - "histogram" or "counter"
/// settings - {histkeys, subkey, renderer}
///
function ChartSet(makeChart, getType, settings) {
  this.makeChart = makeChart
  this.getType   = getType
  this.clock     = 0

  this.mode      = null // MODE
  this.layout    = null // LAYOUT
  this.charts    = []   // [Chart]

  // MODE_GRAPH
  this.mkeys     = null              // [String]
  this.subkey    = settings.subkey   //  String
  this.histkeys  = settings.histkeys // [String]
  this.renderer  = settings.renderer //  String
  // MODE_DASHBOARD
  this.dashboard   = null // Dashboard
  this.dashboardID = null // String
}

////////////////////////////////////////////////////////////////////////////////
// Graphing
////////////////////////////////////////////////////////////////////////////////

// No charts.
ChartSet.prototype.graphNone = function() {
  this.setMode(MODE_GRAPH)
  this.layout = null
  this.mkeys  = []
}

// The lone graph. Use this as a starting point when there is only
// one metrics key to plot (e.g.: `Object.keys(mtree).length === 1`).
//
// Cases covered:
//   * If `mkey` is a histogram, it will be a top/bottom split. The top is
//     mean, median, p95,... and the bottom is the associated count.
//   * If `mkey` is a counter, the only graph is the count.
//
// mkey - String
// callback(fail)
//
ChartSet.prototype.graphOne = function(mkey, callback) {
  if ((this.layout === LAYOUT_ONE || this.layout === LAYOUT_HISTOGRAM)
    && this.mkeys[0] === mkey) return true

  this.setMode(MODE_GRAPH)
  this.layout = null
  this.mkeys  = [mkey]

  var _this = this
  this.getType(mkey, this.checkClock(function(fail, type) {
    if (fail) return callback(fail)
    var layout = _this.layout = type === "histogram" ? LAYOUT_HISTOGRAM : LAYOUT_ONE
    if (layout === LAYOUT_HISTOGRAM) {
      _this.addChart({keys: [mkey], histkeys: _this.histkeys})
    }
    _this.addChart({keys: [parseMKey.setSubKey(mkey, "count")]})
    callback()
  }))
}

// An overlay of 2+ keys.
//
// mkeys - [String]
//
ChartSet.prototype.graphMany = function(mkeys) {
  if (this.layout === LAYOUT_MANY && sameSorted(this.mkeys, mkeys)) return true

  this.setMode(MODE_GRAPH)
  this.layout = LAYOUT_MANY
  this.mkeys  = mkeys
  this.addChart(
    { keys:     mkeys.slice()
    , subkey:   this.subkey
    , renderer: this.renderer
    })
}

// dashboardID - String
// callback(fail, dashboard)
ChartSet.prototype.graphDashboardID = function(dashboardID, callback) {
  if (this.layout === LAYOUT_DASHBOARD && this.dashboardID === dashboardID) return true

  this.setMode(MODE_DASHBOARD)
  this.layout      = null
  this.dashboardID = dashboardID

  var _this = this
  DashboardTree.load(this.checkClock(function(fail, dashboardTree) {
    if (fail) return callback(fail)
    dashboardTree.get(dashboardID, _this.checkClock(function(fail, dash) {
      if (fail) return callback(fail)
      _this.graphDashboard(dash)
      callback(null, dash)
    }))
  }))
}

///
/// MODE_GRAPH
///

// Add a plot to a graph.
//
// mkey - String
//
ChartSet.prototype.graphAdd = function(mkey) {
  if (this.mode === MODE_GRAPH && this.mkeys.indexOf(mkey) !== -1) return true

  // LAYOUT_(ONE|HISTOGRAM) -> LAYOUT_MANY
  if (this.layout !== LAYOUT_MANY) {
    return this.graphMany([this.mkeys[0], mkey])
  }
  this.mkeys.push(mkey)
  this.charts[0].plotAdd(mkey)
}

// Remove a plot from a graph.
//
// mkey - String
//
ChartSet.prototype.graphRemove = function(mkey, callback) {
  if (this.mode === MODE_GRAPH && this.mkeys.indexOf(mkey) === -1) return true
  if (this.mkeys.length === 1) return true

  var mkeys = this.mkeys
  mkeys.splice(mkeys.indexOf(mkey), 1)
  // LAYOUT_MANY -> LAYOUT_(ONE|HISTOGRAM)
  if (mkeys.length === 1) {
    this.graphOne(mkeys[0], callback)
  } else {
    this.charts[0].plotRemove(mkey)
    callback()
  }
}

///
/// MODE_DASHBOARD
///

// Remove a chart from a dashboard.
//
// chart - Chart
//
ChartSet.prototype.graphDashboardRemove = function(chart) {
  this.dashboard.removeChart(chart.getID())
  chart.destroy()
  this.charts.splice(this.charts.indexOf(chart), 1)
}


////////////////////////////////////////////////////////////////////////////////
// Settings
////////////////////////////////////////////////////////////////////////////////

// subkey - String, e.g. "mean" or "p99"
ChartSet.prototype.setSubKey = function(subkey) {
  if (this.subkey === subkey) return true
  this.subkey = subkey
  if (this.layout === LAYOUT_MANY) {
    this.charts[0].setSubKey(subkey)
  }
}

// renderer - String, e.g. "line" or "stack"
ChartSet.prototype.setRenderer = function(renderer) {
  if (this.renderer === renderer) return true
  this.renderer = renderer
  if (this.layout === LAYOUT_MANY) {
    this.charts[0].setRenderer(renderer)
  }
}

// histkeys - [String]
ChartSet.prototype.setHistKeys = function(histkeys) {
  if (sameSorted(this.histkeys, histkeys)) return true
  this.histkeys = histkeys
  if (this.layout === LAYOUT_HISTOGRAM) {
    this.charts[0].setHistKeys(histkeys)
  }
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Append a chart.
//
// chartOptions - {keys[, subkey, histkeys, renderer]}
//
ChartSet.prototype.addChart = function(chartOptions) {
  var chart = this.makeChart(chartOptions)
  this.charts.push(chart)
  return chart
}

// Destroy all charts.
ChartSet.prototype.destroyCharts = function() {
  var charts = this.charts
  for (var i = 0; i < charts.length; i++) { charts[i].destroy() }
  this.charts = []
}

// Transition modes.
//
// mode - MODE
//
ChartSet.prototype.setMode = function(mode) {
  if (mode === MODE_DASHBOARD) this.mkeys     = null
  if (mode === MODE_GRAPH)     this.dashboard = this.dashboardID = null
  this.mode = mode
  this.destroyCharts()
  this.clock++
}

// dashboard - Dashboard
ChartSet.prototype.graphDashboard = function(dashboard) {
  this.setMode(MODE_DASHBOARD)
  this.layout    = LAYOUT_DASHBOARD
  this.dashboard = dashboard

  var graphs   = dashboard.graphs
    , graphIDs = Object.keys(graphs)
  for (var i = 0; i < graphIDs.length; i++) {
    this.addChart(graphs[graphIDs[i]])
  }
}

ChartSet.prototype.checkClock = function(callback) {
  var start = this.clock
    , _this = this
  return function(fail, res) {
    if (start === _this.clock) callback(fail, res)
  }
}
