var sample = require('./sample')

/// Downsample a counter by summing the intervals.
///
/// data  - [{ts, count}]
/// delta - Integer (milliseconds)
///
/// Returns [{ts, count}]
module.exports = function(data, delta) {
  return sample(data, delta, initPoint, sumPoint);
}

function initPoint(ts) {
  return { ts:    ts
         , count: 0
         }
}

function sumPoint(ptA, ptB) { ptA.count += ptB.count }
