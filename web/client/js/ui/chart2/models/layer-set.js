module.exports = LayerSet

///
/// A Layer that multiplexes other Layers.
///
/// A Layer must have:
///   * `.id` String, unique within the scope of a Chart
///   * `#destroy`
///   * `#render`
///   * `#onResize` (optional)
/// If it has the property `isPlot = true` then there are additional requirements.
///
function LayerSet() {
  this.all  = [] // [Layer]
  this.byID = {} // {String id : Layer}
}

////////////////////////////////////////////////////////////////////////////////
// Bulk operations
////////////////////////////////////////////////////////////////////////////////

LayerSet.prototype.destroy = function() {
  var layers = this.all
  for (var i = 0, l = layers.length; i < l; i++) {
    layers[i].destroy()
  }
  this.all = this.byID = null
}

LayerSet.prototype.render = function() {
  var layers = this.all
  for (var i = 0, l = layers.length; i < l; i++) {
    layers[i].render()
  }
}

LayerSet.prototype.onResize = function() {
  var layers = this.all
  for (var i = 0, l = layers.length; i < l; i++) {
    var layer = layers[i]
    if (layer.onResize) layer.onResize()
  }
}

LayerSet.prototype.prepare = function() {
  var plots = this.getPlots()
  for (var i = 0, l = plots.length; i < l; i++) {
    plots[i].points.prepare()
  }
}

////////////////////////////////////////////////////////////////////////////////
// Layer management
////////////////////////////////////////////////////////////////////////////////

// layer - Layer
LayerSet.prototype.push = function(layer) {
  this.all.push(layer)
  this.byID[layer.id] = layer
}

// layerID - String
LayerSet.prototype.remove = function(layerID) {
  var layer = this.byID[layerID]
  this.all.splice(this.all.indexOf(layer), 1)
  this.byID[layerID] = null
  layer.destroy()
}

// Filter layers by `isPlot`.
//
// Returns [Layer]
LayerSet.prototype.getPlots = function() { return this.all.filter(isPlot) }
function isPlot(layer) { return layer.isPlot }
