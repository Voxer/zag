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

// Mock up a histogram point. Post-Phase-1 shape — no scalar percentiles, and
// `m2` (sum of squared deviations from the mean) replaces the per-point
// `std_dev`. Tests that pre-date Phase 1 used `val` for every field; those
// fixtures don't translate, so callers now pass the stats explicitly.
//
// ts, count - Number
// mean      - Number
// opts      - { m2, max, std_dev } — m2 preferred. Default m2=0 (homogeneous
//             bucket). Passing {std_dev} with no m2 exercises the legacy
//             fallback path in the downsampler.
//
function makeHistogram(ts, count, mean, opts) {
  opts = opts || {}
  var point =
    { ts:    ts
    , count: count
    , mean:  mean
    , max:   opts.max !== undefined ? opts.max : mean
    }
  if (opts.std_dev !== undefined) point.std_dev = opts.std_dev
  if (opts.m2      !== undefined) point.m2      = opts.m2
  else if (opts.std_dev === undefined) point.m2 = 0
  return point
}

function makeLLQ(ts, data) {
  return {ts: ts, data: data}
}
