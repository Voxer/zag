var SettingsPopup  = require('../settings-popup')
  , inherits       = require('util').inherits
  , Chart          = require('../../../../models/chart')
  , PlotSettings   = require('../../../../models/plot-settings')
  , subkeyToLabel  = SettingsPopup.subkeyToLabel
  , SUBKEY_COLORS  = Chart.SUBKEY_COLORS

var HIST_SUBKEYS =
  [ "p10"
  , "median", "mean"
  , "p75", "p95", "p99"
  , "max"
  , "std_dev"
  , "llquantize"
  ]

module.exports = HistogramPicker

/// "histkeys" chooser.
///
/// options -
///   controller, emit, onHide
///
function HistogramPicker(opts) {
  this.setup(opts)
  opts.body = this.checkboxHTML()
  SettingsPopup.call(this, opts)
}

inherits(HistogramPicker, SettingsPopup)

HistogramPicker.prototype.View({type: "plottype-histogram"})
  .on(
  { "input                change":    "onChangeHistKey"
  , ".setting-check-reset click":     "onClickReset"
  , ".setting-check-only  click":     "onClickOnly"
  , ".setting-check-only  mouseover": "onMouseOverOnly"
  , ".setting-check-only  mouseout":  "onMouseOutOnly"
  })

HistogramPicker.prototype.checkboxHTML = function() {
  var html     = ''
    , histkeys = this.settings.histkeys
    , subkey, checked, color
  for (var i = 0; i < HIST_SUBKEYS.length; i++) {
    subkey  = HIST_SUBKEYS[i]
    checked = ~histkeys.indexOf(subkey) ? "checked" : ""
    color   = SUBKEY_COLORS[subkey]
    html += '<label class="setting-check" data-subkey="' + subkey + '">'
          +   '<div class="setting-check-color" style="background:' + color + ';"></div>'
          +   '<input class="setting-check-box" type="checkbox" ' + checked + '/>'
          +   subkeyToLabel(subkey)
          +   '<button class="setting-check-only" title="Select only">&#11013;</button>'
          + '</label>'
  }
  html += '<label class="setting-check setting-check-reset">'
        +   '<div class="setting-check-color"></div>'
        +   'reset'
        + '</label>'
  return html
}

HistogramPicker.prototype.setHistKeys = function(subkeys) {
  var checks = this.el.children
  for (var i = 0; i < checks.length; i++) {
    var check  = checks[i]
      , subkey = check.dataset.subkey
    if (subkey) {
      check.querySelector("input").checked
        = subkeys.indexOf(subkey) !== -1
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
/// Events
////////////////////////////////////////////////////////////////////////////////

// A check box was toggled.
HistogramPicker.prototype.onChangeHistKey = function(ev) {
  var children = this.el.children
    , histkeys = []
  for (var i = 0; i < children.length; i++) {
    var check = children[i]
      , box   = check.querySelector("input")
    if (box && box.checked) {
      histkeys.push(check.dataset.subkey)
    }
  }

  this.emit("histkeys", histkeys)
}

// The ".setting-check-only" was clicked, so deselect everything else.
HistogramPicker.prototype.onClickOnly = function(ev) {
  ev.stopPropagation()
  ev.preventDefault()

  var current = ev.target.parentElement
    , checks  = this.el.children

  for (var i = 0; i < checks.length; i++) {
    var check = checks[i]
      , box   = check.querySelector("input")
    if (box) box.checked = check === current
  }

  this.emit("histkeys", [current.dataset.subkey])
}

HistogramPicker.prototype.onMouseOverOnly = setCheckClass("setting-check only")
HistogramPicker.prototype.onMouseOutOnly  = setCheckClass("setting-check")

// Check all of the default subkeys.
HistogramPicker.prototype.onClickReset = function() {
  var subkeys = PlotSettings.HISTOGRAM
  this.setHistKeys(subkeys)
  this.emit("histkeys", subkeys)
}

function setCheckClass(className) {
  return function(ev) { ev.target.parentElement.className = className }
}
