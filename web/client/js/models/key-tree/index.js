var DedupKeyAPI = require('./dedup-key-api')
  , parseMKey   = require('../../../../lib/mkey')
  , keyToPath   = parseMKey.toPath

module.exports = KeyTree

/// Lazy-load a tree of metrics keys.
///
/// api - APIClient
///
function KeyTree(api) {
  // { key : KeyLeaf }
  this.root = null
  this.api  = new DedupKeyAPI(api)
}

// mkey - String, or null for root.
// callback(fail, keyLeafs)
KeyTree.prototype.load = function(mkey, callback) {
  var _this = this
  if (!mkey) {
    return this.api.getRootKeys(function(fail, keys) {
      if (fail) return callback(fail)
      _this.root = _this.loadLeafs(keys)
      callback(null, values(_this.root))
    })
  }

  var path  = keyToPath(mkey)
    , leafs = this.root
    , missing
  for (var i = 0, l = path.length; i < l; i++) {
    leafs = leafs[path[i]].children
    if (!leafs) {
      missing = path.slice(i)
      break
    }
  }

  // I know that you think this should be fired on nextTick, but it shouldn't.
  // Since its on the same tick, the Tree widget can expand a bunch of
  // preloaded layers synchronously as it initializes the selection on load.
  if (!missing) return callback(null, values(leafs))

  this.api.getChildKeys(missing, function(fail, leafSets) {
    if (fail) return callback(fail)
    var leafRoots = Object.keys(leafSets).sort(byLength)
      , leafName, last
    for (var i = 0; i < leafRoots.length; i++) {
      leafName = leafRoots[i]
      last = _this.find(leafName).children = _this.loadLeafs(leafSets[leafName])
    }
    callback(null, values(last))
  })
}

function byLength(a, b) { return a.length - b.length }

//
// leafs - [{key, hasChildren}]
//
// Returns {key: KeyLeaf}
KeyTree.prototype.loadLeafs = function(leafs) {
  var children = {}
  for (var i = 0, l = leafs.length; i < l; i++) {
    var leaf = leafs[i]
      , key  = leaf.key
    children[key] = new KeyLeaf(key, leaf.hasChildren, leaf.type)
  }
  return children
}

// Get a key object given a key, assuming the key is already loaded.
//
// mkey - String
//
// Returns Object or undefined.
KeyTree.prototype.find = function(mkey) {
  var path  = keyToPath(mkey)
    , leafs = this.root
    , leaf
  for (var i = 0, l = path.length; i < l; i++) {
    if (!leafs) return
    leaf  = leafs[path[i]]
    leafs = leaf.children
  }
  return leaf
}

// mkey - String
// callback(err, leaf)
KeyTree.prototype.loadOne = function(mkey, callback) {
  var leaf = this.find(mkey)
  if (leaf) return setTimeout(function() { callback(null, leaf) }, 0)

  var parent = parseMKey.parent(mkey)
  if (parent) {
    this.api.getChildKeys([parent], function(fail, leafs) {
      if (fail) return callback(fail)
      done(leafs[parent])
    })
  } else {
    this.api.getRootKeys(function(fail, leafs) {
      if (fail) return callback(fail)
      done(leafs)
    })
  }

  function done(siblings) {
    // this could be a binary search, since the keys are sorted
    for (var i = 0; i < siblings.length; i++) {
      var leaf = siblings[i]
      if (leaf.key === mkey) return callback(null, leaf)
    }
  }
}

KeyTree.prototype.keyToPath  = keyToPath
KeyTree.prototype.keyToParts = parseMKey.toParts

////////////////////////////////////////////////////////////////////////////////
// Filtering
////////////////////////////////////////////////////////////////////////////////
// text - String to filter on.
// callback(fail, [{key, hasChildren}])
KeyTree.prototype.filter = function(text, callback) {
  this.api.filterKeys(text, 100, callback)
}


function values(obj) {
  var keys = Object.keys(obj)
    , vals = new Array(keys.length)
  for (var i = 0, l = keys.length; i < l; i++) {
    vals[i] = obj[keys[i]]
  }
  return vals
}

function KeyLeaf(key, hasChildren, type) {
  this.key         = key
  this.hasChildren = hasChildren
  this.type        = type
  this.children    = null
}
