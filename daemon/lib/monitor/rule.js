var msWeek = 7 * 24 * 60 * 60 * 1000

module.exports = Rule

///
/// opts -
///   ts     - Integer timestamp.
///   fields - [String], a subset of FIELDS.
///   hours  - { hour : { count, count_var[, mean, mean_var] } }
///
function Rule(opts) {
  this.ts     = opts.ts
  this.fields = opts.fields
  this.hours  = opts.hours
}

Rule.interval = msWeek

// Return true when the rule needs to be re-generated with the latest points.
//
// Returns Boolean
Rule.prototype.isExpired = function() {
  return (Date.now() - this.ts > msWeek)
      || !this.hours[getHour()]
}

function getHour() { return (new Date).getHours() }
