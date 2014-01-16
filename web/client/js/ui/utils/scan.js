module.exports = TreeScanner

/// Scan up and down a tree.
///
/// fns - {parent, children, prev, next}
///
function TreeScanner(fns) {
  this.getParent   = fns.parent
  this.getChildren = fns.children
  this.getPrev     = fns.prev
  this.getNext     = fns.next
}

TreeScanner.prototype.next = function(el) {
  var children = this.getChildren(el)

  // Children
  if (children && children.length) return children[0]

  // Sibling
  var next = this.getNext(el)
  if (next) return next

  // Uncle
  var uncle
  do {
    if (!(el  = this.getParent(el)))    return
    if (uncle = this.getNext(el)) return uncle
  } while (el)
}

TreeScanner.prototype.prev = function(el) {
  var prev = this.getPrev(el)
  // Parent
  if (!prev) return this.getParent(el)

  // (Grand-)*nephew
  var lastChild = this._getLastChild(prev)
  if (lastChild !== prev) return lastChild

  // Prev
  return prev
}

TreeScanner.prototype._getLastChild = function(el) {
  var children = this.getChildren(el)
  if (!children) return el

  var lastChild = children[children.length - 1]
  return lastChild ? this._getLastChild(lastChild) : leafEl
}
