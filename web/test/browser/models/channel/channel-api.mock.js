module.exports = MockChannelAPI

function MockChannelAPI() {
  this.ops = []
}

MockChannelAPI.prototype.setChannelMetrics = function(id, updates, callback) {
  this.ops.push(["setChannelMetrics", id, updates])
}
