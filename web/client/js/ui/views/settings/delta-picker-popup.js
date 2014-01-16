var SettingsPopup = require('./settings-popup')
  , inherits      = require('util').inherits
  , UNITS         = require('../../../../../lib/date-utils').UNITS
  , keymap        = require('../../utils/keymap')
  , reDelta       = /^[0-9]+([smhdwMy]?)$/

var DELTAS =
  [ "auto"
  , "1m", "5m"
  , "1h", "1d"
  , "other"
  ]

module.exports = DeltaPicker

/// Pick the delta (downsampling interval) of the graphs.
/// If it is set to "auto" the 'best' value will be determined automatically,
/// but a specific value can be set instead, for more granular control.
///
/// options -
///   controller, emit, onHide
///
function DeltaPicker(opts) {
  this.setup(opts)
  this.isCustomVisible = false

  var deltaReal = this.settings.deltaReal
    , isOther   = DELTAS.indexOf(deltaReal) === -1
  opts.items    = itemsHTML(isOther ? "other" : deltaReal)
  SettingsPopup.call(this, opts)

  if (isOther) this.showCustom()
}

inherits(DeltaPicker, SettingsPopup)

DeltaPicker.prototype.View(
  { type: "delta"
  , body
    : '<label class="setting-label">Delta</label>'
    + '<div class="delta-picker">'
    +   '<select:selectEl class="setting-select">{items}</select>'
    +   '<input:customEl type="text" class="delta-custom" style="display:none;"/>'
    + '</div>'
  }).on(
  { "select change":  "onChange"
  , "input  keydown": "onKeyDown"
  })

function itemsHTML(current) {
  return SettingsPopup.itemsHTML(DELTAS,
    { current: current
    , labels:  DELTAS.map(expandDelta)
    })
}

// "5m" -> "5 minutes"
// "auto" -> "auto"
function expandDelta(delta) {
  var match = /^([0-9]+)([a-z])$/.exec(delta)
  if (!match) return delta
  var unit  = UNITS[match[2]]
    , value = match[1]
  return value + " " + (value === "1" ? unit.slice(0, -1) : unit)
}

DeltaPicker.prototype.update = function(delta) {
  this.emit("delta", delta)
  this.destroy()
}

///
/// Events
///

// Don't redirect, just redraw with the new delta in place.
DeltaPicker.prototype.onChange = function() {
  var delta = this.selectEl.value
  if (delta === "other") {
    this.showCustom()
  } else this.update(delta)
}

DeltaPicker.prototype.onKeyDown = function(ev) {
  var key = keymap(ev)
  if (key === "\n") {
    var delta = this.customEl.value
      , match
    if (!delta) return
    // Validation
    if (match = reDelta.exec(delta)) {
      // Ensure it has a unit
      if (!match[1]) delta += "m"
      this.update(delta)
    } else if (this.customEl.className.indexOf("error") === -1) {
      this.customEl.className += " error"
    }
  }
}

///
/// Set a custom delta using a text input overlayed on the `<select>`.
///

DeltaPicker.prototype.showCustom = function() {
  this.setCustomDisplay(null)

  var deltaReal = this.settings.deltaReal
  this.customEl.value = deltaReal === "auto" ? (this.settings.delta / 60000) + "m"
                      : deltaReal
  this.customEl.select()
}

DeltaPicker.prototype.hideCustom = function() {
  this.setCustomDisplay("none")
  this.customEl.value = ""
}

DeltaPicker.prototype.setCustomDisplay = function(display) {
  this.isCustomVisible        = !display
  this.customEl.style.display = display
}
