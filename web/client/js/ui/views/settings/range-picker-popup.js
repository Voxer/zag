var SettingsPopup = require('./settings-popup')
  , TimePicker    = require('../time-picker')
  , pad           = TimePicker.pad
  , inherits      = require('util').inherits
  , UNITS         = require('../../../../../lib/date-utils').UNITS

// The preset relative dates for quick access.
var dateLinks =
  [ ["m", 1, 5, 10, 20]
  , ["h", 1, 2, 6, 12]
  , ["d", 1, 2, 3, 8]
  , ["w", 1, 2, 3, 4]
  , ["M", 1, 2, 3, 6]
  ]

module.exports = RangePicker

/// Select the interval that the graphs are plotted across.
///
/// There are a couple of different ways to pick an interval:
///   * Relative: <n><unit> ago.
///   * Absolute: Pick dates/times from a calendar widget.
///
/// options -
///   * controller, emit, onHide
///   * style
///
function RangePicker(opts) {
  this.setup(opts)
  opts.rows     = this.rowsHTML()
  opts.disabled = this.nowDisabled()
  SettingsPopup.call(this, opts)

  this.start = new TimePicker(
    { ts:       this.settings.start
    , appendTo: this.startEl
    , onChange: this.onTimeChangeStart.bind(this)
    })
  this.end = new TimePicker(
    { ts:       this.settings.end
    , appendTo: this.endEl
    , onChange: this.onTimeChangeEnd.bind(this)
    })
  this.end.el.style.marginTop = "1px"
}

inherits(RangePicker, SettingsPopup)

RangePicker.prototype.View(
  { type: "range"
  , body
    : '<table class="date-links"><tbody:rowsEl>{rows}</tbody></table>'
    + '<hr class="range-hr"/>'
    + '<div:startEl class="range-picker-input">'
    +   '<span class="range-picker-label">Begin:</span>'
    + '</div>'
    + '<div:endEl class="range-picker-input">'
    +   '<span class="range-picker-label">End:</span>'
    + '</div>'
    + '<button:nowEl class="range-picker-now {disabled}">now</button>'
  }).on(
  { "a                 click": "onClickLink"
  , ".range-picker-now click": "onClickNow"
  })
  .destroy(function() {
    this.start.destroy()
    this.end.destroy()
    this.start = this.end = null
  })

// Redraw with the current PlotSettings' start/end.
RangePicker.prototype.update = function() {
  this.rowsEl.innerHTML = this.rowsHTML()
  this.start.setValue(this.settings.start)
  this.end.setValue(this.settings.end)
  this.nowEl.className = "range-picker-now " + this.nowDisabled()
}

// Get the HTML of the table of "<n> <unit> ago" links.
//
// Returns String HTML
RangePicker.prototype.rowsHTML = function() {
  var innerHTML = ''
    , startReal = this.settings.startReal
  for (var i = 0; i < dateLinks.length; i++) {
    var dateLink = dateLinks[i]
      , unit     = dateLink[0]
    innerHTML += '<tr class="date-link-tr">'
               +   '<td class="date-link-unit">'
               +     UNITS[unit]
               +   '</td>'
    for (var j = 1; j < dateLink.length; j++) {
      var value     = dateLink[j]
        , isCurrent = "-" + value + unit === startReal
      innerHTML += '<td class="date-link-td">'
                 +   makeDateLink(unit, value, isCurrent)
                 + '</td>'
    }
    innerHTML += '</tr>'
  }
  return innerHTML
}

RangePicker.prototype.nowDisabled = function() {
  return this.settings.endReal ? "" : "disabled"
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////

RangePicker.prototype.onClickLink = function(ev) {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return
  ev.preventDefault()
  this.emit("range:real", ev.target.dataset.start, undefined)
  this.update()
}

RangePicker.prototype.onClickNow = function() {
  this.emit("range:real", this.settings.startReal, undefined)
  this.update()
}

RangePicker.prototype.onTimeChangeStart = function() {
  this.emit("range:real"
    , toDateString(this.start.getValue())
    , this.settings.endReal)
  this.update()
}

RangePicker.prototype.onTimeChangeEnd = function() {
  this.emit("range:real"
    , this.settings.startReal
    , toDateString(this.end.getValue()))
  this.update()
}

////////////////////////////////////////////////////////////////////////////////

// Create a relative date link.
//
// unit  - Character "m", "h", "d"...
// value - Integer
//
// Returns String HTML.
function makeDateLink(unit, value, isCurrent) {
  var start     = "-" + value + unit
    , href      = SettingsPopup.makeGraphLink({start: start, end: null})
    , className = "date-link" + (isCurrent ? " current" : "")
  return '<a class="' + className + '" href="' + href + '" data-start="' + start + '">'
       +   value
       + '</a>'
}

// Create a date string formatted as: "YYYYMMDDHHmmss".
//
// ts - Integer timestamp
//
// Returns String
function toDateString(ts) {
  var date = new Date(ts)
  return date.getFullYear()
       + pad(date.getMonth() + 1)
       + pad(date.getDate())
       + pad(date.getHours())
       + pad(date.getMinutes())
       + pad(date.getSeconds())
}
