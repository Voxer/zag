var SkyView  = require('skyview')
  , inherits = require('util').inherits
  , gravity  = require('../utils/gravity')
  , hasBodyListener, currentMenu

function never(x) { return false }
 
function bindBodyListener(menu) {
  if (!currentMenu) currentMenu = menu
  if (hasBodyListener) return
  hasBodyListener = true
  sail(document.body).on("mousedown", function(ev) {
    if (currentMenu) currentMenu.destroy()
    currentMenu = null
  })
}

module.exports = Menu

/// A traditional toolbar-style tree menu.
///
/// Item is either:
///   * {id[, label, hasChildren, href, disabled]}
///   * {header}
///   * null
///
/// opts -
///   * items   - [Item]
///   * anchor  - DOM Element
///
/// Internal:
///   * gravity - String "l", "r"
///   * style   - String, CSS for positioning.
///   * isSub   - Boolean
///
function Menu(opts) {
  this.subMenu = null // Menu
  this.anchor  = opts.anchor
  this.gravity = opts.gravity // String
  this.isSub   = opts.isSub

  SkyView.call(this,
    { body:  this.innerHTML(opts.items)
    , style: (opts.style || "").replace(/"/g, "&quot;")
    })

  var _this = this
  setTimeout(function() { bindBodyListener(_this) }, 0)
}

inherits(Menu, SkyView)

Menu.prototype.View
  ( '<ul class="menu-tree" style="{style}">'
  +   '{body}'
  + '</ul>'
  ).on(
  { ".menu-leaf-label click":     "onClick"
  , ".menu-leaf-label mouseover": "onMouseOver"
  , ".menu-leaf-label mouseexit": "destroySubMenu"
  , "mousedown":                   stopPropagation
  }).destroy(function() {
    this.destroySubMenu()
    this.anchor = null
    if (currentMenu === this) currentMenu = null
  })

Menu.prototype.render = function() {
  document.body.appendChild(this.el)
  if (!this.anchor) return

  var pos = gravity(this.el, this.anchor, {gravity: this.gravity})
  // submenu
  if (this.isSub) {
    if (!pos.isLeft) pos.left -= sail.width(this.anchor)
    pos.top -= sail.height(this.anchor)
  }

  this.el.style.left = pos.left + "px"
  this.el.style.top  = pos.top  + "px"
  this.gravity       = pos.gravity
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

Menu.prototype.onClick = function(ev) {
  var labelEl = ev.target
  if (isDisabled(labelEl)) return
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return
  ev.preventDefault()
  if (this.select(this.getID(labelEl)) !== false && currentMenu) {
    currentMenu.destroy()
  }
}

Menu.prototype.onMouseOver = function(ev) {
  this.destroySubMenu()
  if (!ev.target.querySelector(".menu-parent")) return
  this.subMenu = this.spawn(this.getID(ev.target),
    { anchor:  ev.target.parentElement
    , gravity: this.gravity
    , isSub:   true
    })
}

////////////////////////////////////////////////////////////////////////////////
// Rendering
////////////////////////////////////////////////////////////////////////////////

// Returns String HTML
Menu.prototype.innerHTML = function(items) {
  var html = ''
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    if (item === null) {
      html += '<li class="menu-div"></li>'
    } else if (item.header) {
      html += '<li class="menu-header">' + sail.escapeHTML(item.header) + '</li>'
    } else {
      html += itemToHTML(item)
    }
  }
  return html
}

Menu.prototype.destroySubMenu = function() {
  if (this.subMenu) {
    this.subMenu.destroy()
    this.subMenu = null
  }
}

// leafEl - DOM Element .menu-leaf-label
// Returns Item
Menu.prototype.getID = function(leafEl) { return leafEl.parentElement.dataset.id }

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// item        - {id[, label, hasChildren, href, disabled]}
// Returns String HTML
function itemToHTML(item) {
  var label    = item.label || item.id
    , extra    = item.hasChildren ? '<span class="menu-parent">&#9654;</span>' : ''
    , disabled = item.disabled ? " disabled" : ""
    , href     = item.href
    , inner    = sail.escapeHTML(label) + extra
  return '<li class="menu-leaf" data-id="' + item.id + '">'
       + ((href && !disabled)
         ? '<a class="menu-leaf-label" href="' + href + '">' + inner + '</a>'
         : '<div class="menu-leaf-label' + disabled + '">' + inner + '</div>' )
       + '</li>'
}

function stopPropagation(ev) { ev.stopPropagation() }

function isDisabled(labelEl) {
  return labelEl.className.indexOf("disabled") > -1
}
