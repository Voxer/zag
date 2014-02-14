var EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , HISTOGRAM    = require('./plot-settings').HISTOGRAM

module.exports = Router

// Emit events when the user hits the back/forward button
// so that the keys can be re-plotted and settings kept in sync.
//
// location - Location (document.location).
//   For mocking, only {origin, pathname, search} are necessary.
// settings - PlotSettings
//
function Router(location, settings) {
  this.location = location
  this.settings = settings
}

inherits(Router, EventEmitter)

// Override
Router.toQueryString = null
Router.parseQuery    = null

// The user pressed the back/forward button on their browser.
// Also: the "popstate" event on page load initializes the first graph.
Router.prototype.onPopState = function() {
  var loc   = this.location
    , psets = this.settings.decode(this.parseQuery())
    , match = /\/(dashboards|graph)\/([^\/?]*)/.exec(loc.pathname)
    , type  = match[1]

  if (type === "graph") {
    var mkeys = match[2].split(",").map(decodeURIComponent)
    if (!mkeys[0]) {
      this.emit("select:none")
    } else if (mkeys.length === 1) {
      this.emit("select:one", mkeys[0])
    } else {
      this.emit("select:many", mkeys)
    }
    this.emitTitle("graph", mkeys)
  } else if (type === "dashboards") {
    var dashboardID = decodeURIComponent(match[2])
    this.emit("select:dashboard", dashboardID)
    this.emitTitle("dashboard", dashboardID)
  }

  this.emit("range:real", psets.startReal, psets.endReal)
  this.emit("delta",      psets.deltaReal)
  this.emit("renderer",   psets.renderer)
  this.emit("histkeys",   psets.histkeys)
  this.emit("subkey",     psets.subkey)
}

// Push a URL with the current graph state.
//
// mode - "dashboard" or "graph"
// data - If mode is "dashboard", this will be the dashboard ID.
//        If mode is "graph", this will be an Array of String metrics keys.
//
// Returns String URL if the location changed.
// Returns null if the location stayed the same.
Router.prototype.update = function(mode, data) {
  var url = this.toURL(mode, data)
  this.emitTitle(mode, data)
  return url === this.path() ? null : url
}

// mode, data - Same as Router#update.
Router.prototype.permalink = function(mode, data) {
  var sett   = this.settings
    , isLive = sett.isLive()
  return this.location.origin + this.toURL(mode, data,
    { start: isLive ? sett.startReal : sett.start
    , end:   isLive ? sett.endReal   : sett.end
    })
}

// mkeys - [String]
// Returns String path.
Router.prototype.getGraphURL = function(mkeys, qs) {
  return "/graph/" + mkeys.map(encodeURIComponent).join(",")
       + "?" + this.settingsToQueryString(qs)
}

// id - String dashboard ID.
// Returns String path.
Router.prototype.getDashboardURL = function(id, qs) {
  return "/dashboards/" + encodeURIComponent(id)
       + "?" + this.settingsToQueryString(qs)
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Get the current path and query string.
//
// Returns String
Router.prototype.path = function() {
  return this.location.pathname + this.location.search
}

// Returns String path.
Router.prototype.toURL = function(mode, data, qs) {
  return mode === "graph"     ? this.getGraphURL(data, qs)
       : mode === "dashboard" ? this.getDashboardURL(data, qs)
       : "/"
}

// Returns Object
Router.prototype.settingsToQuery = function() {
  var settings = this.settings
  return { start:    settings.startReal
         , end:      settings.endReal
         , delta:    settings.deltaReal === "auto"  ? false : settings.deltaReal
         , renderer: settings.renderer  === "line"  ? false : settings.renderer
         , subkey:   settings.subkey    === "count" ? false : settings.subkey
         , histkeys: settings.histkeys
         , nocache:  settings.nocache
         }
}

// Get the current query string.
//
// opts - Object, optional. Override some fields.
//
// Returns String
Router.prototype.settingsToQueryString = function(opts) {
  var query = this.settingsToQuery()
  if (opts) {
    var keys = Object.keys(opts)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      query[key] = opts[key]
    }
  }
  if (query.histkeys) {
    query.histkeys = histKeysToString(query.histkeys)
  }
  return Router.toQueryString(cleanQuery(query))
}

// Returns Object
Router.prototype.parseQuery = function() {
  var search = this.location.search
  return search ? Router.parseQuery(search.slice(1)) : {}
}

// mode, data - Same as Router#update
Router.prototype.emitTitle = function(mode, data) {
  this.emit("title", getTitle(mode, data))
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// mode, data - Same as Router#update.
function getTitle(mode, data) {
  return mode === "graph"     ? "[M] " + data[0] + (data.length > 1 ? " \u2026" : "")
       : mode === "dashboard" ? "[M] " + data
       : "[M] ?"
}

///
/// QS helpers
///

// Delete empty params so they dont get added to the URL.
function cleanQuery(obj) {
  var qs   = {}
    , keys = Object.keys(obj)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
      , val = obj[key]
    if (truthy(val)) qs[key] = val
  }
  return qs
}

function truthy(val) { return val || val === 0 }

///
/// Histogram helpers
///

// histkeys - [String]
// Returns String
function histKeysToString(histkeys) {
  return histKeysSame(histkeys, HISTOGRAM) ? null : histkeys.join(",")
}

// Returns Boolean
function histKeysSame(h1, h2) {
  return h1.sort().join(",") === h2.sort().join(",")
}
