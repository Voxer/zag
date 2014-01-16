var MenuTree = require('./menu-tree')
  , inherits = require('util').inherits
  , ID       = 0

module.exports = Menu

/// A simple MenuTree wrapper.
///
/// Item is either:
///   * {id and/or label[, href, disabled, onClick]}
///   * null
///
/// options -
///   * items  - [Item]
///   * anchor - DOM Element
///   * style  - String
///
function Menu(options) {
  var items = options.items
  this.onClicks = getOnClicks(items)
  MenuTree.call(this,
    { items:  items
    , style:  options.style
    , anchor: options.anchor
    })
}

inherits(Menu, MenuTree)

Menu.prototype.View({})
  .destroy(function() { this.onClicks = null })

Menu.prototype.spawn  = function() {}
Menu.prototype.select = function(id) {
  var onClick = this.onClicks[id]
  if (typeof onClick === "string") {
    this[onClick]()
  } else onClick()
}

function getOnClicks(items) {
  var events = {}
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    if (item && !item.id) item.id = "item_" + (++ID)
    if (item && item.onClick) {
      events[item.id] = item.onClick
    }
  }
  return events
}
