var SettingsPopup  = require('./settings-popup')
  , SkyView        = require('../../view')
  , inherits       = require('util').inherits
  , InputSuggester = require('../input-suggester')
  , isFn           = require('../../../../../lib/mkey').isFunction
  , keymap         = require('browser-keymap')
  , tInput         = require('../../utils/text-input')
  , form

module.exports = FunctionPopup

function FunctionPopup(opts) {
  SettingsPopup.call(this, opts)
  this.items       = [] // [FunctionItem]
  this.filterCache = {} // { query : [String mkeys] }

  var mode = this.controller.modeToString()
  if (mode === "dashboard") {
    return setTimeout(this.destroy.bind(this), 0)
  }
  var mkeys = this.controller.modeInfo()
  for (var i = 0; i < mkeys.length; i++) {
    this.pushFunction(mkeys[i])
  }
  this.pushFunction("")
}

inherits(FunctionPopup, SettingsPopup)

FunctionPopup.prototype.View(
  { type: "function"
  , body
    : '<ul:listEl class="function-list">'
    + '</ul>'
  }).destroy(function() {
    var items = this.items
    for (var i = 0; i < items.length; i++) items[i].destroy()
    this.items = this.filterCache = null
  })

// fn - String
FunctionPopup.prototype.pushFunction = function(fn) {
  var item = new FunctionItem(this, fn)
  this.items.push(item)
  if (fn === "") item.input.focus()
}


// query - String
// callback(fail, keys)
FunctionPopup.prototype.filter = function(query, callback) {
  var cache = this.filterCache
    , keys  = cache[query]
  if (keys) return callback(null, keys)
  this.controller.tree.filter(query, function(fail, mkeys) {
    if (fail) return callback(fail)
    callback(fail, cache[query] = mkeys.map(pluckKey))
  })
}

// mkey - {key, hasChildren}
function pluckKey(mkey) { return brace(mkey.key) }


////////////////////////////////////////////////////////////////////////////////

/// popup - FunctionPopup
/// mkey  - String "{function}" or "mkey"
function FunctionItem(popup, mkey) {
  this.popup      = popup
  this.controller = popup.controller
  this.lastKey    = null // String
  this.isNew      = mkey === ""
  this.mkey       = mkey
  SkyView.call(this,
    { fn: sail.escapeHTML(
          isFn(mkey)
        ? unbrace(mkey)
        : (mkey && brace(mkey)))
    })
  this.suggester = new InputSuggester(
    { pattern: "{([^{}]*)}"
    , input:    this.input
    , onHint:   this.onHint.bind(this)
    })
}

inherits(FunctionItem, SkyView)

FunctionItem.prototype.View
  ( '<li class="function-list-item">'
  +   '<input:input type="text" class="function-list-input" value="{fn}"/>'
  +   '<button class="function-list-remove">unplot</button>'
  + '</li>' )
  .on(
  { "input keydown": "onKeyDown"
  , "button click":  "unplot"
  })
  .destroy(function() {
    this.suggester.destroy()
    this.popup = this.controller = this.suggester = null
  })

FunctionItem.prototype.render = function() {
  this.popup.listEl.appendChild(this.el)
}

FunctionItem.prototype.onKeyDown = function(ev) {
  var key = this.lastKey = keymap(ev)
  if (key === "escape") return this.input.blur()
  if (key === "\n")     return this.plot()
  if (key === "\t")     return this.focusNext(ev)
  if (key === "S-\t")   return this.focusPrev(ev)
  if (key === "}" && tInput.nextChar(this.input) === "}") {
    ev.preventDefault()
    tInput.moveRight(this.input)
  }
  setTimeout(this.autocomplete.bind(this), 0)
}

FunctionItem.prototype.plot = function() {
  var oldFn = this.mkey
    , newFn = this.mkey = this.toMKey()
  if (oldFn === newFn || !newFn) return

  // Add before remove to ensure its LAYOUT_MANY.
  this.controller.graphAdd(newFn)
  if (this.isNew) {
    this.popup.pushFunction("")
    this.isNew = false
  } else {
    this.controller.graphRemove(oldFn)
  }
}

var rePlain = /^{([^{}]+)}$/

// Returns String
FunctionItem.prototype.toMKey = function() {
  var val = this.input.value
  return rePlain.test(val) ? unbrace(val) : (val && brace(val))
}

FunctionItem.prototype.unplot = function() {
  if (this.mkey) {
    this.controller.graphRemove(this.mkey)
    this.destroy()
  }
}

FunctionItem.prototype.focusNext = makeFocus("next")
FunctionItem.prototype.focusPrev = makeFocus("previous")

function makeFocus(fn) {
  return function(ev) {
    var next = sail[fn](this.el)
    if (next) next.querySelector("input").focus()
    ev.preventDefault()
  }
}

////////////////////////////////////////////////////////////////////////////////
// Autocomplete
////////////////////////////////////////////////////////////////////////////////

// Display suggestions of metrics keys to auto-complete.
FunctionItem.prototype.autocomplete = function() {
  if (this.lastKey === "{") {
    tInput.insert(this.input, "}")
    this.lastKey = null
  }
}

// hint - String
FunctionItem.prototype.onHint = function(hint) {
  var _this = this
  this.popup.filter(hint, function(fail, mkeys) {
    if (fail) return console.error("KeyTree#filter error", fail)
    _this.suggester.setItems(mkeys)
  })
}

function unbrace(fn) { return fn.slice(1, -1) }
function brace(expr) { return "{" + expr + "}" }
