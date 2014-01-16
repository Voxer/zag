var DashboardSaveBar = require('./views/dashboard-save-bar')

module.exports = DashboardChartView

var WIZARD = "Build a graph like normal, then click \u2018Save\u2019 when you are done."

/// Edit a dashboard chart, or create a new one.
///
/// dashView  - DashboardTreeView
/// chart     - Chart (optional)
///             The chart that is being edited.
///             If not passed, its a new chart.
///
function DashboardChartView(dashView, chart) {
  this.dashView  = dashView
  this.layout    = dashView.layout
  this.dashboard = dashView.current
  this.chartID   = chart && chart.getID()
  this.container = this.layout.chartViews.container

  this.saveBar  = null
  this.wizardEl = this._hideWizard = null
  this.pickerTargets = this._onClickPicker = null
  this.render(chart)
}

DashboardChartView.prototype.destroy = function() {
  this.hideSaveBar()
  this.hideWizard()
  this.hideChartPicker()
  this.dashView = this.layout = this.dashboard = this.container = null
}

// Plot the chart and various helper widgets.
DashboardChartView.prototype.render = function(chart) {
  this.layout.sidebar.show()
  this.showSaveBar()
  // Edit
  if (chart) {
    this.layout.graphChart(chart)
  // New
  } else {
    this.showWizard()
    this.layout.graphNone()
  }
}

// Graph the parent dashboard.
DashboardChartView.prototype.graphDashboard = function() {
  this.dashView.graphDashboard()
  this.destroy()
}

///
/// Updating
///

// Save the changes to the chart, then go back to the parent dashboard.
DashboardChartView.prototype.save = function() { this.showChartPicker() }

DashboardChartView.prototype.saveChart = function(chart) {
  if (this.chartID) chart.setID(this.chartID)
  this.dashboard.updateChart(chart)
  this.graphDashboard()
}

// Cancel changes to the chart, but leave it plotted.
DashboardChartView.prototype.cancel = DashboardChartView.prototype.destroy
DashboardChartView.prototype.back   = DashboardChartView.prototype.graphDashboard

////////////////////////////////////////////////////////////////////////////////
// Misc. widgets
////////////////////////////////////////////////////////////////////////////////

///
/// Wizard
///
/// The wizard is a little helper popover with some instructions on how to
/// build a dashboard chart.
///

DashboardChartView.prototype.showWizard = function() {
  this.wizardEl = sail.createElement("div",
    { className: "wizard wizard-left dashboard-wizard"
    , innerHTML: WIZARD
    })
  document.body.appendChild(this.wizardEl)
  sail(document.body).on("mousedown", this._hideWizard = this.hideWizard.bind(this))
}

DashboardChartView.prototype.hideWizard = function() {
  if (!this.wizardEl) return
  sail.remove(this.wizardEl)
  sail(document.body).off("mousedown", this._hideWizard)
  this.wizardEl = this._hideWizard = null
}

///
/// Save Bar
///
/// The 'save bar' has 3 options: Cancel, Back, and Save.
///

DashboardChartView.prototype.showSaveBar = function() {
  this.saveBar = new DashboardSaveBar(this)
}

DashboardChartView.prototype.hideSaveBar = function() {
  this.saveBar && this.saveBar.destroy()
  this.saveBar = null
}

///
/// Chart picker
///
/// A target appears over every chart -- click one to proceed.
/// Used to pick between a histogram and counter (LAYOUT_HISTOGRAM).
///

DashboardChartView.prototype.showChartPicker = function() {
  // eww.. Layout.ChartSet.[ChartView].Chart
  if (this._onClickPicker) return
  var chartViews = this.layout.charts.charts
    , count      = chartViews.length
  if (count === 0) return
  if (count === 1) return this.onPickChart(chartViews[0].chart)

  this.pickerTargets = []
  for (var i = 0; i < count; i++) {
    var target = makePickerTarget(i)
    chartViews[i].el.appendChild(target)
    this.pickerTargets.push(target)
  }
  sail.on(this.container, "click",
    this._onClickPicker = this.onClickPicker.bind(this))
}

DashboardChartView.prototype.hideChartPicker = function() {
  this._onClickPicker && sail.off(this.container, "click", this._onClickPicker)
  var targets = this.pickerTargets
  for (var i = 0; targets && i < targets.length; i++) {
    sail.remove(targets[i])
  }
  this.pickerTargets = this._onClickPicker = null
}

// ev - DOM click Event
DashboardChartView.prototype.onClickPicker = function(ev) {
  var target = ev.target
  if (target.className !== "chart-target") return
  this.onPickChart(this.layout.charts.charts[+target.dataset.i])
  this.hideChartPicker()
}

DashboardChartView.prototype.onPickChart = DashboardChartView.prototype.saveChart

// i - Integer index in the charts list
function makePickerTarget(i) {
  var label  = i === 0 ? "histogram" : "counter"
  var target = sail.createElement("div",
    { className: "chart-target"
    , innerHTML: '<button class="chart-target-label button-create">Save ' + label + '</button>'
    })
  target.dataset.i = i
  return target
}
