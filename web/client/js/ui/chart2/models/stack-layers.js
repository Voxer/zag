module.exports = StackLayers

function StackLayers() {
  this.layers = []
  this.dirty  = null
}

///
/// Public
///

StackLayers.prototype.destroy = function() {
  var layers = this.layers
  for (var i = 0; i < layers.length; i++) { layers[i].destroy() }
  this.layers = null
}

// pointset - StackPointSet
StackLayers.prototype.push = function(pointset) {
  this.layers.push(pointset)
  this.setDirtyIndex(this.layers.length - 1)
}

// pointset - StackPointSet
StackLayers.prototype.remove = function(pointset) {
  var layers = this.layers
    , index  = layers.indexOf(pointset)
  if (index > -1) {
    layers.splice(index, 1)
    this.setDirtyIndex(index)
  }
}

StackLayers.prototype.clean = function() {
  if (this.dirty === null) return
  this.restack(this.dirty)
  this.dirty = null
}

// pointset - StackPointSet
StackLayers.prototype.setDirty = function(pointset) {
  this.setDirtyIndex(this.layers.indexOf(pointset))
}


///
/// Internal
///

// index - Integer
StackLayers.prototype.setDirtyIndex = function(index) {
  if (index > -1)
  if (this.dirty === null || index < this.dirty) {
    this.dirty = index
  }
}

// Restack all layers above the given offset (inclusive).
//
// i - Integer offset in the layers. 0 restacks all.
//
StackLayers.prototype.restack = function(i) {
  var layers  = this.layers
    , current = i > 0 && layers[i - 1]
    , prev
  for (; i < layers.length; i++) {
    prev    = current
    current = layers[i]
    current.restack(prev)
  }
}
