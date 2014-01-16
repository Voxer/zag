var sample = require('./sample')

/// Downsample llquantize data by merging the buckets.
///
/// data  - [{ts, data}]
/// delta - Integer (milliseconds)
///
/// Returns [{ts, count}]
module.exports = function(data, delta) {
  return sample(data, delta, initPoint, sumPoint);
}

function initPoint(ts) {
  return { ts:   ts
         , data: {}
         }
}

// ptA - {ts, data}
// ptB - {ts, data}
function sumPoint(ptA, ptB) {
  var dataA      = ptA.data
    , dataB      = ptB.data
    , newBuckets = Object.keys(dataB)
  for (var i = 0, l = newBuckets.length; i < l; i++) {
    var bucket = newBuckets[i]
    dataA[bucket] = (dataA[bucket] || 0) + dataB[bucket]
  }
}
