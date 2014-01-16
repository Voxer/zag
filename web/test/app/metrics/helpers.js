var histogram = require('../../../app/metrics/downsample/histogram')
  , KEYS      = histogram.KEYS

module.exports =
  { makeEmpty:     makeEmpty
  , makeCounter:   makeCounter
  , makeHistogram: makeHistogram
  , makeLLQ:       makeLLQ
  }

function makeEmpty(ts) {
  return {ts: ts, empty: true}
}

function makeCounter(ts, count) {
  return {ts: ts, count: count}
}

// Mock up a histogram point.
//
// ts, val, count - Number
// max - Number, optional (default: `val`).
//
// Returns {mean, median, count, ...}
function makeHistogram(ts, val, count, max) {
  var point = {ts: ts, count: count}
  for (var i = 0; i < KEYS.length; i++) {
    point[KEYS[i]] = val
  }
  if (max !== undefined) point.max = max
  return point
}

function makeLLQ(ts, data) {
  return {ts: ts, data: data}
}
