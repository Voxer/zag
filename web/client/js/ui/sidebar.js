var TreeView    = require('./metrics-tree-view')
  , Spinner     = require('./views/spinner')
  , ARROW_LEFT  = "\u25C0"
  , ARROW_RIGHT = "\u25B6"

module.exports = SidebarView

function noop() {}

function SidebarView(tree, controller) {
  this.el         = document.querySelector(".sidebar")
  this.controller = controller
  this.button     = null
  this.isVisible  = true
  this.filterEl   = this.el.querySelector(".stats-filter-input")

  // Tree initialization: MetricsTreeView
  this.tree = new TreeView(this.el.querySelector(".tree"),
    { load:        tree.load.bind(tree)
    , leafToPath:  tree.keyToPath.bind(tree)
    , leafToParts: tree.keyToParts.bind(tree)
    , filter:      tree.filter.bind(tree)
    , filterEl:    this.filterEl
    })
  this.loader = null
  this.tree.on("load:start", this.showLoader.bind(this))
  this.tree.on("load:end",   this.hideLoader.bind(this))
}

////////////////////////////////////////////////////////////////////////////////
// Visibility
////////////////////////////////////////////////////////////////////////////////

// Toggle sidebar visibility.
SidebarView.prototype.toggle = function() {
  this.isVisible ? this.hide() : this.show()
}

// Show the sidebar.
SidebarView.prototype.show = function() {
  if (this.isVisible) return
  this.isVisible            = true
  this.button.textContent   = ARROW_LEFT
  this.el.style.display     = null
  this.controller.showPane("sidebar")
}

// Hide the sidebar.
SidebarView.prototype.hide = function() {
  if (!this.isVisible) return
  this.isVisible          = false
  this.button.textContent = ARROW_RIGHT
  this.el.style.display = "none"
  this.controller.hidePane("sidebar")
}

// The button to toggle sidebar visibility.
// button - DOM Element
SidebarView.prototype.setButton = function(button) {
  this.button        = button
  button.textContent = ARROW_LEFT
}

// Focus the tree filter input box.
// This will show the sidebar if it is hidden.
SidebarView.prototype.focus = function() {
  if (!this.isVisible) this.show()
  this.filterEl.select()
}

////////////////////////////////////////////////////////////////////////////////
// Loader events
////////////////////////////////////////////////////////////////////////////////
SidebarView.prototype.showLoader = function() {
  if (this.loader) return
  this.loader = new Spinner(this.el)
  this.loader.more()
}

SidebarView.prototype.hideLoader = function() {
  if (this.loader) this.loader.destroy()
  this.loader = null
}
