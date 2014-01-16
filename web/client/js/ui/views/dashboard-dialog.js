var Dialog        = require('./dialog')
  , inherits      = require('util').inherits
  , DashboardTree = require('../../models/dashboard-tree')
  , InputHint     = require('./input-hint')
  , VALID         = '<span class="dashboard-valid">&#10003;</span> '
  , INVALID       = '<span class="dashboard-invalid">&times;</span> '
  , reDash        = /^(?:[\w-]+\>)*[\w-]+$/

var GT = '<code>&gt;</code>'
var HELP_ID
  = 'Multiple dashboards can be organized into a tree by naming them'
  + ' with a '+GT+' separator, e.g. <code>parent&gt;child</code>.'

module.exports = DashboardDialog

/// Create/rename/delete a dashboard.
/// This does not include any management of the contents of the dashboard,
/// i.e. the graphs.
///
/// opts -
///   * tree
///     DashboardTree (required)
///   * id
///     String, optional initial dashboard ID.
///     If provided, the user is editing an existing dashboard.
///   * parent
///     String, optional initial parent ID.
///     If provided, the user is creating a new dashboard underneath it.
///
function DashboardDialog(opts) {
  this.tree       = opts.tree
  this.id         = opts.id
  this.isNew      = !opts.id
  this.isDisabled = false

  Dialog.call(this,
    { title:      this.isNew ? "New" : "Edit"
    , name:       opts.id || (opts.parent ? opts.parent + ">" : "")
    , deleteHTML: this.isNew ? "" : this.deleteHTML()
    , create:     this.isNew ? "Create" : "Update"
    })

  this.update()
  this.idEl.select()
  this.idHint = new InputHint(
    { input: this.idLabelEl
    , hint:  HELP_ID
    })
}

inherits(DashboardDialog, Dialog)

DashboardDialog.prototype.View(
  { title: '{title} Dashboard'
  , body
    : '<label:idLabelEl class="dashboard-dialog-id-label">'
    +   '<input:idEl type="text" placeholder="Dashboard name" class="dashboard-dialog-id" value="{name}"/>'
    + '</label>'
    + '<div:infoEl class="dashboard-dialog-info"></div>'
    + '<div class="dialog-footer">'
    +   '{deleteHTML}'
    +   '<button:saveEl class="button-create">{create} Dashboard</button>'
    + '</div>'
  })
  .on(
  { ".dashboard-dialog-id keydown": "onKeyDown"
  , ".button-create       click":   "onClickSave"
  , ".button-delete       click":   "onClickDelete"
  })
  .destroy(function() {
    this.idHint.destroy()
    this.tree = this.idHint = null
  })

// Returns String
DashboardDialog.prototype.getID = function() { return this.idEl.value }

////////////////////////////////////////////////////////////////////////////////
// Rendering
////////////////////////////////////////////////////////////////////////////////

// Redraw the info message (e.g. error validation).
DashboardDialog.prototype.update = function() {
  var id     = this.getID()
    , parent = this.tree.parent(id)
    , error  = this.validateID()
    , message
      = error ? INVALID + error
      : id    ? VALID
        + (parent
          ? 'Child dashboard of <code>' + sail.escapeHTML(parent) + '</code>'
          : 'Top-level dashboard')
      : ""

  this.infoEl.innerHTML = message
  this.setDisabled(!!error)
}

// Returns String HTML.
DashboardDialog.prototype.deleteHTML = function() {
  return '<button class="button-delete dashboard-dialog-delete">Delete</button>'
}

DashboardDialog.prototype.setDisabled = function(isDisabled) {
  if (this.isDisabled === isDisabled) return
  sail[(this.isDisabled = isDisabled)
    ? "addClass" : "removeClass"](this.saveEl, "disabled")
}

////////////////////////////////////////////////////////////////////////////////
// Validation
////////////////////////////////////////////////////////////////////////////////

// Validate the ID (name) field.
//
// Returns String error on fail.
// Returns undefined on success.
DashboardDialog.prototype.validateID = function() {
  var id = this.getID()
  if (!id) {
    return "Dashboard name is required."
  }
  var isDash = this.tree.isReal(id)
  if (  this.isNew && isDash
   || (!this.isNew && isDash && id !== this.id)) {
    return "A dashboard with that name already exists."
  }
  if (!reDash.test(id)) {
    return "Invalid dashboard name, must match <code>" + reDash.toString() + "</code>"
  }
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

DashboardDialog.prototype.onKeyDown = function() {
  setTimeout(this.update.bind(this), 0)
}

DashboardDialog.prototype.onClickSave = function() {
  if (this.validateID()) return
  var newID = this.getID()
    , json  = {id: newID}
  // Update: rename
  if (this.id) {
    if (this.id !== newID) {
      this.tree.update(this.id, json)
    }
  // Create
  } else this.tree.create(json)
  this.destroy()
}

DashboardDialog.prototype.onClickDelete = function() {
  this.tree.destroy(this.id)
  this.destroy()
}
