module.exports = MockRing

function MockRing() { this.ops = [] }

MockRing.prototype.metrics = function(metrics, isLocal) {
  this.ops.push(["metrics", metrics, isLocal])
}
