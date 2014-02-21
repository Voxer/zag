var SkyView  = require('skyview')
  , inherits = require('util').inherits

module.exports = TimePicker

function noop() {}

var FIELDS = ["year", "month", "date", "hour", "minute"]
  , BOUNDS = // inclusive
    { month:  [1, 12]
    , date:   [1, 31]
    , hour:   [0, 23]
    , minute: [0, 59]
    }

/// A simple date/time picker.
///
/// opts -
///   * ts       - Integer timestamp
///   * appendTo - Element
///   * onChange(ts)
///     Called when the date changes.
///   * readonly - Boolean, default: false
///
function TimePicker(opts) {
  this.parent    = opts.appendTo
  SkyView.call(this,
    { readonly: opts.readonly ? "readonly" : ""
    })
  this._onChange = opts.onChange || noop
  this.oldValues = {}

  this.isFocused = false
  this.isDirty   = false
  this.setValue(opts.ts)
}

inherits(TimePicker, SkyView)

TimePicker.pad = pad

TimePicker.prototype.View
  ( '<div class="time-picker {readonly}">'
  +   '<input:year type="text" class="time-input time-year" {readonly}/> / '
  +   '<input:month type="text" class="time-input time-month" {readonly}/> / '
  +   '<input:date type="text" class="time-input time-date" {readonly}/> '
  +   '<input:hour type="text" class="time-input time-hour" {readonly}/>:'
  +   '<input:minute type="text" class="time-input time-minute" {readonly}/>'
  + '</div>'
  ).on(
  { "input focus":        "onFocus"
  , "input blur":         "onBlur"
  , "input keydown":      "onKeyDown"
  , ".time-picker click": "onClick"
  }).destroy(function() {
    this.oldValues = this.onChange = this.parent = null
  })

TimePicker.prototype.render = function() {
  this.parent.appendChild(this.el)
}

// ts - Integer timestamp.
TimePicker.prototype.setValue = function(ts) {
  var date = new Date(ts)
  this.year.value   = date.getFullYear()
  this.month.value  = pad(date.getMonth() + 1)
  this.date.value   = pad(date.getDate())
  this.hour.value   = pad(date.getHours())
  this.minute.value = pad(date.getMinutes())
}

// Returns Integer timestamp.
TimePicker.prototype.getValue = function() {
  var date = new Date
    ( this.year.value
    , this.month.value - 1
    , this.date.value
    , this.hour.value
    , this.minute.value )
  return date.getTime()
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////
TimePicker.prototype.onFocus = function(ev) {
  var input = ev.target
  this.oldValues[input.id] = input.value
  this.isFocused = true
}

TimePicker.prototype.onBlur = function(ev) {
  if (!this.isFocused) return
  this.isFocused = false
  var input  = ev.target
    , oldVal = this.oldValues[input.id]

  // Default to the old value if invalid.
  input.value = this.validate(input)
              ? pad(+input.value)
              : oldVal

  if (this.isDirty || input.value !== oldVal) {
    this.isDirty = true
    // If the value changed, call onChange.
    // Wait till nextTick in case another field is going to be edited right away.
    setTimeout(this.onChange.bind(this), 0)
  }
}

TimePicker.prototype.onChange = function() {
  if (this.isFocused) return
  this.isDirty = false
  this._onChange(this.getValue())
}

TimePicker.prototype.onClick = function() { this.year.focus() }

TimePicker.prototype.onKeyDown = function(ev) {
  if (ev.which === 13) { // enter
    this.isFocused = false
    this.onChange()
  }
}

////////////////////////////////////////////////////////////////////////////////
// Validation
////////////////////////////////////////////////////////////////////////////////

// Validate the field.
//
// Validations applied:
//   * Must not be blank.
//   * Must be a number.
//   * If the field has `BOUNDS`, it must be within them.
//
// input - DOM Element
//
// Returns Boolean: whether or not the value is valid.
TimePicker.prototype.validate = function(input) {
  if (!input.value || input.value != +input.value) return false

  var field  = this.getInputField(input)
    , bounds = BOUNDS[field]
  return bounds ? this.validateBounds(input, bounds) : true
}

// input  - DOM Element
// bounds - [Integer start, Integer end], inclusive
TimePicker.prototype.validateBounds = function(input, bounds) {
  var value = +input.value
  return bounds[0] <= value && value <= bounds[1]
}

// input - DOM Element
// Returns String field, (e.g. "year", "hour", ...)
TimePicker.prototype.getInputField = function(input) {
  var className = input.className
  for (var i = 0; i < FIELDS.length; i++) {
    var field = FIELDS[i]
    if (className.indexOf("time-" + field) > -1) {
      return field
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Utilities
////////////////////////////////////////////////////////////////////////////////

function pad(n) { return (n < 10 ? "0" : "") + n }
