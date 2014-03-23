module.exports = DashboardManager

///
/// A dashboard looks like:
///
///   { id: String
///   , graphs:
///     { <Integer id>:
///       { id:        String (its an Integer)
///       , title:     String
///       , keys:     ["metrics_foo"]
///       , renderer:  String
///       , subkey:    String
///       , histkeys: [String]
///       }
///     // ...
///     }
///   }
///
function DashboardManager(db) {
  this.db    = db
  this.cache = null // [String dashboard ID]
}

DashboardManager.prototype.get = function(id, callback) { this.db.getDashboard(id, callback) }

// Set the value of a dashboard.
DashboardManager.prototype.set = function(id, val, callback) {
  if (this.cache && this.cache.indexOf(id) === -1) {
    this.cache.push(id)
  }
  val.id = id
  this.db.setDashboard(id, val, callback)
}

DashboardManager.prototype.del = function(id, callback) {
  if (this.cache) {
    var index = this.cache.indexOf(id)
    if (index !== -1) this.cache.splice(index, 1)
  }
  this.db.deleteDashboard(id, callback)
}

// Add a graph to the end of the dashboard.
//
// id       - String
// updates  - {id, graphs}
// callback - Receives `(err)`.
//
DashboardManager.prototype.modify = function(id, updates, callback) {
  var _this = this
  this.get(id, function(err, dash) {
    if (err)   return callback(err)
    if (!dash) return callback(new Error("no dashboard"))

    dash.id = updates.id || id
    _this.set(dash.id, applyUpdates(dash, updates), function(err) {
      if (err) return callback(err)
      if (updates.id && updates.id !== id) {
        _this.del(id, callback)
      } else {
        callback()
      }
    })
  })
}

function applyUpdates(dashboard, updates) {
  var graphs   = updates.graphs || {}
    , graphIDs = Object.keys(graphs)
  for (var i = 0; i < graphIDs.length; i++) {
    var graphID = graphIDs[i]
      , graph   = graphs[graphID]
    if (graph) {
      dashboard.graphs[graphID] = graph
    } else {
      delete dashboard.graphs[graphID]
    }
  }
  return dashboard
}


// callback - Receives `(err, ids)`.
DashboardManager.prototype.list = function(callback) {
  if (this.cache) return callback(null, this.cache)
  var _this = this
  this.db.listDashboards(function(err, json) {
    callback(err, (_this.cache = json) || [])
  })
}
