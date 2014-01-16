var test     = require('tap').test
  , Interval = require('../../../app/metrics/interval')
  , helpers  = require('./helpers')
  , pt       = helpers.makeCounter
  , em       = helpers.makeEmpty
  , iv       = function(s, e) { return new Interval(s, e) }


test("Interval", function(t) {
  var interval = new Interval(1, 2)
  t.equals(interval.start, 1)
  t.equals(interval.end, 2)
  t.end()
})

test("Interval.fill", function(t) {
  var fill = Interval.fill

  /// Nothing to fill.
  t.deepEquals(fill([], [], 2), [])
  t.deepEquals(fill([pt(4)], [iv(4, 4)], 2),
    [pt(4)])
  t.deepEquals(fill([pt(4), pt(6)], [iv(4, 6)], 2),
    [pt(4), pt(6)])

  /// Single gap.
  // Gap in the middle.
  t.deepEquals(fill([pt(0), pt(2), pt(6)], [iv(0, 6)], 2),
    [pt(0), pt(2), em(4), pt(6)])
  // Gap at the start.
  t.deepEquals(fill([pt(2), pt(4)], [iv(0, 4)], 2),
    [em(0), pt(2), pt(4)])
  // Gap at the end.
  t.deepEquals(fill([pt(0), pt(2)], [iv(0, 4)], 2),
    [pt(0), pt(2), em(4)])

  /// Multi gap.
  t.deepEquals(fill([pt(0), pt(2), pt(6)], [iv(0, 10)], 2),
    [pt(0), pt(2), em(4), pt(6), em(8), em(10)])

  /// Multi interval
  t.deepEquals(fill([pt(0), pt(2), pt(10), pt(12)], [iv(0, 4), iv(10, 14)], 2),
    [ pt(0),  pt(2),  em(4)
    , pt(10), pt(12), em(14)
    ])

  t.end()
})


test("Interval.gaps", function(t) {
  var gaps = Interval.gaps

  /// No gap
  t.deepEquals(gaps([], [], 2), [])
  t.deepEquals(gaps([pt(0), pt(2)], [iv(0, 2)], 2), [])

  /// Single gap
  // Gap in the middle.
  t.deepEquals(gaps([pt(0), pt(6), pt(8)], [iv(0, 8)], 2),
    [iv(2, 4)])
  // Gap at end.
  t.deepEquals(gaps([pt(0), pt(2)], [iv(0, 4)], 2),
    [iv(4, 4)])

  t.end()
})

test("Interval.mergePoints", function(t) {
  var merge = Interval.mergePoints

  t.deepEquals(merge([], []), [])
  t.deepEquals(merge([pt(0)], []), [pt(0)])
  t.deepEquals(merge([], [pt(0)]), [pt(0)])

  t.deepEquals(merge([pt(0), pt(4)], [pt(2)]), [pt(0), pt(2), pt(4)])
  t.deepEquals(merge([pt(2)], [pt(0), pt(4)]), [pt(0), pt(2), pt(4)])
  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

test("Interval.scan", function(t) {
  var scan  = Interval.scan
    , FULL  = Interval.FULL
    , EMPTY = Interval.EMPTY
    , state = function(s, e, st) { return {start: s, end: e, state: st} }

  /// No gap
  t.deepEquals(scan([], [], 2), [])
  t.deepEquals(scan([pt(0)], [iv(0, 0)], 2),
    [state(0, 0, FULL)])
  t.deepEquals(scan([pt(0), pt(2), pt(6)], [iv(0, 2), iv(6, 6)], 2),
    [state(0, 2, FULL), state(6, 6, FULL)])

  /// 1 gap
  // 1 point and 1 empty
  t.deepEquals(scan([pt(0)], [iv(0, 2)], 2),
    [state(0, 0, FULL), state(2, 2, EMPTY)])

  /// Multi gap
  // 1 empty on either side
  t.deepEquals(scan([pt(2)], [iv(0, 4)], 2),
    [state(0, 0, EMPTY), state(2, 2, FULL), state(4, 4, EMPTY)])
  // Alternate
  t.deepEquals(scan([pt(0), pt(2), pt(8), pt(10), pt(20)], [iv(0, 20)], 2),
    [ state(0, 2, FULL)
    , state(4, 6, EMPTY)
    , state(8, 10, FULL)
    , state(12, 18, EMPTY)
    , state(20, 20, FULL)
    ])

  /// Multi interval
  t.deepEquals(scan([pt(0), pt(2), pt(10), pt(12)], [iv(0, 4), iv(8, 12)], 2),
    [ state(0, 2, FULL), state(4, 4, EMPTY)
    , state(8, 8, EMPTY), state(10, 12, FULL)
    ])

  t.end()
})
