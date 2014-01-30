var RunningMean = require('./running-mean')
  , Warning     = require('./warning')

module.exports = RuleTester

/// A RuleTester receives points and outputs warnings.
///
/// mkey - String
/// rule - Rule
///
function RuleTester(mkey, rule) {
  this.mkey   = mkey
  this.rule   = rule
  this.dmeans = {} // { field : RunningMean }
}

// point - {count} or {mean, median, ...}
// Returns [Warning]
RuleTester.prototype.test = function(point) {
  var warnings = []
    , fields   = this.rule.fields
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
      , value = point[field]
    if (value !== undefined) {
      this.getDMean(field).push(value)
      var warn = this.check(field)
      if (warn) warnings.push(warn)
    }
  }
  return warnings
}

RuleTester.prototype.isExpired = function() {
  return this.rule.isExpired()
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// field - String "count" or "mean"
// Returns Warning or undefined
RuleTester.prototype.check = function(field) {
  var rpoint = this.dmeans[field]
    , bounds = this.rule.hours[getHour()]

  if (!bounds) return

  var value  = rpoint.mean
    , target = bounds[field]
    , margin = Math.max(1, Math.sqrt(bounds[field + "_var"]))

  if (value > target + margin) {
    return new Warning(this.mkey, field, value, target, margin, ">")
  }

  if (value < target - margin) {
    return new Warning(this.mkey, field, value, target, margin, "<")
  }
}

// field - String "count" or "mean"
// Returns RunningMean
RuleTester.prototype.getDMean = function(field) {
  return this.dmeans[field]
     || (this.dmeans[field] = new RunningMean(0.2))
}

function getHour() { return (new Date).getHours() }
