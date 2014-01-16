var EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits

module.exports = EventSource

function EventSource() {
  this.isClosed = false
}

inherits(EventSource, EventEmitter)

EventSource.prototype.addEventListener = EventEmitter.prototype.on

EventSource.prototype.close = function() {
  this.isClosed = true
}
