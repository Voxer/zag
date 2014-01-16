var DashboardChartView   = require('./dashboard-chart-view')
  , DashboardChartDialog = require('./views/dashboard-chart-dialog')
  , DashboardDialog      = require('./views/dashboard-dialog')
  , parseMKey            = require('../../../lib/mkey')
  , DashboardTree        = require('../models/dashboard-tree')
  , loadDashTree         = DashboardTree.load

module.exports = DashboardTreeView

function DashboardTreeView(layout) {
  this.layout    = layout
  this.tree      = null // DashboardTree
  this.current   = null // Dashboard
  this.currentID = null // String
  this.dchart    = null // DashboardChartView
  DashboardTree.load(this.onDashboardTreeLoad.bind(this))
}

// dashboard - Dashboard
DashboardTreeView.prototype.setCurrent = function(dashboard) {
  this.current   = dashboard
  this.currentID = dashboard && dashboard.id
  if (this.dchart) {
    this.dchart.destroy()
    this.dchart = null
  }
}

// Re-plot the current dashboard's graphs.
DashboardTreeView.prototype.graphDashboard = function() {
  this.layout.graphDashboardID(this.currentID)
}

// chart - Chart
DashboardTreeView.prototype.graphChart = function(chart) { this.layout.graphChart(chart) }

// Rename the current dashboard.
DashboardTreeView.prototype.renameDashboard = function() {
  new DashboardDialog({tree: this.tree, id: this.currentID})
}

DashboardTreeView.prototype.destroyDashboard = function() { this.current.destroy() }

////////////////////////////////////////////////////////////////////////////////
// DashboardTree Events
////////////////////////////////////////////////////////////////////////////////

// Called when the dashboards are loaded.
//
// fail - Boolean
// tree - DashboardTree
//
DashboardTreeView.prototype.onDashboardTreeLoad = function(fail, tree) {
  if (fail) return this.onDashboardError(fail)
  this.tree = tree
  tree.on("create",    this.onDashboardCreate.bind(this))
  tree.on("change:id", this.onDashboardRename.bind(this))
  tree.on("delete",    this.onDashboardDelete.bind(this))
  tree.on("error",     this.onDashboardError.bind(this))
}

// Called when a dashboard is created.
//
// dashboardID - String
//
DashboardTreeView.prototype.onDashboardCreate = function(dashboardID) {
  this.layout.graphDashboardID(dashboardID)
}

// If the currently plotted dashboard was renamed, replot everything.
// This isn't those most efficient, but it makes sure everything gets updated.
//
// fromID - String, dashboard ID
// toID   - String, dashboard ID
DashboardTreeView.prototype.onDashboardRename = function(fromID, toID) {
  if (this.currentID === fromID) {
    this.layout.graphDashboardID(toID)
  }
}

// Called when a dashboard is destroyed.
//
// dashboardID - String
//
DashboardTreeView.prototype.onDashboardDelete = function(dashboardID) {
  if (this.currentID !== dashboardID) return
  // The dashboard is currently plotted.
  this.layout.graphNone()
  this.current = this.currentID = null
}

// message - String
DashboardTreeView.prototype.onDashboardError = function(message) {
  console.warn("DashboardTree error", message)
}

////////////////////////////////////////////////////////////////////////////////
// Dashboard charts
////////////////////////////////////////////////////////////////////////////////

// chart - Chart
// Returns String URL
DashboardTreeView.prototype.chartToURL = function(chart) {
  var mkeys = chart.getKeys()
  if (mkeys.length === 1) {
    mkeys[0] = parseMKey.base(mkeys[0])
  }
  return this.layout.router.getGraphURL(mkeys,
    { histkeys: chart.histkeys
    , renderer: chart.renderer
    , subkey:   chart.subkey
    })
}


// Modify the chart's title.
//
// view - ChartView
//
DashboardTreeView.prototype.editChartTitle = function(view) {
  var chart = view.chart
    , _this = this
  var dialog = new DashboardChartDialog(chart, function(mods) {
    if (mods.title != null) {
      chart.title = mods.title
      view.header.onTitle()
      _this.current.updateChart(chart)
    }
  })
}

// Modify the chart's plots.
//
// view - ChartView or null. If null, then a new Chart is being created.
//
DashboardTreeView.prototype.editChart = function(view) {
  this.dchart = new DashboardChartView(this, view && view.chart)
}
DashboardTreeView.prototype.newChart = function() { this.editChart(null) }

DashboardTreeView.prototype.saveChart = function() {
  if (this.dchart && this.dchart.dashboard) this.dchart.save()
}

// Delete the chart from the dashboard.
//
// view - ChartView
//
DashboardTreeView.prototype.removeChart = function(view) {
  this.layout.graphDashboardRemove(view)
}
