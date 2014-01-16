var llquantize = require('llquantize')

module.exports = LLQ

function LLQ() { this.llq = llquantize(2, 16) }

LLQ.prototype.push = function(val) { this.llq(val) }

LLQ.prototype.toJSON = function(ts) {
  return { ts: ts, data: this.llq() }
}
