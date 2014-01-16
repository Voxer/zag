var test        = require('tap').test
  , RuleBuilder = require('../../lib/monitor/rule-builder')
  , Rule        = require('../../lib/monitor/rule')

test("RuleBuilder", function(t) {
  var db = new RuleDB({})
    , rb = new RuleBuilder(db, 1000)
  t.equals(rb.db, db)
  t.equals(rb.wayback, 1000)
  t.end()
})

test("RuleBuilder#get valid", function(t) {
  var db = { rules: {ts: Date.now(), hours: makeHours()} }
    , rb = new RuleBuilder(new RuleDB(db), 1000)
  rb.get("key", function(err, rule) {
    if (err) throw err
    t.isa(rule, Rule)
    t.end()
  })
})

test("RuleBuilder#get build", function(t) {
  var db = { points: makePoints(1440) }
    , rb = new RuleBuilder(new RuleDB(db), 1000)
  rb.get("key", function(err, rule) {
    if (err) throw err
    t.ok(db.rules)
    t.isa(rule, Rule)
    t.deepEquals(rule.fields, ["count"])
    t.end()
  })
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function makePoints(n) {
  var points = []
  for (var i = 0; i < n; i++) {
    points.push(
      { ts:    Date.now() - n * 1000
      , count: 100 * Math.random()
      })
  }
  return points
}

function makeHours() {
  var hours = {}
  hours[(new Date).getHours()] =  {}
  return hours
}

function RuleDB(db) {
  this.db = db
}

RuleDB.prototype.getRule = function(mkey, callback) {
  var db = this.db
  process.nextTick(function() {
    callback(null, db.rules)
  })
}

RuleDB.prototype.getPoints = function(mkey, start, end, callback) {
  var db = this.db
  if (!db.points) throw new Error
  process.nextTick(function() {
    callback(null, db.points)
  })
}

RuleDB.prototype.setRule = function(mkey, rule, callback) {
  this.db.rules = rule
  process.nextTick(callback)
}
