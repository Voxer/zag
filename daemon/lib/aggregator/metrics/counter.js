module.exports = Counter

function Counter() { this.count = 0 }

Counter.prototype.push = function(v) { this.count += v }

Counter.prototype.toJSON = function(ts) {
  return { ts: ts, count: this.count }
}
