module.exports = MockAPI

function MockAPI(db) {
  this.db = db || {}
}

MockAPI.prototype.getRootKeys = function(callback) {
  var db = this.db
  process.nextTick(function() { callback(null, db[""] || []) })
}

MockAPI.prototype.getChildKeys = function(mkeys, callback) {
  var leafsByParent = {}
  for (var i = 0; i < mkeys.length; i++) {
    var mkey = mkeys[i]
    leafsByParent[mkey] = this.db[mkey] || []
  }
  process.nextTick(function() { callback(null, leafsByParent) })
}

MockAPI.prototype.filterKeys = function(query, limit, callback) {
}
