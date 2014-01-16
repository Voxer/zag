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
  this.db      = db
  this.wayback = wayback
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
  var now   = Date.now()
    , start = now - msWeek
    , db    = this.db
  db.getPoints(mkey, start, now, function(err, points) {
    if (err) return callback(err)
    // Eventually it would be great to monitor sparse data, but for now
    // the alerts aren't sufficiently reliable.
    if (points.length < 1440) return callback()
    var rule = pointsToRule(now, points)
    db.setRule(mkey, rule, function(err) {
      if (err) return callback(err)
      callback(null, new Rule(rule))
    })
  })
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
      bounds[field]          = rPoints[hour].getMean()
      bounds[field + "_var"] = rPoints[hour].getVariance()
    }
  }

  return new Rule(
    { ts:     ts
    , fields: fields
    , hours:  hours
    })
}
