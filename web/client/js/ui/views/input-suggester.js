var SkyView  = require('../view')
  , inherits = require('util').inherits
  , tInput   = require('../utils/text-input')

module.exports = InputSuggester

function noop() {}

///
/// options -
///   pattern - String pattern
///   input   - DOM Element, input
///   onHint(hint)
///   position - "top" or "bottom"
///
function InputSuggester(options) {
  SkyView.call(this)
  this.pattern   = options.pattern
  this.regex     = new RegExp(this.pattern)
  this.input     = options.input
  this.clone     = options.input.cloneNode()
  this.onHint    = options.onHint || noop
  this.position  = options.position || "bottom"
  this.isVisible = true

  this.offsetStart = null // Integer
  this.offsetEnd   = null // Integer

  var cloneStyle = this.clone.style
  cloneStyle.position   = "static"
  cloneStyle.height     = "0px"
  cloneStyle.width      = "0px"
  cloneStyle.visibility = "hidden"
  document.body.appendChild(this.clone)

  sail(this.input)
    .on("keydown", this.onKeyDown.bind(this))
    .on("focus",   this.onChange.bind(this))
    .on("click",   this.onChange.bind(this))
    .on("blur",    this.hide.bind(this))
}

inherits(InputSuggester, SkyView)

InputSuggester.prototype.View('<ul class="input-suggester"></ul>')
  .on({mousedown: "onClick"})
  .destroy(function() {
    sail.remove(this.clone)
    this.input = this.clone = this.onHint = null
  })

InputSuggester.prototype.render = function() {
  document.body.appendChild(this.el)
}

///
/// Events
///

InputSuggester.prototype.onClick = function(ev) {
  var target = ev.target
  if (target.tagName !== "LI") return
  ev.preventDefault()
  ev.stopPropagation()
  this.insert(target.dataset.item)
}

InputSuggester.prototype.onKeyDown = function() {
  setTimeout(this.onChange.bind(this), 0)
}

InputSuggester.prototype.onChange = function() {
  var text  = this.input.value
    , carat = this.input.selectionStart
    , hint  = this.seek(text, carat)
  if (hint) {
    this.onHint(hint)
  } else this.hide()
}


///
/// Updating
///

// Public: Set the items.
//
// items  - [String]
//
InputSuggester.prototype.setItems = function(items) {
  var html  = ''
    , regex = this.regex
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    html += '<li class="input-suggester-item" data-item="' + sail.escapeHTML(item) + '">'
          +   sail.escapeHTML(item.replace(regex, "$1"))
          + '</li>'
  }
  this.el.innerHTML = html
  this.show()
  this.setOffset(this.offsetStart)
}

// offset - Integer, characters
InputSuggester.prototype.setOffset = function(offset) {
  this.clone.value = this.input.value.slice(0, offset)

  var offset = sail.offset(this.input)
    , left   = offset.left + this.clone.scrollWidth
    , topMod = this.position === "top" ? -this.el.offsetHeight : this.input.offsetHeight
    , top    = offset.top + topMod
  this.el.style.left = left + "px"
  this.el.style.top  = top  + "px"
}

// text - String
InputSuggester.prototype.insert = function(text) {
  var value  = this.input.value
    , before = value.slice(0, this.offsetStart)
    , after  = value.slice(this.offsetEnd)
  this.input.value = before + text + after
  tInput.moveTo(this.input, before.length + text.length)
  this.hide()
}

// text  - String
// carat - Integer
InputSuggester.prototype.seek = function(text, carat) {
  var regex = new RegExp(this.pattern, "g")
    , match
  while (match = regex.exec(text)) {
    var matchLen    = match[0].length
      , offsetEnd   = regex.lastIndex
      , offsetStart = offsetEnd - matchLen
    if (offsetStart < carat && carat < offsetStart + matchLen) {
      this.offsetStart = offsetStart
      this.offsetEnd   = offsetEnd
      return match[1]
    }
  }
  return null
}

///
/// Visibility
///

// isVisible - Boolean
InputSuggester.prototype.setVisibile = function(isVisible) {
  if (this.isVisible === isVisible) return
  this.el.style.display
    = (this.isVisible = isVisible)
    ?  null
    : "none"
}

InputSuggester.prototype.show = function() { this.setVisibile(true) }
InputSuggester.prototype.hide = function() { this.setVisibile(false) }
