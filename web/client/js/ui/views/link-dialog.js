var Dialog   = require('./dialog')
  , inherits = require('util').inherits

module.exports = LinkDialog

/// A dialog with a single text input. The value of the input is automatically
/// selected to make copy-pasting the link elsewhere easy.
///
/// options -
///   * title - String
///   * link  - String URL
///
function LinkDialog(options) {
  Dialog.call(this, options)
  this.select()
}

inherits(LinkDialog, Dialog)

LinkDialog.prototype.View(
  { body: '<input:input class="link-dialog-input" type="text" value="{link}" readonly/>'
  }).on({"input click": "select"})

LinkDialog.prototype.select = function() { this.input.select() }
