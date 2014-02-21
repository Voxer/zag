var SkyView  = require('skyview')
  , inherits = require('util').inherits
  , dialogs  = []

module.exports = Dialog

/// Generic dialog.
///
/// options -
///   * title - String
///   * body  - String
///
function Dialog(opts) {
  dialogs.push(this)
  SkyView.call(this, opts)
}

inherits(Dialog, SkyView)

// Close a dialog.
Dialog.pop = function() {
  var last = dialogs[dialogs.length - 1]
  if (last) last.destroy()
}

Dialog.prototype.View
  ( '<div class="dialog">'
  +   '<div class="dialog-header">'
  +     '<h1 class="dialog-header-text">{title}</h1>'
  +     '<button class="dialog-close" title="Cancel">&times;</button>'
  +   '</div>'
  +   '{body}'
  + '</div>'
  ).on({".dialog-close click": "destroy"})
  .destroy(function() {
    dialogs.splice(dialogs.indexOf(this), 1)
  })


Dialog.prototype.render = function() {
  document.body.appendChild(this.el)
}
