var sample    = require('./sample')
  , KEYS      = ["mean", "median", "std_dev", "p10", "p75", "p95", "p99", "max"]
  , KEY_COUNT = KEYS.length

/// Downsample a counter by summing the intervals.
///
/// data  - [{ts, count}]
/// delta - Integer (milliseconds)
///
/// Returns [{ts, count}]
var H =
module.exports = function(data, delta) {
  return sample(data, delta, initPoint, combine, average);
}

H.KEYS = KEYS

function initPoint(ts) {
  var pt = {ts: ts, count: 0}
  for (var i = 0; i < KEY_COUNT; i++) {
    pt[KEYS[i]] = 0
  }
  return pt
}

function combine(ptA, ptB) {
  ptA.count += ptB.count
  for (var i = 0; i < KEY_COUNT; i++) {
    var key = KEYS[i]
    if (key === "max") {
      ptA[key] = Math.max(ptA[key], ptB[key])
    } else {
      ptA[key] += ptB[key]
    }
  }
  return ptA
}

function average(point, count) {
  for (var i = 0; i < KEY_COUNT; i++) {
    var key = KEYS[i]
    if (key === "max") continue
    point[key] /= count
  }
  return point
}
