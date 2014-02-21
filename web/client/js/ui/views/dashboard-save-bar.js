var SkyView  = require('skyview')
  , inherits = require('util').inherits

module.exports = DashboardSaveBar

/// The dashboard 'save bar' is a series of buttons across the top when
/// a dashboard's chart is being edited that allows changes to be saved
/// or discarded.
///
/// dashboardChart - DashboardChartView
///
function DashboardSaveBar(dashboardChart) {
  this.dchart = dashboardChart
  SkyView.call(this, {})
}

inherits(DashboardSaveBar, SkyView)

DashboardSaveBar.prototype.View
  ( '<div class="dashboard-save-bar">'
  + '  <button:backEl class="dash-bar-button button-cancel dash-bar-back">Back to dashboard</button>'
  + '  <button:saveEl class="dash-bar-button button-create">Save</button>'
  + '  <button:closeEl class="dash-bar-button button-cancel dash-bar-close">&times;</button>'
  + '</div>' )
  .on(
    { ".dash-bar-back  click": "onBack"
    , ".button-create  click": "onSave"
    , ".dash-bar-close click": "onCancel"
    })
  .destroy(function() { this.dchart = null })

DashboardSaveBar.prototype.render = function() {
  document.querySelector(".stats-header").appendChild(this.el)
}

///
/// Events
///

// Go back to the dashboard, discarding changes.
DashboardSaveBar.prototype.onBack = function() { this.dchart.back() }
// Save changes to the dashboard chart.
DashboardSaveBar.prototype.onSave = function() { this.dchart.save() }
// Keep the chart plotted, but stop editing.
DashboardSaveBar.prototype.onCancel = function() { this.dchart.cancel() }
