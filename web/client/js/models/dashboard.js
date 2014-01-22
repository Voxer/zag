module.exports = Dashboard

/// Dashboard instances are instantiated and cached by a DashboardTree singleton.
///
/// opts -
///   * id     - String unique dashboard name
///   * graphs - {String graph id : {title, keys, renderer, subkey, histkeys}}
/// tree - DashboardTree
///
function Dashboard(opts, tree) {
  this.tree   = tree
  this.id     = opts.id
  this.graphs = opts.graphs || {}
}

// Returns Object
Dashboard.prototype.toJSON = function() {
  return { id:     this.id
         , graphs: this.graphs
         }
}

///
/// CRUD
///

// Public: Update/delete the graph.
//
// dashOpts - {id, graphs}
//
Dashboard.prototype.update  = function(dashOpts) { this.tree.update(this.id, dashOpts) }
Dashboard.prototype.destroy = function() { this.tree.destroy(this.id) }

// chart - Chart
Dashboard.prototype.updateChart = function(chart) {
  var opts  = chart.toJSON()
    , patch = {}
  patch[opts.id] = opts
  this.update({graphs: patch})
}

// Remove the specified chart from the graph.
//
// chartID - String
//
Dashboard.prototype.removeChart = function(chartID) {
  var patch      = {}
  patch[chartID] = null
  this.update({graphs: patch})
}

///
/// Internal to Dashboard and DashboardTree.
///

// Apply updates to any field except "id".
Dashboard.prototype._update = function(dashOpts) {
  if (dashOpts.id)     this.id = dashOpts.id
  if (dashOpts.graphs) mergeGraphs(this.graphs, dashOpts.graphs)
}

Dashboard.prototype._destroy = function() { this.tree = this.graphs = null }

function mergeGraphs(target, extra) {
  var keys = Object.keys(extra)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
      , val = extra[key]
    if (val === null) {
      delete target[key]
    } else {
      target[key] = val
    }
  }
  return target
}
