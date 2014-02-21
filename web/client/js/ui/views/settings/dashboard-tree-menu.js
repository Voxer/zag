var SkyView         = require('skyview')
  , inherits        = require('util').inherits
  , DashboardTree   = require('../../../models/dashboard-tree')
  , DashboardDialog = require('../dashboard-dialog')
  , MenuTree        = require('../menu-tree')

module.exports = DashboardPopup

/// options -
///   * controller - Layout
///   * emit       - Function
///   * onHide     - Function
///   * style      - String, CSS
function DashboardPopup(options) {
  this.menu    = null
  this.options = options
  DashboardTree.load(this.onLoad.bind(this))
}

DashboardPopup.prototype.onLoad = function(fail, tree) {
  if (fail) return console.error("Dashboard.load", fail)
  this.options.controller.dashboard()
  this.menu = new DashboardMenu(
    { parent: ""
    , tree:   tree
    , style:  this.options.style
    , onHide: this.options.onHide
    , emit:   this.options.emit
    , router: this.options.controller.router
    })
}

DashboardPopup.prototype.destroy = function() {
  this.menu.destroy()
  this.menu = this.options = null
}

////////////////////////////////////////////////////////////////////////////////

/// Browse dashboards as a tree of names.
///
/// options -
///   * tree
///   * onHide
///   * router
///   * emit
///   * parent
///
function DashboardMenu(opts) {
  this.tree   = opts.tree
  this.router = opts.router
  this.emit   = opts.emit
  this.onHide = opts.onHide || function() {}

  opts.items = this.getChildren(opts.parent)
  MenuTree.call(this, opts)

  if (opts.onHide) {
    this.el.className += " setting-menu"
  }
}

inherits(DashboardMenu, MenuTree)

DashboardMenu.prototype.View({})
  .destroy(function() {
    this.onHide()
    this.tree = this.router = this.emit = this.onHide = null
  })

////////////////////////////////////////////////////////////////////////////////
// Menu
////////////////////////////////////////////////////////////////////////////////

// id      - String dashboard ID
// options - MenuTree options
DashboardMenu.prototype.spawn = function(id, options) {
  options.parent = id
  options.tree   = this.tree
  options.router = this.router
  options.emit   = this.emit
  return new DashboardMenu(options)
}

// id - String dashboard ID
DashboardMenu.prototype.select = function(id) {
  if (id === ":new") {
    new DashboardDialog({tree: this.tree, parent: ""})
  } else {
    this.emit("select:dashboard", id)
  }
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

DashboardMenu.prototype.getChildren = function(id) {
  var children = this.tree.list(id)
    , items    = []
  for (var i = 0; i < children.length; i++) {
    var child  = children[i]
      , isReal = this.tree.isReal(child)
    items.push(
      { id:          child
      , label:       getLastPart(child)
      , hasChildren: this.tree.hasChildren(child)
      , disabled:   !isReal
      , href:        isReal ? this.router.getDashboardURL(child) : null
      })
  }
  if (!id) {
    if (items.length) items.push(null)
    items.push({id: ":new", label: "New Dashboard"})
  }
  return items
}

// id - String
// Returns String
function getLastPart(id) { return id.slice(id.lastIndexOf(">") + 1) }
