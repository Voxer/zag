module.exports = RunningMean

function RunningMean(decay) {
  this.decay = decay && (1 / decay)
  this.mean  = 0
  this.count = 1
}

RunningMean.prototype.push = function(value) {
  var count = this.count
    , d     = this.decay || count
  this.mean = count === 1 ? value : (value + this.mean * (d - 1)) / d
  this.count++
}
