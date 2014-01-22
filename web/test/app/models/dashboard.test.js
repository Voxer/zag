var test             = require('tap').test
  , DashboardManager = require('../../../app/models/dashboard')

test("DashboardManager#set", function(t) {
  var db   = new MockDB()
    , dm   = new DashboardManager(db)
  dm.cache = []
  dm.set("foo", {}, function() {
    t.deepEquals(dm.cache, ["foo"])
    t.deepEquals(db.ops, [["setDashboard", "foo", {id: "foo"}]])
    t.end()
  })
})

test("DashboardManager#del", function(t) {
  var db = new MockDB({foo: {id: "foo"}})
    , dm = new DashboardManager(db)
  dm.list(function(err, dashs) {
    if (err) throw err
    t.deepEquals(dashs, ["foo"])
    dm.del("foo", function() {
      t.deepEquals(dm.cache, [])
      dm.list(function(err, dashs) {
        if (err) throw err
        t.deepEquals(dashs, [])
        t.end()
      })
    })
  })
})

test("DashboardManager#modify rename", function(t) {
  var db = new MockDB({foo: {id: "foo", graphs: {}}})
    , dm = new DashboardManager(db)
  dm.modify("foo", {id: "bar"}, function() {
    db.getDashboard("foo", function(err, dash) {
      if (err) throw err
      t.notOk(dash)
      db.getDashboard("bar", function(err, dash) {
        t.deepEquals(dash, {id: "bar", graphs: {}})
        t.end()
      })
    })
  })
})

test("DashboardManager#modify add graph", function(t) {
  var g1 = {a: "b"}
    , g2 = {c: "d"}
    , db = new MockDB({foo: {id: "foo", graphs: {1: g1}}})
    , dm = new DashboardManager(db)
  dm.modify("foo", {graphs: {2: g2}}, function() {
    db.getDashboard("foo", function(err, dash) {
      if (err) throw err
      t.deepEquals(dash, {id: "foo", graphs: {1: g1, 2: g2}})
      t.end()
    })
  })
})

test("DashboardManager#modify remove graph", function(t) {
  var g1 = {a: "b"}
    , g2 = {c: "d"}
    , db = new MockDB({foo: {id: "foo", graphs: {1: g1}}})
    , dm = new DashboardManager(db)
  dm.modify("foo", {graphs: {1: null}}, function() {
    db.getDashboard("foo", function(err, dash) {
      if (err) throw err
      t.deepEquals(dash, {id: "foo", graphs: {}})
      t.end()
    })
  })
})

function MockDB(db) {
  this.ops = []
  this.db  = db || {}
}

MockDB.prototype.getDashboard = function(id, callback) {
  var db = this.db
  this.ops.push(["getDashboard", id])
  process.nextTick(function() { callback(null, db[id]) })
}

MockDB.prototype.setDashboard = function(id, val, callback) {
  this.db[id] = val
  this.ops.push(["setDashboard", id, val])
  process.nextTick(callback)
}

MockDB.prototype.deleteDashboard = function(id, callback) {
  delete this.db[id]
  this.ops.push(["deleteDashboard", id])
  process.nextTick(callback)
}

MockDB.prototype.listDashboards = function(callback) {
  var db = this.db
  this.ops.push(["listDashboards"])
  process.nextTick(function() {
    callback(null, Object.keys(db))
  })
}
