/// Downsample an array of points.
///
/// points  - [Point]
/// delta   - Integer, milliseconds
/// combine(pointA, pointB)->point
/// post(point, count)->point
///
/// Returns [Point]
module.exports = function(points, delta, init, combine, post) {
  if (!points.length) return []

  var newPoints    = []
    , currentCount = 0
    , current, currentBegin, point
  for (var i = 0; i < points.length; i++) {
    point = points[i]
    if (i === 0 || point.ts - currentBegin >= delta) {
      if (i > 0) pushPoint(current)
      currentBegin = point.ts - point.ts % delta
      current      = init(currentBegin)
      currentCount = 0
    }
    if (!point.empty) {
      safeCombine(current, point)
      currentCount++
    }
  }
  pushPoint(current)
  return newPoints

  function pushPoint(pt) {
    newPoints.push( currentCount === 0 ? {ts: currentBegin, empty: true}
                  : post ? post(pt, currentCount)
                  : pt )
  }

  function safeCombine(ptA, ptB) {
    return ptA.empty ? ptB
         : ptB.empty ? ptA
         : combine(ptA, ptB)
  }
}
