var KeyTree = require('./key-tree')

module.exports = DBKeyTree

function noop() {}

// db - Backend
function DBKeyTree(db) {
  this.db        = db
  this.tree      = null
  this.isLoading = false

  // Preload the keylist
  this.reload()
}

// callback(err, keytree)
DBKeyTree.prototype.load = function(callback) {
  if (this.isLoading) return callback(new Error("Tree loading"))
  if (!this.tree) this.isLoading = true
  var _this = this
  this.db.getMetricsKeys(function(err, mkeys) {
    _this.isLoading = false
    if (err) return callback(err)
    callback(null, _this.tree = new KeyTree(mkeys.map(getKey), typeMap(mkeys)))
  })
}

function getKey(mkey) { return mkey.key }

function typeMap(mkeys) {
  var types = {}
  for (var i = 0, l = mkeys.length; i < l; i++) {
    var mkey = mkeys[i]
    types[mkey.key] = mkey.type
  }
  return types
}

DBKeyTree.prototype.reload = function() { this.load(noop) }

// List all metrics keys.
//
// callback(err, mtree)
//
DBKeyTree.prototype.listAll = function(callback) {
  if (this.tree) return callback(null, this.tree.listAll())
  this.load(function(err, tree) {
    callback(err, tree && tree.listAll())
  })
}

// List the key's children.
//
// mkey                 - String, or null for root.
// callback(err, mkeys) - Each `mkey` is an Object {key, hasChildren, type}.
//
DBKeyTree.prototype.listKey = function(mkey, callback) {
  mkey = mkey || KeyTree.ROOT
  if (this.tree) return callback(null, this.tree.mtree[mkey], mkey)
  this.load(function(err, tree) {
    callback(err, tree && tree.mtree[mkey], mkey)
  })
}

// List many keys' children.
//
// mkeys - [String]
// callback(err, {parent : mkeys})
//
DBKeyTree.prototype.listKeys = function(mkeys, callback) {
  var trees = {}
    , total = mkeys.length
    , error
  for (var i = 0; i < mkeys.length; i++) {
    this.listKey(mkeys[i], onLoadKey)
  }
  function onLoadKey(err, mkeys, parent) {
    if (err) error = err
    else     trees[parent] = mkeys
    if (--total === 0) return callback(error, trees)
  }
}

// Remove the key from the set.
//
// This does *not* remove the stored metrics of the key.
// Should the metrics-daemon add data for the key again, it will reappear.
//
// Deletes nested keys: i.e. deleting "one" also deletes "one|sub_one".
//
// mkey - String
// callback(err)
//
DBKeyTree.prototype.deleteKey = function(mkey, callback) {
  var tree = this.tree
    , db   = this.db
  if (this.tree) {
    onTree()
  } else {
    this.load(onTree)
  }

  function onTree(err) {
    if (err) return callback(err)
    var keys  = tree.remove(mkey)
      , index = 0

    next()
    function next() {
      var key = keys[index++]
      if (!key) return callback()
      db.deleteMetricsKey(key, done)
    }

    function done(err) {
      if (err) return callback(err)
      next()
    }
  }
}

// Filter the tree.
//
// query - String
// limit - Integer
// callback(err, mkeys)
//
DBKeyTree.prototype.filter = function(query, limit, callback) {
  if (this.tree) return callback(null, this.tree.filter(query, limit))
  this.load(function(err, tree) {
    callback(err, tree && tree.filter(query, limit))
  })
}
