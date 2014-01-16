var TreeView = require('./utils/tree')
  , isFn     = require('../../../lib/mkey').isFunction

module.exports = MetricsTreeView

///
/// Wrap the Tree API, but ignore mkey `{functions}`, since the tree doesn't
/// include them.
///
function MetricsTreeView(el, opts) {
  this.tree = new TreeView(el, opts)
}

MetricsTreeView.prototype.on = function(ev, fn) {
  return this.tree.on(ev, fn)
}

MetricsTreeView.prototype.deselectAll = function() {
  return this.tree.deselectAll()
}

MetricsTreeView.prototype.selectOne = function(leaf) {
  return isFn(leaf) ? this.deselectAll() : this.tree.selectOne(leaf)
}

MetricsTreeView.prototype.selectAdd = function(leaf) {
  return isFn(leaf) || this.tree.selectAdd(leaf)
}

MetricsTreeView.prototype.selectRemove = function(leaf) {
  return isFn(leaf) || this.tree.selectRemove(leaf)
}

MetricsTreeView.prototype.selectMany = function(leafs) {
  var leafs = leafs.filter(isntFn)
  return leafs.length ? this.tree.selectMany(leafs) : this.deselectAll()
}

function isntFn(mkey) { return !isFn(mkey) }
