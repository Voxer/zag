var test          = require('tap').test
  , lodash        = require('lodash')
  , StackPointSet = require('../../../client/js/ui/chart2/models/point-set/stack')
  , StackLayers   = require('../../../client/js/ui/chart2/models/stack-layers')

test("StackLayers", function(t) {
  var layers = new StackLayers()
  t.deepEquals(layers.layers, [])
  t.equals(layers.dirty, null)
  t.end()
})

test("StackLayers#destroy", function(t) {
  var layers = new StackLayers()
    , ps     = makeLayer({layers: layers})

  layers.destroy()
  t.equals(ps.data, null)
  t.equals(layers.layers, null)
  t.end()
})

test("StackLayers#push", function(t) {
  var layers = new StackLayers()
    , ps     = makeLayer({layers: layers})
  t.end()
})

test("StackLayers#remove", function(t) {
  var layers = new StackLayers()
    , ps     = makeLayer({layers: layers})
  layers.remove(ps)
  t.deepEquals(layers.layers, [])
  t.end()
})

test("StackLayers#remove nonexistant", function(t) {
  var layers = new StackLayers()
    , ps     = makeLayer({layers: layers})
  layers.remove({})
  t.deepEquals(layers.layers, [ps])
  t.end()
})

test("StackLayers#clean when dirty", function(t) {
  var layers = new StackLayers()
    , ps     = makeLayer({layers: layers})
  layers.setDirtyIndex(0)
  t.notOk(ps.data)
  layers.clean()
  t.ok(ps.data)
  t.equals(layers.dirty, null)
  // Don't restack twice.
  layers.restack = function() { t.fail() }
  layers.clean()
  t.end()
})


test("StackLayers#setDirty", function(t) {
  var layers = new StackLayers()
    , ps1 = {}, ps2 = {}, ps3 = {}
  layers.layers = [ps1, ps2, ps3]
  t.equals(layers.dirty, null)
  layers.setDirty(ps2)
  t.equals(layers.dirty, 1)
  layers.setDirty(ps3)
  t.equals(layers.dirty, 1)
  layers.setDirty(ps1)
  t.equals(layers.dirty, 0)
  t.end()
})

test("StackLayers#setDirtyIndex", function(t) {
  var layers = new StackLayers()
  t.equals(layers.dirty, null)
  layers.setDirtyIndex(5)
  t.equals(layers.dirty, 5)
  layers.setDirtyIndex(6)
  t.equals(layers.dirty, 5)
  layers.setDirtyIndex(4)
  t.equals(layers.dirty, 4)
  layers.setDirtyIndex(-1)
  t.equals(layers.dirty, 4)
  t.end()
})


test("StackLayers#restack", function(t) {
  var layers = new StackLayers()
    , ps1    = makeLayer({ layers: layers, data: [{a: 0, b: 2}] })
    , ps2    = makeLayer({ layers: layers, data: [{a: 0, b: 3}] })

  t.notOk(ps1.data)
  t.notOk(ps2.data)
  layers.restack(0)

  t.deepEquals(ps1.data, [{x: 0, y: 2}])
  t.deepEquals(ps2.data, [{x: 0, y: 5}])
  ps1.origData[0].b = 10
  ps2.origData[0].b = 5

  // Only restack the last one.
  layers.restack(1)
  t.deepEquals(ps1.data, [{x: 0, y: 2}])
  t.deepEquals(ps2.data, [{x: 0, y: 7}])
  t.end()
})

test("StackLayers#restack none", function(t) {
  var layers = new StackLayers()
  layers.restack(0)
  t.end()
})



function makeLayer(opts) {
  var defaultOpts =
    { data: []
    , x:    "a"
    , y:    "b"
    }
  return new StackPointSet(lodash.extend(defaultOpts, opts))
}
