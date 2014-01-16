var test = require('tap').test
  , D    = require('../../lib/date-utils')


test("constants", function(t) {
  t.isa(D.UNITS,  Object)
  t.isa(D.months, Array)
  t.isa(D.days,   Array)
  t.equals(D.UNITS.s,   "seconds")
  t.equals(D.months[0], "Jan")
  t.equals(D.days[0],   "Su")
  t.end()
})

test("verbose", function(t) {
  t.equals(D.verbose("-1h"), "1 hour ago")
  t.equals(D.verbose("-2h"), "2 hours ago")
  t.equals(D.verbose("-3w"), "3 weeks ago")
  t.equals(D.verbose("-4y"), "4 years ago")

  var sampleInt = 1378650389012
    , sampleStr = "2013/09/08 07:26"
  t.equals(D.verbose(sampleInt),            sampleStr)
  t.equals(D.verbose(sampleInt.toString()), sampleStr)
  t.equals(D.verbose("20130908072600"),     sampleStr)
  t.equals(D.verbose("20130908"),          "2013/09/08 00:00")

  t.end()
})

var ENDASH = " \u2013 "
test("verboseRange", function(t) {
  t.equals(D.verboseRange("-2h", "-1h"), "2 hours ago" + ENDASH + "1 hour ago")
  t.equals( // year
    D.verboseRange(
      "20130102030400",
      "20140102030400"),
    "2013/01/02 03:04" + ENDASH + "2014/01/02 03:04")
  t.equals( // month
    D.verboseRange(
      "20130102030400",
      "20130202030400"),
    "2013/01/02 03:04" + ENDASH + "02/02 03:04")
  t.equals( // date
    D.verboseRange(
      "20130102030400",
      "20130103030400"),
    "2013/01/02 03:04" + ENDASH + "03 03:04")
  t.equals( // hour
    D.verboseRange(
      "20130102030400",
      "20130102040400"),
    "2013/01/02 03:04" + ENDASH + "04:04")
  t.equals( // minute
    D.verboseRange(
      "20130102030400",
      "20130102030500"),
    "2013/01/02 03:04" + ENDASH + "03:05")
  t.equals( // identical
    D.verboseRange(
      "20130102030400",
      "20130102030400"),
    "2013/01/02 03:04" + ENDASH + "03:04")
  t.end()
})

test("parse", function(t) {
  var parse = D.parse
    , ts    = 1378650389012

  // Absolute, timestamp
  t.equals(parse(""), undefined)
  t.equals(parse(ts), ts)
  t.equals(parse(ts.toString()), ts)

  // YYYYMMDD...
  t.equals(parse("20131102171000"), 1383437400000)
  t.equals(parse("20131102"),       1383375600000)

  // Relative
  t.ok(Date.now() - parse("-1h") - 1000*60*60    < 10)
  t.ok(Date.now() - parse("-1d") - 1000*60*60*24 < 10)

  // Relative with custom "now"
  var now = Date.now()
  t.equals(parse("-1h", now), now - 1000*60*60)

  // "now"
  t.ok(parse("now") - Date.now() < 10)
  t.equals(parse("now", now), now)
  t.end()
})
