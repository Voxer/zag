module.exports = Interval

var EMPTY = 1
  , FULL  = 2

// start - Integer timestamp
// end   - Integer timestamp
function Interval(start, end) {
  this.start = start
  this.end   = end
}

Interval.fill = fillGaps
Interval.gaps = findGaps

Interval.mergePoints = mergePoints

// Testing only
Interval.scan  = scanIntervals
Interval.EMPTY = EMPTY
Interval.FULL  = FULL

// Public: Fill gaps in the intervals with empty points.
//
// points    - [Point], the initial points.
// intervals - [Interval], the intervals to fill.
// delta     - Integer, downsample interval.
//
// Returns [Point]
function fillGaps(points, intervals, delta) {
  var newPoints = []
    , ivs       = scanIntervals(points, intervals, delta)
    , pointI    = 0
  for (var i = 0; i < ivs.length; i++) {
    var iv    = ivs[i]
      , start = iv.start
      , end   = iv.end
    if (iv.state === FULL) {
      for (; start <= end; start += delta) newPoints.push(points[pointI++])
    } else { // EMPTY
      for (; start <= end; start += delta) newPoints.push({ts: start, empty: true})
    }
  }
  return newPoints
}

// Public: Identify the gaps in a list of points.
//
// points    - [Point], the intial points.
// intervals - [Interval], the intervals to fill.
// delta     - Integer, downsample interval.
//
// Returns [Interval]
function findGaps(points, intervals, delta) {
  var states = scanIntervals(points, intervals, delta)
    , ivs    = []
  for (var i = 0; i < states.length; i++) {
    var state = states[i]
    if (state.state === EMPTY) ivs.push(new Interval(state.start, state.end))
  }
  return ivs
}


// Internal: Break apart the full/gap intervals into IntervalStates.
//
// Returns [IntervalState]
function scanIntervals(points, intervals, delta) {
  var pointI = 0
    , point  = points[pointI]
    , ivs    = []
    , currentState, currentStart
  for (var i = 0; i < intervals.length; i++) {
    var interval = intervals[i]
      , start    = interval.start
      , end      = interval.end
    for (; start <= end; start += delta) {
      var state = (point && point.ts === start) ? FULL : EMPTY
      if (currentState !== state) {
        if (currentState) {
          ivs.push(new IntervalState(currentStart, start - delta, currentState))
        }
        currentState = state
        currentStart = start
      }
      if (state === FULL) {
        point = points[++pointI]
      }
    }
    ivs.push(new IntervalState(currentStart, start - delta, currentState))
    currentState = null
  }
  return ivs
}

// Internal only.
//
// start - Integer timestamp
// end   - Integer timestamp
// state - EMPTY or FULL
//
function IntervalState(start, end, state) {
  this.start = start
  this.end   = end
  this.state = state
}


// Public: Merge 2 Arrays of ordered points into a new Array of ordered points.
//
// Returns [Point]
function mergePoints(pointsA, pointsB) {
  var points = []
    , aI     = 0
    , bI     = 0
    , aL     = pointsA.length
    , bL     = pointsB.length
  while (aI < aL || bI < bL) {
    var aPt = pointsA[aI]
      , bPt = pointsB[bI]
    if (aPt && (!bPt || aPt.ts < bPt.ts)) {
      points.push(aPt); aI++
    } else {
      points.push(bPt); bI++
    }
  }
  return points
}
