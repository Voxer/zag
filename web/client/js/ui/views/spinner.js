var SkyView  = require('skyview')
  , inherits = require('util').inherits

module.exports = Spinner

/// Construct a custom spinner Element.
///
/// When done loading, just remove the returned element.
/// The spinner is HTML and CSS, using keyframes animation.
///
/// <http://dabblet.com/gist/6660930>
///
/// options -
///   height - Integer, pixels
///
function Spinner(container, options) {
  this.container = container
  this.spin      = 0

  var html = ""
  for (var i = 1; i < 5; i++) {
    html += '<div class="loader-bar lb' + i + '"></div>'
  }
  SkyView.call(this,
    { body:   html
    , height: (options && options.height) || 100
    , width:  (options && options.width)  || 80
    })
}

inherits(Spinner, SkyView)

Spinner.prototype.View('<div class="loader" style="height:{height}px;width:{width}px;">{body}</div>')
  .destroy(function() { this.container = null })

Spinner.prototype.render = function() {
  if (this.spin) this.container.appendChild(this.el)
}

Spinner.prototype.more = function() {
  var spin = ++this.spin
  if (spin === 1) this.render()
}

Spinner.prototype.less = function() {
  var spin = --this.spin
  if (spin === 0) this.remove()
}
