var MHistogram = require('metrics').Histogram

module.exports = Histogram

function Histogram() { this.hist = new MHistogram() }

Histogram.prototype.push = function(val) { this.hist.update(val) }

Histogram.prototype.toJSON = function(ts) {
  var hist        = this.hist
    , percentiles = hist.percentiles([0.1, 0.5, 0.75, 0.95, 0.99])
  return { ts:      ts
         , count:   hist.count
         , max:     hist.max
         , mean:    r(hist.mean())
         , std_dev: r(hist.stdDev()) || 0
         , p10:     r(percentiles[0.1])
         , median:  r(percentiles[0.5])
         , p75:     r(percentiles[0.75])
         , p95:     r(percentiles[0.95])
         , p99:     r(percentiles[0.99])
         }
}

Histogram.prototype.getMean = function() {
  return this.hist.mean() || 0
}

Histogram.prototype.getVariance = function() {
  return this.hist.variance() || 0
}

// Strip some digits
function r(num) {
  return num === Math.floor(num) ? num
       : (Math.floor(num * 10000) / 10000)
}
