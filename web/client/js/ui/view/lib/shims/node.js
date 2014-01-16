var EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits

module.exports = DOMShim

function DOMShim() {
  this.ops = []
  this.ee  = new EventEmitter()
}

DOMShim.prototype.create = function(html) {
  var el = {html: html}
  this.ops.push(["create", el])
  return el
}

DOMShim.prototype.remove = function(el) {
  this.ops.push(["remove", el])
}


DOMShim.prototype.on = function(el, type, listener) {
  this.ee.on(type, listener)
}

DOMShim.prototype.is = function(el, selector) { return el.tag === selector }

DOMShim.prototype.find = function(id) { return {id: id} }

// For testing.
DOMShim.prototype.emit = function(type, target) {
  this.ee.emit(type, {type: type, target: target})
}
