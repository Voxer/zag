var EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , RuleBuilder  = require('./rule-builder')
  , RuleTester   = require('./rule-tester')
  , reLLQ        = /@llq$/

module.exports = MetricsMonitor

var passTest =
  { test:      function() { return [] }
  , isExpired: function() { return false }
  }

///
/// db - Backend
///
/// Events:
///   * warn([Warning])
///   * error(err)
///
function MetricsMonitor(db) {
  this.db    = db
  this.tests = {} // { mkey : RuleTester }
  this.rules = new RuleBuilder(db, 7 * 24 * 60 * 60 * 1000)
}

inherits(MetricsMonitor, EventEmitter)

// points - {mkey : point}
MetricsMonitor.prototype.test = function(points) {
  var mkeys    = Object.keys(points)
    , warnings = []
  for (var i = 0; i < mkeys.length; i++) {
    var mkey = mkeys[i]
    if (reLLQ.test(mkey)) continue
    var tester = this.getTester(mkey)
      , warns  = tester.test(points[mkey])
    for (var j = 0; j < warns.length; j++) { warnings.push(warns[j]) }

    if (tester.isExpired()) {
      this.tests[mkey] = null
    }
  }
  this.emit("warn", warnings)
  return warnings
}


////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// mkey - String
// Returns RuleTester
MetricsMonitor.prototype.getTester = function(mkey) {
  var tester = this.tests[mkey]
  if (!tester) this.loadRule(mkey)
  return tester || passTest
}

// mkey - String
MetricsMonitor.prototype.loadRule = function(mkey) {
  var _this = this
  this.tests[mkey] = passTest
  this.rules.get(mkey, function(err, rule) {
    // This is before the error event because even if `rule` isn't defined
    // we want to remove `passTest` from `this.tests` so that it will
    // be retried.
    _this.tests[mkey] = rule && new RuleTester(mkey, rule)
    if (err) {
      _this.emit("error", err)
    }
  })
}
