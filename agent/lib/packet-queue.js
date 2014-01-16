module.exports = PacketQueue

/// Coalesce metrics packets.
///
/// send(buffer, offset, length)
/// options - (optional)
///   * block - Integer, maximum block size
///   * flush - Integer, millisecond flush interval
///   * type  - String, optional
///
function PacketQueue(send, options) {
  options        = options || {}
  this.send      = send
  this.blockSize = options.block || 1440
  this.type      = options.type
  this.prefix    = this.type ? (this.type + "\n") : ""
  this.queue     = null
  this.writePos  = null
  this.reset()

  // Don't let stuff queue forever.
  var _this = this
  this.interval = setInterval(function() { _this.flush() }, options.flush || 1000)
}

PacketQueue.prototype.destroy = function() {
  clearInterval(this.interval)
}

PacketQueue.prototype.reset = function() {
  this.queue    = []
  this.writePos = this.prefix.length
}

PacketQueue.prototype.write = function(str) {
  if (this.writePos + str.length >= this.blockSize) {
    this.sendPacket()
  }
  this.queue.push(str)
  this.writePos += str.length + 1
}

PacketQueue.prototype.sendPacket = function() {
  var buf = new Buffer(this.prefix + this.queue.join("\n"))
  this.send(buf, 0, buf.length)
  this.reset()
}

PacketQueue.prototype.flush = function() {
  if (this.queue.length) this.sendPacket()
}
