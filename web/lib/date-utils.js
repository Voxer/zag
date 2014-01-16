var UNITS =
  { s: "seconds"
  , m: "minutes"
  , h: "hours"
  , d: "days"
  , w: "weeks"
  , M: "months"
  , y: "years"
  }

// Millisecond factors.
var UNIT_VALUES =
  { s: 1000
  , m: 1000 * 60
  , h: 1000 * 60 * 60
  , d: 1000 * 60 * 60 * 24
  , w: 1000 * 60 * 60 * 24 * 7
  , M: 1000 * 60 * 60 * 24 * 30
  , y: 1000 * 60 * 60 * 24 * 365
  }

var months =
  [ "Jan", "Feb", "Mar", "Apr", "May", "Jun"
  , "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ]

var days =  ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

var ENDASH = " \u2013 "

module.exports =
  { UNITS:         UNITS
  , months:        months
  , days:          days
  , verbose:       verbose
  , verboseRange:  verboseRange
  , dateToString:  dateToString
  , parse:         parse
  , parseInterval: parseInterval
  }


////////////////////////////////////////////////////////////////////////////////
// String-ification.
////////////////////////////////////////////////////////////////////////////////

// Convert an aboslute or relative string to a more readable version.
//
// str - String (absolute or relative), or Integer timestamp.
//
// Returns String
function verbose(str) {
  return (str[0] === "-" ? relToString : absToString)(str)
}

// Convert 2 date strings to a range.
//
// begin, end - String (absolute or relative) date.
//
// Returns String
function verboseRange(begin, end) {
  if (begin[0] === "-") {
    return verbose(begin) + ENDASH + verbose(end)
  }
  // Remove the common prefix.
  return verbose(begin) + ENDASH + verboseUncommon(parse(end), parse(begin))
}

var fields =
  [ {fn: "getFullYear", suffix: "/"}
  , {fn: "getMonth",    suffix: "/", pad: true, mod: 1}
  , {fn: "getDate",     suffix: " ", pad: true}
  , {fn: "getHours",    suffix: ":", pad: true, force: true}
  , {fn: "getMinutes",  suffix: "",  pad: true}
  ]

// date      - Integer timestamp
// reference - Integer timestamp
function verboseUncommon(date, reference) {
  var d = new Date(date)
    , r = new Date(reference)
    , s = ""
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
      , value = d[field.fn]()
    if (s || field.force || value !== r[field.fn]()) {
      if (field.mod) value = value + field.mod
      if (field.pad) value = pad2(value)
      s += value + field.suffix
    }
  }
  return s
}

function dateToString(d) {
  var seconds = d.getSeconds()
    , ms      = d.getMilliseconds()
  return days[d.getDay()] + " "
       + " "
       + months[d.getMonth()] + " " + pad2(d.getDate())
       + ", " + d.getFullYear() + "; "
       + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
       + (seconds ? (":" + pad2(seconds)) : "")
       + (ms      ? ("." + pad3(ms)) : "")
}

////////////////////////////////////////////////////////////////////////////////
// Parsing
////////////////////////////////////////////////////////////////////////////////

var reDatetime = /^(20\d\d)(\d\d)(\d\d)(?:(\d\d)(\d\d)(\d\d))?$/
// Types of special dates allowed:
//
//   now         - Current timestamp
//   -[n][units] - [n] [units] ago
//                 e.g.: -5d == 5 days ago.
//   YYYYMMDD[HHmmss]
//
// Returns Integer timestamp or undefined.
function parse(time, end) {
  end = end || Date.now()

  if (!time)                    return
  if (typeof time === "number") return time
  if (time === "now")           return end
  // Relative.
  if (time[0] === "-")          return end - parseInterval(time.slice(1))

  var match = reDatetime.exec(time)
  if (!match) return Math.min(+time, end)

  // "YYYYMMDD..."
  var t = match.slice(1)
    , d = t[3]
        ? new Date(t[0], +t[1] - 1, +t[2], t[3], t[4], t[5])
        : new Date(t[0], +t[1] - 1, +t[2])
  return d.getTime()
}


// Get the length in milliseconds.
//
// str - "1m", "4h", etc.
//
// Returns Integer.
function parseInterval(str) {
  var rel = parseRelative(str)
  return rel.value * UNIT_VALUES[rel.unit]
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// Pretty-print a relative date.
//
// str - String, such as "-5h"
//
// Examples:
//
//   > relToString("-5h")
//   "5 hours ago"
//
// Returns String.
function relToString(str) {
  var rel  = parseRelative(str.slice(1))
    , unit = UNITS[rel.unit]
  // Slice off the "s".
  if (rel.value === 1) {
    unit = unit.slice(0, -1)
  }
  return rel.value + " " + unit + " ago"
}

// Pretty-print an absolute date.
//
// ts - Integer or String timestamp.
//
// Returns String.
function absToString(ts) {
  var d = new Date(parse(ts))
  return d.getFullYear()        + "/"
       + pad2(d.getMonth() + 1) + "/"
       + pad2(d.getDate())      + " "
       + pad2(d.getHours())     + ":"
       + pad2(d.getMinutes())
}

var reRelative = /^([0-9]+)([a-z])$/i
function parseRelative(rel) {
  var match = reRelative.exec(rel)
  return {value: +match[1], unit: match[2]}
}

function pad2(n) { return (n < 10 ? "0" : "") + n }
function pad3(n) { return (n < 100 ? "0" : "") + pad2(n) }
