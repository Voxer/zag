var View     = require('../view')
  , inherits = require('util').inherits
  , Menu     = require('./menu')

module.exports = ChartHeader

/// A Chart header has the chart's title and a link to it.
/// A dashboard's charts' headers has a menu with some additional options.
///
/// dashboard - DashboardTreeView
/// chartView - ChartView
///
function ChartHeader(dashboard, chartView) {
  this.dashboard = dashboard
  this.view      = chartView
  this.chart     = chartView.chart
  View.call(this,
    { title: sail.escapeHTML(this.chart.getTitle())
    })
}

inherits(ChartHeader, View)

ChartHeader.prototype.View
  ( '<div class="chart-head">'
  +   '<a:titleEl class="chart-head-title" href="#">{title}</a>'
  +   '<button:actionsEl class="chart-head-actions" title="Chart actions">&#8801;</button>'
  + '</div>' )
  .on(
  { ".chart-head-title   click":       "showGraph"
  , ".chart-head-title   mouseover":   "onMouseOver"
  , ".chart-head-actions click":       "onClickMenu"
  , ".chart-head-actions contextmenu": "onClickMenu"
  }).destroy(function() {
    this.dashboard = this.view = this.chart = null
  })

ChartHeader.prototype.render = function() {
  this.view.el.appendChild(this.el)
}

// To ensure the link's href stays up to date with the current time range,
// it is re-set every time the link is moused over.
ChartHeader.prototype.onMouseOver = function() {
  this.titleEl.href = this.dashboard.chartToURL(this.chart)
}

ChartHeader.prototype.onClickMenu = function(ev) {
  // Prevent the browser's right-click menu.
  ev.preventDefault()
  this.showMenu()
}

// Fullscreen the graph.
ChartHeader.prototype.showGraph = function(ev) {
  if (ev.ctrlKey || ev.shiftKey || ev.metaKey) return
  ev.preventDefault()
  this.dashboard.graphChart(this.chart)
}

// Display the dashboard chart menu.
ChartHeader.prototype.showMenu = function() {
  var menu = new Menu(
    { items:
      [ {label: "Change title",          onClick: this.menuChangeTitle.bind(this)}
      , {label: "Edit chart",            onClick: this.menuEditChart.bind(this)}
      , null
      , {label: "Remove from dashboard", onClick: this.menuRemoveChart.bind(this)}
      ]
    , anchor: this.actionsEl
    })
}

ChartHeader.prototype.onTitle = function() {
  this.titleEl.textContent = this.chart.getTitle()
}

////////////////////////////////////////////////////////////////////////////////
// Menu events
////////////////////////////////////////////////////////////////////////////////

ChartHeader.prototype.menuChangeTitle = function() { this.dashboard.editChartTitle(this.view) }
ChartHeader.prototype.menuEditChart   = function() { this.dashboard.editChart(this.view) }
ChartHeader.prototype.menuRemoveChart = function() { this.dashboard.removeChart(this.view) }
