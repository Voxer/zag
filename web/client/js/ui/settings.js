var EventEmitter  = require('events').EventEmitter
  , inherits      = require('util').inherits

module.exports = SettingsView

var Popups =
  { range:      require('./views/settings/range-picker-popup')
  , delta:      require('./views/settings/delta-picker-popup')
  , functions:  require('./views/settings/function-popup')
  , plottype:   require('./views/settings/plot-type-popup')
  , dashboards: require('./views/settings/dashboard-tree-menu')
  , mainmenu:   require('./views/settings/main-menu-popup')
  }

/// SettingsView represents the header bar, which mostly displays/edits PlotSettings.
///
/// Behaviors:
///   * A button the toggle sidebar visiblity.
///   * Display and edit chart interval.
///   * Display and edit chart delta.
///   * Display and edit chart type/subkeys.
///   * Display and edit dashboards.
///   * A menu with additional behavior (e.g. keybindings, help).
///
/// Events: Emitted when the user changes one of these in a popover widget.
///   * range(start, end)
///   * delta(delta)
///   * subkey(subkey)
///   * renderer(renderer)
///   * histkeys(subkeys)
///
/// controller - MetricKeyTree
/// sidebar    - SidebarView
///
function SettingsView(controller, sidebar) {
  this.controller  = controller
  this.settings    = controller.settings
  this.sidebar     = sidebar
  var el = this.el = document.querySelector(".stats-header")

  this.buttons =
    { togglesidebar: el.querySelector(".setting-togglesidebar")
    , range:         el.querySelector(".setting-range")
    , delta:         el.querySelector(".setting-delta")
    , functions:     el.querySelector(".setting-functions")
    , plottype:      el.querySelector(".setting-plottype")
    , dashboards:    el.querySelector(".setting-dashboards")
    , mainmenu:      el.querySelector(".setting-mainmenu")
    }

  // DOM Element
  this.popup         = null
  this.currentButton = null
  this.currentType   = null

  this.sidebar.setButton(this.buttons.togglesidebar)

  /// Set the buttons' initial text.
  ;["range", "delta", "plottype"].forEach(this.dirty, this)
  /// Bind events.
  sail(el).on("mousedown", this.onMouseDown.bind(this))
  // Hide the popup when the user clicks off of it.
  sail(document.body).on("mousedown", this.hidePopup.bind(this))
}

inherits(SettingsView, EventEmitter)

////////////////////////////////////////////////////////////////////////////////
// Public
////////////////////////////////////////////////////////////////////////////////

SettingsView.prototype.toggle = function(type) {
  var oldType = this.currentType
  this.hidePopup()
  if (oldType === type) return

  this.currentButton               = this.buttons[type]
  this.currentButton.className    += " current"
  this.currentButton.style.display = null
  this.currentType                 = type

  this.popup = new Popups[type](
    { controller: this.controller
    , emit:       this.emit.bind(this)
    , onHide:     this.onHidePopup.bind(this)
    , style:      this.popupStyle(this.currentButton)
    })
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

// Toggle popup on left click.
SettingsView.prototype.onMouseDown = function(ev) {
  if (ev.button !== 0) return

  var target = ev.target
    , type   = /\bsetting-([\w-]+)\b/.exec(target.className)
  if (!type) return
  if (type[1] === "togglesidebar") return this.sidebar.toggle()

  ev.stopPropagation()
  this.toggle(type[1])
}

SettingsView.prototype.onHidePopup = function() {
  this.currentButton && sail(this.currentButton).removeClass("current")
  this.popup = this.currentButton = this.currentType = null
}

////////////////////////////////////////////////////////////////////////////////
// Popup management
////////////////////////////////////////////////////////////////////////////////

SettingsView.prototype.popupStyle = function(button) {
  var group     = button.parentElement
    , bodyWidth = document.body.clientWidth
    , left      = sail(button).offset().left
    , width     = button.clientWidth
  return group.className === "settings-right"
       ? "right:" + (bodyWidth - left - width) + "px;"
       : "left:"  + left + "px;"
}

SettingsView.prototype.hidePopup = function() {
  this.popup && this.popup.destroy()
  this.onHidePopup()
}

////////////////////////////////////////////////////////////////////////////////
// Button text
////////////////////////////////////////////////////////////////////////////////
// field - String
SettingsView.prototype.dirty = function(field) {
  if      (field === "range")    this.updateRange()
  else if (field === "delta")    this.updateDelta()
  else if (field === "plottype") this.updatePlotType()
}

///
/// Redraw buttons
///

SettingsView.prototype.updateRange = function() {
  this.buttons.range.textContent = this.settings.rangeToString()
}

SettingsView.prototype.updateDelta = function() {
  this.buttons.delta.textContent = "\u0394" + this.settings.deltaToString()
}

SettingsView.prototype.updatePlotType = function() {
  this.buttons.plottype.textContent = this.controller.plotTypeToString()
}
