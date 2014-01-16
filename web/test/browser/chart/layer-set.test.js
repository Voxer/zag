var test     = require('tap').test
  , LayerSet = require('../../../client/js/ui/chart2/models/layer-set')

test("LayerSet", function(t) {
  var layers = new LayerSet()
  t.deepEquals(layers.all,  [])
  t.deepEquals(layers.byID, {})
  t.end()
})

test("LayerSet#destroy", function(t) {
  var layers = new LayerSet()
    , layer  = new MockLayer()
  layers.push(layer)
  layers.destroy()
  t.equals(layers.all, null)
  t.equals(layers.byID, null)
  t.deepEquals(layer.ops, ["destroy"])
  t.end()
})

test("LayerSet#render", function(t) {
  var layers = new LayerSet()
    , layer1 = new MockLayer()
    , layer2 = new MockLayer()
  layers.push(layer1)
  layers.push(layer2)
  layers.render()
  // Layer 1 must render first.
  layer1.render = function() {
    this.ops.push("render")
    t.deepEquals(layer2.ops, [])
  }
  t.deepEquals(layer1.ops, ["render"])
  t.deepEquals(layer2.ops, ["render"])
  t.end()
})

test("Layer#onResize", function(t) {
  var layers = new LayerSet()
    , layer  = new MockLayer()
  layers.push(layer)
  layers.onResize()
  t.deepEquals(layer.ops, ["onResize"])
  t.end()
})



test("Layer#push", function(t) {
  var layers = new LayerSet()
    , layer  = new MockLayer("ID")
  layers.push(layer)
  t.equals(layers.all.length, 1)
  t.equals(layers.all[0], layer)
  t.equals(Object.keys(layers.byID).length, 1)
  t.equals(layers.byID.ID, layer)
  t.end()
})

test("Layer#remove", function(t) {
  var layers = new LayerSet()
    , layer  = new MockLayer("ID")
  layers.push(layer)
  layers.remove("ID")
  t.equals(layers.all.length, 0)
  t.deepEquals(layers.byID, {ID: null})
  t.deepEquals(layer.ops, ["destroy"])
  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function MockLayer(id) {
  this.id  = id || Math.random().toString()
  this.ops = []
}

MockLayer.prototype.destroy  = function() { this.ops.push("destroy") }
MockLayer.prototype.render   = function() { this.ops.push("render") }
MockLayer.prototype.onResize = function() { this.ops.push("onResize") }
