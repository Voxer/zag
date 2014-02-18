var LinkDialog        = require('../link-dialog')
  , KeyBindingsDialog = require('../keybindings-dialog')
  , Menu              = require('../menu')
  , inherits          = require('util').inherits
  , openNewTab        = require('../../utils/new-tab')
  , HELP              = "https://github.com/Voxer/metrics"

module.exports = MainMenu

/// The "main menu" for the application.
///
/// Actions:
///   * Export as... TODO
///   * Manage tags TODO
///   * Functions
///   * Permalink
///   * Key bindings
///   * Help
///
function MainMenu(opts) {
  this.controller = opts.controller
  this.onHide     = opts.onHide
  var isDashboard = this.controller.modeToString() === "dashboard"

  Menu.call(this,
    { style: opts.style
    , items:
      [ { label: "Permalink",    onClick: "onClickPermalink" }
      , { label:   "Functions"
        , onClick: "onClickFunctions"
        , disabled: isDashboard
        }
      , null
      , { label: "Key Bindings", onClick: "onClickKeyBindings" }
      , { label: "Help",         onClick: "onClickHelp", href: HELP }
      ]
    })
  this.el.className += " setting-menu"
}

inherits(MainMenu, Menu)

MainMenu.prototype.View({})
  .destroy(function() {
    this.onHide()
    this.controller = this.onHide = null
  })

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

MainMenu.prototype.onClickPermalink = function() {
  new LinkDialog(
    { title: "Permalink"
    , link:   this.controller.permalink()
    })
}

MainMenu.prototype.onClickFunctions = function() {
  this.controller.header.toggle("functions")
}

MainMenu.prototype.onClickKeyBindings = function() { KeyBindingsDialog.toggle() }

MainMenu.prototype.onClickHelp = function() { openNewTab(HELP) }
