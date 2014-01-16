module.exports = ImplicitTree

/// An ImplicitTree takes a flat list of items and converts them to a
/// tree structure.
///
/// If an item exists with the ID "foo>bar", the item "foo" may or may not exist.
///
/// Ordering may be modified to ensure sorted order.
///
/// Vocabulary
///   * item - String that was either passed on intialization or
///     inserted explicity layer. An item is "real".
///   * id - Either an item, or an item's implicit parent.
///     And ID may or may not be "real".
///
/// items     - [String]
/// separator - Character
///
function ImplicitTree(items, separator) {
  this.separator = separator

  // The IDs listed here may or may not correspond to actual items.
  // { parent or "" : [String id] }
  this.tree = {}
  // The IDs key-ing this correspond to actual items.
  // { id : true }
  this.real = {}

  items.sort()
  for (var i = 0; i < items.length; i++) { this.insert(items[i]) }
}

var TOP = ImplicitTree.TOP = ""

// Get the ID's parent ID.
//
// id - String
//
// Returns String
ImplicitTree.prototype.parent = function(id) {
  var sep = this.separator
  return id.split(sep).slice(0, -1).join(sep)
}

////////////////////////////////////////////////////////////////////////////////
// Traversal
////////////////////////////////////////////////////////////////////////////////

// Get the top-level IDs.
//
// Returns [String] list of IDs.
ImplicitTree.prototype.top = function() { return this.list(TOP) }

// Get a list of child IDs.
//
// parent - String ID
//
// Returns [String] list of IDs.
ImplicitTree.prototype.list = function(parent) { return this.tree[parent] || [] }

// Get whether or not the ID is an item.
//
// id - String ID.
//
// Returns Boolean
ImplicitTree.prototype.isReal = function(id) { return !!this.real[id] }

// Get whether or not the ID has children.
//
// id - String ID.
//
// Returns Boolean
ImplicitTree.prototype.hasChildren = function(id) { return !!this.tree[id] }

// Insert the item into the tree.
//
// item - String
//
ImplicitTree.prototype.insert = function(item) {
  this.real[item] = true

  var sep   = this.separator
    , parts = item.split(sep)
  for (var i = 0; i < parts.length; i++) {
    var parent   = i === 0 ? TOP : parts.slice(0, i).join(sep)
      , child    = parent + (parent ? sep : "") + parts[i]
      , children = this.tree[parent]

    if (!children) this.tree[parent] = children = []
    if (children.indexOf(child) === -1) {
      children.push(child)
    }
  }
}

// Remove the item from the tree.
//
// id - String
//
ImplicitTree.prototype.remove = function(id) {
  var real = this.real
  if (real[id]) {
    real[id] = false
    this.removeFromTree(id)
  }
}

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// Remove from `this.tree` recursively (up).
//
// id - String
//
ImplicitTree.prototype.removeFromTree = function(id) {
  var tree = this.tree
  // Can't remove from the tree if it still has children.
  if (tree[id]) return

  var parent = this.parent(id)
    , sibs   = tree[parent]
    , index  = sibs.indexOf(id)

  // Remove from the branch.
  sibs.splice(index, 1)

  // Delete up.
  if (sibs.length === 0) {
    delete tree[parent]
    if (parent && !this.isReal(parent)) {
      this.removeFromTree(parent)
    }
  }
}
