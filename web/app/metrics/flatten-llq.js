var sort = require('../../lib/sort')

/// Flatten the array of objects into an array of arrays.
/// The returned structure is sent to the callback, but is not cached.
///
/// points - [{ts, data} or {ts, empty}]
///
/// Returns [[ts, bucketA, freqA, bucketB, freqB ...]]
module.exports = function(points) {
  var newPoints = []
  for (var i = 0, pl = points.length; i < pl; i++) {
    newPoints.push(flattenPoint(points[i]))
  }
  return newPoints
}

// point - {ts, data} or {ts, empty}
// Returns [ts, bucketA, freqA, bucketB, freqB ...]
function flattenPoint(point) {
  var column = [point.ts]
  if (point.empty) return column

  var buckets = sort(toNums(Object.keys(point.data)))
  for (var b = 0, bl = buckets.length; b < bl; b++) {
    var bucket = buckets[b]
      , freq   = point.data[bucket]
    column.push(+bucket)
    column.push(freq)
  }
  return column
}

function toNums(ary) {
  for (var i = 0, l = ary.length; i < l; i++) ary[i] = +ary[i]
  return ary
}
