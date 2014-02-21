var SkyView  = require('skyview')
  , inherits = require('util').inherits

module.exports = SettingsPopup

///
/// options -
///   * type  - String
///   * body  - String
///
///   * controller - MetricKeyTree
///   * emit       - Function
///   * onHide     - Function
///   * button     - DOM Element
///
function SettingsPopup(opts) {
  if (!this.onHide) this.setup(opts)
  SkyView.call(this, opts)
}

inherits(SettingsPopup, SkyView)

SettingsPopup.makeGraphLink = makeGraphLink
SettingsPopup.itemsHTML     = itemsHTML
SettingsPopup.subkeyToLabel = subkeyToLabel

SettingsPopup.prototype.View
  ('<div class="setting-popup {type}-popup" style="{style}">{body}</div>')
  .on({ mousedown: function(ev) { ev.stopPropagation() } })
  .destroy(function() {
    this.onHide()
    this.controller = this.settings = this.emit = this.onHide = this.button = null
  })

SettingsPopup.prototype.render = function() {
  document.body.appendChild(this.el)
}

SettingsPopup.prototype.setup = function(opts) {
  this.controller = opts.controller
  this.settings   = opts.controller.settings
  this.emit       = opts.emit
  this.onHide     = opts.onHide
  this.button     = opts.button
}


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

//
// override - Object query arg overrides.
//            If a value is null the key will be deleted.
//
// Return String URL.
function makeGraphLink(override) {
  var loc  = document.location
    , qs   = sail.parseQuery(loc.search)
    , keys = Object.keys(override)

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
      , val = override[key]
    if (val === null) {
      delete qs[key]
    } else {
      qs[key] = val
    }
  }

  return loc.pathname + "?" + sail.toQueryString(qs)
}

// Build a list of `<option>`.
//
// items   - [String]
// options -
//   * current - String
//   * labels  - [String]. If not given, the items will be used instead.
//
// Returns String HTML.
function itemsHTML(items, options) {
  var optionsHTML = ""
    , current     = options.current
    , labels      = options.labels    || items
    , item, selected
  for (var i = 0, l = items.length; i < l; i++) {
    item     = items[i]
    selected = current === item ? "selected" : ""
    optionsHTML += '<option value="' + item + '" ' + selected + '>'
                 +   labels[i]
                 + '</option>'
  }
  return optionsHTML
}

function subkeyToLabel(subkey) {
  return subkey === "llquantize" ? "heat map" : subkey
}
