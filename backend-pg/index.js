var pg = require('pg')

var reDup    = /^duplicate key value/
  , reExists = /already exists/

var setup =
  [ "CREATE TABLE $env_metrics_keys ("
  + "  metrics_key varchar(512) NOT NULL CONSTRAINT $env_key_idx UNIQUE,"
  + "  type varchar(255) NOT NULL,"
  + "  create_time timestamp NOT NULL default NOW()"
  + ")"
  , "CREATE TABLE $env_metrics_data ("
  + "  metrics_key varchar(512) NOT NULL,"
  + "  time_start bigint NOT NULL,"
  + "  data text NOT NULL"
  + ")"
  , "CREATE UNIQUE INDEX $env_key_time_idx ON $env_metrics_data (metrics_key, time_start)"

  , "CREATE TABLE $env_metrics_tags ("
  + "  id varchar(255) NOT NULL,"
  + "  ts bigint NOT NULL,"
  + "  data text NOT NULL"
  + ")"
  , makeKVIndex("tags")
  , "CREATE INDEX $env_tag_time_idx ON $env_metrics_tags (ts)"

  , makeKVTable("dashboards"), makeKVIndex("dashboards")
  , makeKVTable("rules"),      makeKVIndex("rules")
  , makeKVTable("tagtypes"),   makeKVIndex("tagtypes")
  ]

function makeKVTable(table) {
  return "CREATE TABLE $env_metrics_" + table + " ("
       + "  id varchar(255) NOT NULL,"
       + "  data text NOT NULL"
       + ")"
}

function makeKVIndex(table) {
  return "CREATE UNIQUE INDEX $env_" + table + "_idx ON $env_metrics_" + table + " (id)"
}

function noop() {}

var fakeAgent = {histogram: noop, counter: noop}

module.exports = PostgresBackend

/// PostgresBackend is the bridge to the backend (in this case, Postgres).
/// It persists metrics points, keys, etc.
///
/// options -
///   env   - String
///   db    - The connection string.
///   agent - MetricsAgent (optional)
///   onError(err)
///
function PostgresBackend(options) {
  this.client  = null
  this.url     = options.db
  this.env     = options.env
  this.agent   = options.agent   || fakeAgent
  this.onError = options.onError || noop
  this.reconnect()

  // Tables
  this.tKeys       = this.env + "_metrics_keys"
  this.tData       = this.env + "_metrics_data"
  this.tTags       = this.env + "_metrics_tags"
  this.tRules      = this.env + "_metrics_rules"
  this.tDashboards = this.env + "_metrics_dashboards"
  this.tTagTypes   = this.env + "_metrics_tagtypes"
  this.reTable     = new RegExp("\\b(" + this.env + "_metrics_\\w+)\\b")

  var _this = this
  this._onKeyInsert   = function(err) { _this.onKeyInsert(err) }
  this._onPointInsert = function(err) { _this.onPointInsert(err) }
}

PostgresBackend.prototype.close = function() { this.client.end() }

PostgresBackend.prototype.setup = function(callback) {
  var _this = this
    , env   = this.env
    , i     = 0

  next()
  function next() {
    var sql = setup[i]
    if (!sql) return callback()
    _this.query(sql.replace(/[$]env/g, env), [], done)
  }

  function done(err) {
    if (err && !reExists.test(err.message)) {
      callback(err)
    } else next(++i)
  }
}

///
/// Metrics
///

// mkey  - String
// start - Integer timestamp (ms)
// end   - Integer timestamp (ms)
// callback(err, [point])
PostgresBackend.prototype.getPoints = function(mkey, start, end, callback) {
  this.query
  ( "SELECT * FROM " + this.tData + " "
  + "WHERE metrics_key=$1 "
  + "AND time_start>=$2 "
  + "AND time_start<=$3 "
  + "ORDER BY time_start",
  [mkey, toHour(start), toHour(end)], function(err, res) {
    if (err) return callback(err)
    var rows   = res.rows
      , points = []
    for (var i = 0, off = 0; i < rows.length; i++) {
      appendPoints(points, parseRow(rows[i].data), start, end)
    }
    callback(null, points)
  })
}

function appendPoints(allPoints, newPoints, start, end) {
  var count = allPoints.length
    , last  = count ? allPoints[count - 1].ts : 0
  for (var i = 0; i < newPoints.length; i++) {
    var pt = newPoints[i]
      , ts = pt.ts
    if (ts > last && start <= ts && ts <= end) {
      allPoints.push(pt)
    }
    last = Math.max(last, ts)
  }
}

// points - { mkey : point }
PostgresBackend.prototype.savePoints = function(points) {
  var mkeys = Object.keys(points)
    , tKeys = this.tKeys

  for (var i = 0; i < mkeys.length; i++) {
    var mkey = mkeys[i]
      , pt   = points[mkey]
      , type = identify(pt)
    this.query
    ( "INSERT INTO " + tKeys + " "
    + "SELECT $1,$2 "
    + "WHERE NOT EXISTS "
    + "( SELECT 1 FROM " + tKeys + " "
    +   "WHERE metrics_key=$3 )",
    [mkey, type, mkey], this._onKeyInsert)
    this.savePoint(mkey, pt, this._onKeyInsert)
  }
}

function identify(pt) {
  return pt.mean !== undefined ? "histogram"
       : pt.data !== undefined ? "llq"
       : "counter"
}

var msHour = 1000 * 60 * 60

function toHour(ms) { return ms - (ms % msHour) }

PostgresBackend.prototype.savePoint = function(mkey, pt, callback) {
  var _this = this
    , chunk = toHour(pt.ts)
    , done  = callback || this._onPointInsert
  this.query
  ( "SELECT data "
  + "FROM " + this.tData + " "
  + "WHERE metrics_key=$1 AND time_start=$2 "
  + "LIMIT 1",
  [mkey, chunk], function(err, res) {
    if (err) return done(err)
    var rows   = res    && res.rows
      , points = rows   && rows[0] && parseRow(rows[0].data)
      , count  = points && points.length
    if (points) {
      if (count && points[count - 1].ts === pt.ts) {
        return
      }
      points.push(pt)
      _this.query
      ( "UPDATE " + _this.tData + " "
      + "SET data=$1 "
      + "WHERE metrics_key=$2 AND time_start=$3",
      [JSON.stringify(points), mkey, chunk], done)
    } else {
      _this.query
      ( "INSERT INTO " + _this.tData + " VALUES($1, $2, $3)",
      [mkey, chunk, JSON.stringify([pt])], done)
    }
  })
  //this.query("INSERT INTO " + this.tData + " VALUES($1, $2, $3)", [mkey, pt.ts, JSON.stringify(pt)], callback || this._onPointInsert)
}

PostgresBackend.prototype.onKeyInsert = function(err) {
  if (err && !reDup.test(err.message)) this.onError(err)
}

PostgresBackend.prototype.onPointInsert = function(err) {
  if (err) this.onError(err)
}

// callback(err, [{key, type}])
PostgresBackend.prototype.getMetricsKeys = function(callback) {
  this.query("SELECT * FROM " + this.tKeys, [], function(err, res) {
    callback(err, res && res.rows && res.rows.map(toMetricsKey))
  })
}

// Remove the key from the metrics_keys set, but dont actually delete
// all of the historical points in metrics_data.
PostgresBackend.prototype.deleteMetricsKey = function(mkey, callback) {
  this.query("DELETE FROM " + this.tKeys + " WHERE metrics_key=$1", [mkey], callback)
}

function toMetricsKey(data) {
  var row = parseRow(data)
  return { key:  row.metrics_key
         , type: row.type
         }
}

///
/// Tags
///

// begin - Integer timestamp (ms)
// end   - Integer timestamp (ms)
PostgresBackend.prototype.getTagRange = function(begin, end, callback) {
  this.query
  ( "SELECT data FROM " + this.tTags + " "
  + "WHERE ts>=$1 "
  + "AND   ts<=$2 "
  + "ORDER BY ts",
  [begin, end], function(err, res) {
    if (err) return callback(err)
    callback(err, res && res.rows && res.rows.map(getData))
  })
}

// tag - {ts, label, color[, id]}
PostgresBackend.prototype.setTag = function(tag, callback) {
  var id    = tag.id = tag.id || (tag.ts + "_" + digits(3))
    , json  = JSON.stringify(tag)
    , _this = this
  this.query("INSERT INTO " + this.tTags + " VALUES($1, $2, $3)", [id, tag.ts, json], function(err) {
    if (!err) return callback()
    _this.query("UPDATE " + this.tTags + " SET json=$1 WHERE id=$2", [json, id], callback)
  })
}

PostgresBackend.prototype.deleteTag = function(tagID, callback) {
  this._del(this.tTags, tagID, callback)
}

function digits(n) {
  return Math.floor(Math.random() * Math.pow(10, n))
}

///
/// Tag types
///

// Fetch all tag types at once. Not a big deal since there shouldn't be more
// than a dozen or so.
//
// callback(err, {id, color, name})
//
PostgresBackend.prototype.getTagTypes = function(callback) {
  this.query("SELECT * FROM " + this.tTagTypes, [], function(err, res) {
    var rows = res && res.rows
    callback(err, rows && rows.map(rowToTagType))
  })
}

function rowToTagType(row) {
  var data = parseRow(row.data)
  data.id = row.id
  return data
}

// typeOpts - {color, name}
// callback(err)
PostgresBackend.prototype.createTagType = function(typeOpts, callback) {
  var id = Date.now() + "_" + digits(3)
  this._set(this.tTagTypes, id, typeOpts, callback)
}

// typeID - String
// callback(err)
PostgresBackend.prototype.deleteTagType = function(typeID, callback) {
  this._del(this.tTagTypes, typeID, callback)
}

///
/// Rules
///

PostgresBackend.prototype.getRule = function(mkey, callback) {
  this._get(this.tRules, mkey, callback)
}

PostgresBackend.prototype.setRule = function(mkey, rule, callback) {
  this._set(this.tRules, mkey, rule, callback)
}

///
/// Dashboards
///

PostgresBackend.prototype.getDashboard = function(id, callback) {
  this._get(this.tDashboards, id, callback)
}

PostgresBackend.prototype.setDashboard = function(id, dashboard, callback) {
  this._set(this.tDashboards, id, dashboard, callback)
}

PostgresBackend.prototype.deleteDashboard = function(id, callback) {
  this._del(this.tDashboards, id, callback)
}

// List all dashboard IDs.
PostgresBackend.prototype.listDashboards = function(callback) {
  this.query("SELECT id FROM " + this.tDashboards, [], function(err, res) {
    callback(err, res && res.rows && res.rows.map(getID))
  })
}


// Like `client.query`, but record latency and errors.
PostgresBackend.prototype.query = function(sql, params, callback) {
  var agent = this.agent
    , start = Date.now()
    , index = sql.indexOf(" ")
    , cmd   = index === -1 ? sql : sql.slice(0, index)
    , table = this.reTable.exec(sql)

  table = table ? table[1] : "unknown"
  this.client.query(sql, params, function(err, res) {
    agent.histogram("timing|" + cmd + "|" + table, Date.now() - start)
    if (err) {
      agent.counter("error|" + cmd + "|" + table)
    }

    if (callback) callback(err, res)
  })
}

PostgresBackend.prototype.reconnect = function() {
  var isReconnect = !!this.client
  if (this.client) this.client.end()
  this.client = new pg.Client(this.url)
  this.client.on("error", this.onConnectionError.bind(this))

  var _this = this
  this.client.connect(function(err) {
    if (err) {
      if (!isReconnect) throw err
      setTimeout(_this.reconnect.bind(_this), 1000)
    }
  })
}

PostgresBackend.prototype.onConnectionError = function(err) {
  this.onError(err)
  this.reconnect()
}

///
/// KV
///

PostgresBackend.prototype._get = function(table, id, callback) {
  this.query("SELECT data FROM " + table + " WHERE id=$1 LIMIT 1", [id], pluckFirstData(id, callback))
}

// Upsert
PostgresBackend.prototype._set = function(table, id, data, callback) {
  var json  = JSON.stringify(data)
    , _this = this
  this.query("INSERT INTO " + table + " VALUES($1, $2)", [id, json], function(err) {
    if (!err) return callback()
    _this.query("UPDATE " + table + " SET data=$1 WHERE id=$2", [json, id], callback)
  })
}

PostgresBackend.prototype._del = function(table, id, callback) {
  this.query("DELETE FROM " + table + " WHERE id=$1", [id], callback)
}

function getID(row) { return row.id }

function getData(row) { return parseRow(row.data) }

function pluckFirstData(id, callback) {
  return function(err, res) {
    var rows = res && res.rows
      , val  = rows && rows[0] && parseRow(rows[0].data)
    if (val) val.id = id
    callback(err, val)
  }
}

function parseRow(row) {
  return typeof row === "string" ? JSON.parse(row) : row
}
