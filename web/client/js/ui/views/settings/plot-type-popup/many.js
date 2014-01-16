var inherits       = require('util').inherits
  , SettingsPopup  = require('../settings-popup')
  , subkeyToLabel  = SettingsPopup.subkeyToLabel
  , itemsHTML      = SettingsPopup.itemsHTML

var SUBKEYS =
  [ "count", "mean"
  , "p10"
  , "median"
  , "p75", "p95", "p99"
  , "max"
  , "std_dev"
  , "llquantize"
  ]

var RENDERERS = ["line", "stack"]

module.exports = ManyPicker

/// options -
///   controller, emit, onHide
function ManyPicker(opts) {
  this.setup(opts)
  opts.subkeys = itemsHTML(SUBKEYS,
    { current: this.settings.subkey
    , labels:  SUBKEYS.map(subkeyToLabel)
    })
  opts.renderers = itemsHTML(RENDERERS, {current: this.settings.renderer})
  SettingsPopup.call(this, opts)
}

inherits(ManyPicker, SettingsPopup)

ManyPicker.prototype.View(
  { type: "plottype-many"
  , body
    : '<label class="setting-label">Subkey</label>'
    + '<select:subkeyEl class="setting-select plottype-select-subkey">{subkeys}</select>'
    + '<br/>'
    + '<label class="setting-label">Renderer</label>'
    + '<select:rendererEl class="setting-select plottype-select-renderer">{renderers}</select>'
  }).on(
  { ".plottype-select-subkey   change": "onChangeSubkey"
  , ".plottype-select-renderer change": "onChangeRenderer"
  })

///
/// Events
///

ManyPicker.prototype.onChangeSubkey = function() {
  this.emit("subkey", this.subkeyEl.value)
}

ManyPicker.prototype.onChangeRenderer = function() {
  this.emit("renderer", this.rendererEl.value)
}
