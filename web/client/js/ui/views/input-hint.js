var SkyView  = require('skyview')
  , inherits = require('util').inherits

module.exports = InputHint

/// Display some extra information about a text input when the '?' symbol is
/// moused over.
///
/// options -
///   * input - DOM Element. Not the input element itself, just the wrapper.
///   * hint  - String, HTML.
///
function InputHint(options) {
  this.inputEl = options.input

  var style = this.inputEl.style
  if (!style.position) style.position = "relative"

  SkyView.call(this, { hint: options.hint })
}

inherits(InputHint, SkyView)

InputHint.prototype.View
  ( '<div class="input-hint-trigger">'
  +   '<span class="input-hint-label">?</span>'
  +   '<div:hintEl class="wizard wizard-bottom input-hint" style="display:none;">{hint}</div>'
  + '</div>' )
  .on(
  { "mouseover": "onMouseOver"
  , "mouseout":  "onMouseOut"
  }).destroy(function() { this.inputEl = null })

InputHint.prototype.render = function() {
  this.inputEl.appendChild(this.el)
}

InputHint.prototype.setVisible = function(visible) {
  this.hintEl.style.display = visible ? "block" : "none"
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

InputHint.prototype.onMouseOver = function() { this.setVisible(true) }
InputHint.prototype.onMouseOut  = function() { this.setVisible(false) }
