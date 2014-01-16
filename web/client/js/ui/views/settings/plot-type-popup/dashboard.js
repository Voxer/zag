var Menu     = require('../../menu')
  , inherits = require('util').inherits

module.exports = DashboardMenu

function DashboardMenu(opts) {
  this.controller = opts.controller
  this.dashboard  = opts.controller.dashboard()
  this.onHide     = opts.onHide

  Menu.call(this,
    { style: opts.style
    , items:
      [ {label: "Add Chart",        onClick: "onClickAddChart"}
      , {label: "Rename Dashboard", onClick: "onClickRenameDashboard"}
      , null
      , {label: "Delete Dashboard", onClick: "onClickDeleteDashboard"}
      ]
    })
  this.el.className += " setting-menu"
}

inherits(DashboardMenu, Menu)

DashboardMenu.prototype.View({})
  .destroy(function() {
    this.onHide()
    this.controller = this.dashboard = this.onHide = null
  })

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

DashboardMenu.prototype.onClickAddChart        = function() { this.dashboard.newChart() }
DashboardMenu.prototype.onClickRenameDashboard = function() { this.dashboard.renameDashboard() }
DashboardMenu.prototype.onClickDeleteDashboard = function() { this.dashboard.destroyDashboard() }
