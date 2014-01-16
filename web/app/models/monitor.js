module.exports = Monitor

/// Access the metrics-daemon monitoring API.
///
/// pool - Pool of all metrics-daemons.
///
function Monitor(pool) {
  this.pool = pool
}

Monitor.prototype.getAllWarnings = function(callback) {
  var endpoints  = this.pool.endpoints
    , warnings   = []
    , endpointsL = endpoints.length
    , total      = endpointsL
    , errs       = 0
  for (var i = 0; i < endpointsL; i++) {
    this.pool.get(
    { endpoint: endpoints[i].name
    , path:    "/api/monitor"
    }, onResponse)
  }

  function onResponse(err, res, body) {
    if (err) errs++
    if (res && res.statusCode === 200) {
      warnings = warnings.concat(JSON.parse(body))
    }
    if (--total === 0) {
      if (errs === endpointsL) return callback(err)
      callback(null, warnings)
    }
  }
}
