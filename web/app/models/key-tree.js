var parseKey = require('../../lib/mkey')
  , llq      = /@llq$/
  , ROOT     = " "

module.exports = KeyTree

///
/// A tree of metrics keys.
/// LLQuantize (@llq) data will not be included in the tree.
///
/// mkeys - [String]
/// types - {String key : String type}
///
function KeyTree(mkeys, types) {
  // { String mkey : [MetricsKey child] }
  this.mtree = {}
  // Integer number of keys, including the ROOT.
  this.size  = 0
  this.populate(mkeys, types)
}

KeyTree.ROOT = ROOT
KeyTree.findKey = findKeyIndex

// Insert many keys into the tree.
//
// mkeys - [String]
// types - {String key : String type}
//
KeyTree.prototype.populate = function(mkeys, types) {
  // The sort starts from the bottom of the tree, to ensure `hasChildren`
  // is accurate.
  mkeys = this.expandKeys(mkeys).sort(reverseLength)
  var size  = this.size = mkeys.length
    , mtree = this.mtree
  for (var i = 0; i < size; i++) {
    var mkey = mkeys[i]
    if (mkey === ROOT) continue
    var parent = parseKey.parent(mkey) || ROOT
    mtree[parent].push(new MetricsKey(mkey, mtree[mkey].length > 0, types[mkey]))
  }
  for (var i = 0; i < size; i++) {
    var children = this.mtree[mkeys[i]]
    if (children) children.sort(lexicalKey)
  }
}

function reverseLength(a, b) { return b.length - a.length }

function lexicalKey(a, b) {
  var ak = a.key
    , bk = b.key
  return ak < bk ? -1
       : ak > bk ?  1
       : 0
}

// The initial mkey list may not include all pseudokeys ("foo>bar"), so this
// recreates the list to include all possible keys.
//
// mkeys - [String]
//
// Returns [String]
KeyTree.prototype.expandKeys = function(mkeys) {
  var mtree = this.mtree
    , path, pathLen, mkey
  for (var i = 0, l = mkeys.length; i < l; i++) {
    mkey    = mkeys[i]
    if (llq.test(mkey)) continue
    path    = parseKey.toPath(mkey)
    pathLen = path.length
    for (var j = 0; j < pathLen; j++) {
      mkey = path[j]
      if (!mtree[mkey]) mtree[mkey] = []
    }
  }
  mtree[ROOT] = []
  return Object.keys(mtree)
}

// Insert a key into the tree.
//
// mkey - String
//
// TODO postgres incremental mkey updates
KeyTree.prototype.insert = function(mkey) { }

// Remove a subtree from the tree.
// Returns the list of keys that were removed.
//
// mkey - String
//
// Returns [String].
KeyTree.prototype.remove = function(mkey) {
  var results  = [mkey]
    , parent   = parseKey.parent(mkey) || ROOT
    , mtree    = this.mtree
    , siblings = mtree[parent]

  // Nonexistant parent, ergo nonexistant key.
  if (!siblings) return []
  // Remove the only child from the parent.
  if (siblings.length === 1) {
    if (siblings[0].key === mkey) {
      siblings.pop()
      if (parent !== ROOT) {
        this.find(parent).hasChildren = false
      }
    // otherwise, the key removed doesn't exist.
    } else return []
  // Remove the child from its siblings.
  } else {
    var index = findKeyIndex(siblings, mkey)
    // Nonexistant key.
    if (index === -1) return []
    siblings.splice(index, 1)
  }

  // Recurse down.
  this.removeChildren(mkey, results)
  this.size -= results.length
  return results
}

// Internal: delete the `parent`'s children.
//
// parent  - String metrics key.
// results - [String], deleted keys will be pushed.
//
KeyTree.prototype.removeChildren = function(parent, results) {
  var mtree    = this.mtree
    , children = mtree[parent]
  for (var i = 0, l = children.length; i < l; i++) {
    var key = children[i].key
    results.push(key)
    this.removeChildren(key, results)
  }
  mtree[parent] = null
}

// Internal: Find the MetricsKey that corresponds the the mkey.
//
// mkey - String
//
// Returns MetricsKey
KeyTree.prototype.find = function(mkey) {
  var sibs = this.mtree[parseKey.parent(mkey) || ROOT]
  return sibs[findKeyIndex(sibs, mkey)]
}

// Public: List all unique keys.
KeyTree.prototype.listAll = function() {
  var keys = Object.keys(this.mtree).sort()
    , root = keys.indexOf(ROOT)
  if (root > -1) keys.splice(root, 1)
  return keys
}

// Filter the tree.
//
// query - String
// limit - Integer
// callback(err, mkeys)
//
// Returns [MetricsKey]
KeyTree.prototype.filter = function(query, limit) {
  return this.filterTree(parseKey.toParts(query.toLowerCase()), 0, 0, this.mtree[ROOT], [], limit)
}

// Internal: Filter the tree recursively.
//
// filterParts  - [String]
// filterOffset - Integer offset into `filterParts`
// matchOffset  - Integer offset into the key
// leafs        - [MetricsKey]
// results      - [{key, hasChildren, type}]
// limit        - Integer, the maximum number of results.
//
// Returns [MetricsKey]
KeyTree.prototype.filterTree = function(filterParts, filterOffset, matchOffset, leafs, results, limit) {
  var filterPart = filterParts[filterOffset]
    , partCount  = filterParts.length
    , mtree      = this.mtree
    , isLastPart = filterOffset === partCount - 1

  for (var i = 0, l = leafs.length; i < l; i++) {
    var leaf = leafs[i]
      , key  = leaf.key
      , hasC = leaf.hasChildren
    if ((!isLastPart && !hasC)
     || key.toLowerCase().indexOf(filterPart, matchOffset) === -1) {
      continue
    }
    // Match!
    if (isLastPart) {
      results.push(leaf)
    // Match, but recurse.
    } else if (hasC) {
      this.filterTree(filterParts, filterOffset + 1, key.length, mtree[key], results, limit)
    }
    // Limit reached, so exit.
    if (results.length >= limit) break
  }
  return results
}

// Internal: Find the index of `mkey` in it's siblings. If the key doesn't exist, -1
// will be returned instead.
//
// sibs - [MetricsKey]
// mkey - String
//
// Returns Integer index, or -1 if not found.
function findKeyIndex(sibs, mkey) {
  var min = 0
    , max = sibs.length - 1
  while (min <= max) {
    var mid    = Math.floor((min + max) / 2)
      , sib    = sibs[mid]
      , sibKey = sib.key
    if      (sibKey < mkey) min = mid + 1
    else if (sibKey > mkey) max = mid - 1
    else    return mid
  }
  return -1
}

// key         - String
// hasChildren - Boolean
// type        - String, optional
function MetricsKey(key, hasChildren, type) {
  this.key         = key
  this.hasChildren = hasChildren
  this.type        = type || "none"
}
