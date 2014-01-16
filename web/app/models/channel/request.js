var http = require('http')

module.exports = LiveRequest

function LiveRequest(url, onPoint) {
  this.onPoint = onPoint
  this.request = http.get(url, this.onResponse.bind(this))
    .on("error", this.onError.bind(this))
  this.buffer  = ""
}

LiveRequest.prototype.destroy = function() {
  if (this.request) this.request.destroy()
  this.onPoint = this.request = this.buffer = null
}

LiveRequest.prototype.onError = LiveRequest.prototype.destroy

LiveRequest.prototype.onResponse = function(res) {
  res.on("data", this.onData.bind(this))
     .on("end",  this.onEnd.bind(this))
}

LiveRequest.prototype.onData = function(buf) {
  this.buffer += buf.toString()
  this.flush()
}

LiveRequest.prototype.onEnd = function() {
  this.buffer += "\n"
  this.flush()
}

LiveRequest.prototype.flush = function() {
  if (!this.onPoint) return

  var chunks = this.buffer.split("\n")
  for (var i = 0, l = chunks.length - 1; i < l; i++) {
    var pt = parse(chunks[i])
    if (pt) this.onPoint(pt)
  }
  this.buffer = chunks[l]
}

function parse(str) {
  try {
    return JSON.parse(str)
  } catch (e) {}
}
