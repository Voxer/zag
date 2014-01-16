var stdin = require('./util').stdin

module.exports = DashboardAdmin

function DashboardAdmin(api) { this.api = api }

DashboardAdmin.prototype.help =
  [ "list"
  , "create <id>             Create an empty dashboad."
  , "get <id>                Print the dashboard JSON."
  , "rename <fromID> <toID>"
  , "update <id>             Receives dashboard JSON via stdin."
  , "delete <id>"
  ]

DashboardAdmin.prototype.list = function() {
  this.api.listDashboards(function(err, ids) {
    if (err) throw err
    ids.sort()
    for (var i = 0; i < ids.length; i++) {
      console.log(ids[i])
    }
  })
}

// TODO the id needs to be validated with the same regex as the UI.
// args - [String name]
DashboardAdmin.prototype.create = function(args) {
  var id = args[0]
  if (!id) return 1

  this.api.replaceDashboard(id, {graphs: {}}, done)
}

// args - [String id]
DashboardAdmin.prototype.get = function(args) {
  var id = args[0]
  if (!id) return 1

  this.api.getDashboard(id, function(err, dashboard) {
    if (err) throw err
    if (dashboard) {
      console.log(JSON.stringify(dashboard, null, "  "))
    } else {
      console.log("not found")
    }
  })
}

DashboardAdmin.prototype.show = DashboardAdmin.prototype.get

// args - [String fromID, String toID]
DashboardAdmin.prototype.rename = function(args) {
  var fromID = args[0]
    , toID   = args[1]
  if (!fromID || !toID) return 1

  this.api.patchDashboard(fromID, {id: toID}, done)
}

// args - [String id]
DashboardAdmin.prototype.update = function(args) {
  var api = this.api
    , id  = args[0]
  if (!id) return 1

  stdin(function(err, body) {
    if (err) throw err
    api.patchDashboard(id, JSON.parse(body), done)
  })
}

// args - [String id]
DashboardAdmin.prototype.delete = function(args) {
  var id = args[0]
  if (!id) return 1

  this.api.deleteDashboard(id, done)
}

function done(err) { if (err) throw err }
