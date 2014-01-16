module.exports = APIClient

/// TODO tests
/// A metrics HTTP API wrapper.
///
/// ajax -
///   function(path, {method, parameters, body}, callback(fail, body))
///   The body passed to the callback should be a String, not a Buffer.
///
function APIClient(ajax) { this.ajax = ajax }

// Same as APIClient#ajax, but JSON-parses the response.
APIClient.prototype.json = function(url, opts, callback) {
  this.ajax(url, opts, function(fail, body) {
    if (fail) return callback(fail)
    if (body) return callback(null, JSON.parse(body))
    callback()
  })
}

////////////////////////////////////////////////////////////////////////////////
// Keys
////////////////////////////////////////////////////////////////////////////////

// callback(err, [{key, hasChildren}])
APIClient.prototype.getRootKeys = function(callback) {
  return this.json("/api/keys", {method: "GET"}, callback)
}

// keys - String or [String]
// callback(err, {parent : [{key, hasChildren}]})
APIClient.prototype.getChildKeys = function(keys, callback) {
  var keys = typeof keys === "string" ? keys : keys.join(",")
  return this.json("/api/keys/" + encodeURIComponent(keys), {method: "GET"}, callback)
}

// callback(err, [key])
APIClient.prototype.getAllKeys = function(callback) {
  return this.json("/api/allkeys", {method: "GET"}, callback)
}

// query - String
// limit - Integer
// callback(err, [{key, hasChildren}])
APIClient.prototype.filterKeys = function(query, limit, callback) {
  return this.json("/api/filter",
    { method:     "GET"
    , parameters: {q: query, limit: limit}
    }, callback)
}

// key - String
// callback(err)
APIClient.prototype.deleteKey = function(key, callback) {
  return this.ajax("/api/keys/" + encodeURIComponent(key), {method: "DELETE"}, callback)
}

////////////////////////////////////////////////////////////////////////////////
// Tags
////////////////////////////////////////////////////////////////////////////////

// start - Integer timestamp
// end   - Integer timestamp
// callback(err, [{ts, label, color}])
APIClient.prototype.getTags = function(start, end, callback) {
  return this.json("/api/tags",
    { method:     "GET"
    , parameters: {begin: start, end: end}
    }, callback)
}

// tagOpts - {ts, label, color, id}
// callback(err)
APIClient.prototype.createTag = function(tagOpts, callback) {
  return this.ajax("/api/tags", {method: "POST", parameters: tagOpts}, callback)
}

// tagID - String
// callback(err)
APIClient.prototype.deleteTag = function(tagID, callback) {
  return this.ajax("/api/tags/" + encodeURIComponent(tagID), {method: "DELETE"}, callback)
}

////////////////////////////////////////////////////////////////////////////////
// Tag types
////////////////////////////////////////////////////////////////////////////////

// callback(err, [{id, color, name}])
APIClient.prototype.getTagTypes = function(callback) {
  return this.json("/api/tagtypes", {method: "GET"}, callback)
}

// opts - {name, color}
// callback(err)
APIClient.prototype.createTagType = function(opts, callback) {
  return this.json("/api/tagtypes",
    { method:    "POST"
    , parameters: opts
    }, callback)
}

// typeID - String
// callback(err)
APIClient.prototype.deleteTagType = function(typeID, callback) {
  return this.json("/api/tagtypes/" + encodeURIComponent(typeID), {method: "DELETE"}, callback)
}

////////////////////////////////////////////////////////////////////////////////
// Dashboards
////////////////////////////////////////////////////////////////////////////////

// callback(err, [id])
APIClient.prototype.listDashboards = function(callback) {
  return this.json("/api/dashboards", {method: "GET"}, callback)
}

// id - String
// callback(err, {graphs})
APIClient.prototype.getDashboard = function(id, callback) {
  return this.json("/api/dashboards/" + encodeURIComponent(id), {method: "GET"}, callback)
}

// id       - String
// dashOpts - {graphs}
// callback(err)
APIClient.prototype.replaceDashboard = function(id, dashOpts, callback) {
  return this.ajax("/api/dashboards/" + encodeURIComponent(id),
    { method: "POST"
    , body:   JSON.stringify(dashOpts)
    }, callback)
}

// id       - String
// dashOpts - {id, graphs}
// callback(err)
APIClient.prototype.patchDashboard = function(id, dashOpts, callback) {
  return this.ajax("/api/dashboards/" + encodeURIComponent(id),
    { method: "PATCH"
    , body:   JSON.stringify(dashOpts)
    }, callback)
}

// id - String
// callback(err)
APIClient.prototype.deleteDashboard = function(id, callback) {
  return this.ajax("/api/dashboards/" + encodeURIComponent(id), {method: "DELETE"}, callback)
}


////////////////////////////////////////////////////////////////////////////////
// Monitoring
////////////////////////////////////////////////////////////////////////////////

// callback(err, warnings)
APIClient.prototype.monitor = function(callback) {
  return this.json("/api/monitor", {method: "GET"}, callback)
}

////////////////////////////////////////////////////////////////////////////////
// Channels
////////////////////////////////////////////////////////////////////////////////

// channelID  - String
// updates - {add, remove}
// callback(fail)
APIClient.prototype.setChannelMetrics = function(channelID, updates, callback) {
  return this.ajax("/api/channels/" + encodeURIComponent(channelID),
    { method: "POST"
    , body:   JSON.stringify(updates)
    }, callback)
}
