var Histogram = require('../aggregator/metrics/histogram')
  , Rule      = require('./rule')
  , msWeek    = Rule.interval

var FIELDS = ["count", "mean"]

module.exports = RuleBuilder

///
/// db      - Backend
/// wayback - Integer, milliseconds
///
function RuleBuilder(db, wayback) {
  this.db          = db
  this.wayback     = wayback
  this.building    = 0
  this.maxBuilding = 10
}

// mkey - String metrics key.
// callback(Error, Rule)
RuleBuilder.prototype.get = function(mkey, callback) {
  var _this = this
  this.db.getRule(mkey, function(err, ruleOpts) {
    var rule = ruleOpts && new Rule(ruleOpts)
    if (err || !rule || rule.isExpired()) {
      _this.build(mkey, callback)
    } else callback(null, rule)
  })
}

// mkey - String metrics key.
// callback(Error, Rule)
RuleBuilder.prototype.build = function(mkey, callback) {
  if (this.building >= this.maxBuilding) return process.nextTick(callback)

  var now   = Date.now()
    , start = now - msWeek
    , _this = this

  this.building++
  this.db.getPoints(mkey, start, now, function(err, points) {
    _this.building--
    if (err) return callback(err)
    // Eventually it would be great to monitor sparse data, but for now
    // the alerts aren't sufficiently reliable.
    // This saves an empty rule. When it expires, an actual one will be generated.
    var rule = points.length < 1440
             ? emptyRule(now)
             : pointsToRule(now, points)
    _this.db.setRule(mkey, rule, function(err) {
      if (err) return callback(err)
      callback(null, new Rule(rule))
    })
  })
}

function emptyRule(ts) {
  return new Rule({ts: ts, fields: [], hours: {}})
}

// ts     - Integer timestamp
// points - [ { count[, mean] } ]
// Returns Rule
function pointsToRule(ts, points) {
  var hours  = {} // {hour : {count, count_var, ...}}
    , fields = []

  for (var f = 0; f < FIELDS.length; f++) {
    var rPoints = {} // {hour : Histogram}
      , field   = FIELDS[f]

    if (points[0][field] === undefined) continue
    fields.push(field)

    for (var p = 0; p < points.length; p++) {
      var point = points[p]
        , hour  = (new Date(point.ts)).getHours()

      rPoints[hour] = rPoints[hour] || new Histogram()
      rPoints[hour].push(point[field])
    }

    var hourList = Object.keys(rPoints)
    for (var h = 0; h < hourList.length; h++) {
      var hour   = hourList[h]
        , bounds = hours[hour] || (hours[hour] = {})
        , hist   = rPoints[hour].toJSON()
        , mean   = rPoints[hour].getMean()
      bounds[field]          = mean
      bounds[field + "_var"] = hist.p95 - mean
    }
  }

  return new Rule(
    { ts:     ts
    , fields: fields
    , hours:  hours
    })
}
