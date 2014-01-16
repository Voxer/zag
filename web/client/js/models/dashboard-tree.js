var api          = require('../api')
  , EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , Dashboard    = require('./dashboard')
  , ImplicitTree = require('./implicit-tree')
  , tree

module.exports = DashboardTree

/// A DashboardTree takes a flat list of dashboard IDs and converts them to
/// a tree structure.
///
/// dashboardIDs - [String]
///
/// Events:
///   * create(dashboardID)
///   * delete(dashboardID)
///   * change:id(fromID, toID)
///   * error(String message) TODO listen for and alert this
///
function DashboardTree(dashboardIDs) {
  this.tree  = new ImplicitTree(dashboardIDs, ">")
  this.cache = {} // { String id : Dashboard }
}

inherits(DashboardTree, EventEmitter)

DashboardTree.TOP = ImplicitTree.TOP

// callback(fail, dashboardTree)
DashboardTree.load = function(callback) {
  if (tree) return callback(null, tree)
  api.listDashboards(function(fail, dashboardIDs) {
    if (fail) return callback(fail)
    callback(null, tree = new DashboardTree(dashboardIDs))
  })
}

// Used for testing.
DashboardTree.inject = function(_api) { api = _api }

////////////////////////////////////////////////////////////////////////////////

///
/// Proxy to ImplicitTree
///

;["parent", "top", "list", "isReal", "hasChildren"].forEach(function(fn) {
  DashboardTree.prototype[fn] = function(id) {
    return this.tree[fn](id)
  }
})

////////////////////////////////////////////////////////////////////////////////
// CRUD
////////////////////////////////////////////////////////////////////////////////

// dashOpts - {id}
DashboardTree.prototype.create = function(dashOpts) {
  var id   = dashOpts.id
    , dash = this.cache[id] = new Dashboard(dashOpts, this)

  this.tree.insert(id)
  this.emit("create", id)
  api.replaceDashboard(id, dash.toJSON(), this.onError("Error creating dashboard."))
}

// id - String dashboard ID
// callback(fail, dashboard)
DashboardTree.prototype.get = function(id, callback) {
  var cache = this.cache
  if (cache[id]) return callback(null, cache[id])
  var _this = this
  api.getDashboard(id, function(fail, dashboard) {
    callback(fail, dashboard && (cache[id] = new Dashboard(dashboard, _this)))
  })
}

// fromID   - String, the ID of the dashboard being edited.
// dashOpts - {id}
DashboardTree.prototype.update = function(fromID, dashOpts) {
  var toID    = dashOpts.id
    , dash    = this.cache[fromID]
    , isNewID = toID && fromID !== toID
  // The dashboard was renamed.
  if (isNewID) {
    // Update the cache entry, if any.
    if (dash) {
      this.cache[toID]   = dash
      this.cache[fromID] = null
    }
    // Update the tree.
    this.tree.remove(fromID)
    this.tree.insert(toID)
  }
  if (dash) dash._update(dashOpts)

  if (isNewID) this.emit("change:id", fromID, toID)
  api.patchDashboard(fromID, dashOpts, this.onError("Error modifying dashboard."))
}

// id - String
DashboardTree.prototype.destroy = function(id) {
  this.tree.remove(id)
  if (this.cache[id]) {
    this.cache[id]._destroy()
    this.cache[id] = null
  }
  this.emit("delete", id)
  api.deleteDashboard(id, this.onError("Error deleting dashboard."))
}


////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// message - String
DashboardTree.prototype.onError = function(message) {
  var _this = this
  return function(fail) {
    if (fail) _this.emit("error", message)
  }
}
