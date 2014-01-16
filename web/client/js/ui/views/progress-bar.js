var SkyView  = require('../view')
  , inherits = require('util').inherits

module.exports = ProgressBar

function ProgressBar() {
  SkyView.call(this)
  this.isVisible = false
}

inherits(ProgressBar, SkyView)

ProgressBar.prototype.View('<div class="progress-bar hidden"></div>')

// Set the width of the progress bar.
//
// fraction - Number [0, 1]
//
ProgressBar.prototype.setValue = function(fraction) {
  if (fraction === 0) return this.hide()
  this.show()
  this.setWidth(fraction)
  if (fraction === 1) setTimeout(this.hide.bind(this), 200)
}

// fraction - Number [0, 1]
ProgressBar.prototype.setWidth = function(fraction) {
  this.el.style.width = Math.round(fraction * 100) + "%"
}

// Back to zero.
ProgressBar.prototype.reset = function() { this.setWidth(0) }

///
/// Visibility
///

ProgressBar.prototype.show = function() { this.setVisible(true) }
ProgressBar.prototype.hide = function() {
  if (this.isVisible === false) return
  this.setVisible(false)
  setTimeout(this.reset.bind(this), 350)
}

ProgressBar.prototype.setVisible = function(isVisible) {
  if (this.isVisible == isVisible) return
  sail(this.el)[isVisible ? "removeClass" : "addClass"]("hidden")
  this.isVisible = isVisible
}
