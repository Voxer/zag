var Dialog   = require('./dialog')
  , inherits = require('util').inherits
  , keymap   = require('../utils/keymap')

module.exports = DashboardChartDialog

/// Edit a dashboard chart's title.
///
/// chart - Chart
/// onDone({title})
///
function DashboardChartDialog(chart, onDone) {
  this.chart  = chart
  this.onDone = onDone
  Dialog.call(this,
    { title: sail.escapeHTML(chart.title || "")
    })
  this.titleEl.select()
}

inherits(DashboardChartDialog, Dialog)

DashboardChartDialog.prototype.View(
  { title: 'Name Chart'
  , body
    : '<input:titleEl type="text" placeholder="Chart title" class="chart-dialog-title" value="{title}"/>'
    + '<div class="dialog-footer">'
    +   '<button class="button-create">Save changes</button>'
    + '</div>'
  }).on(
  { ".button-create click":        "onClickSave"
  , ".chart-dialog-title keydown": "onKeyDown"
  }).destroy(function() { this.chart = this.onDone = null })

DashboardChartDialog.prototype.onClickSave = function() {
  var title = this.titleEl.value
  if (title !== this.chart.title) {
    this.onDone({title: title})
  }
  this.destroy()
}

DashboardChartDialog.prototype.onKeyDown = function(ev) {
  var key = keymap(ev)
  if      (key === "\n")     this.onClickSave()
  else if (key === "escape") this.destroy()
}
