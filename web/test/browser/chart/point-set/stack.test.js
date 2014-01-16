var test          = require('tap').test
  , lodash        = require('lodash')
  , StackPointSet = require('../../../../client/js/ui/chart2/models/point-set/stack')
  , StackLayers   = require('../../../../client/js/ui/chart2/models/stack-layers')

test("StackPointSet", function(t) {
  var layers = new StackLayers()
    , data   = []
    , ps     = new StackPointSet({data: data, x: "a", y: "b", layers: layers})
  t.equals(ps.layers, layers)
  t.equals(ps.origData, data)
  t.equals(ps.origXAttr, "a")
  t.equals(ps.origYAttr, "b")
  t.equals(ps.xAttr, "x")
  t.equals(ps.yAttr, "y")
  t.isa(ps.getX, "function")
  t.end()
})

test("StackPointSet#getX", function(t) {
  var ps = makeStack({})
  t.equals(ps.getX(ptX(5, 6)), 5)
  t.end()
})

test("StackPointSet#destroy", function(t) {
  var ps     = makeStack({})
    , layers = ps.layers.layers
  ps.prepare() // force "data" to be computed

  t.ok(ps.layers)
  t.ok(ps.getX)
  t.equals(layers.length, 1)
  t.equals(layers[0], ps)
  t.ok(ps.origData)
  t.ok(ps.data)

  ps.destroy()
  t.equals(layers.length, 0)
  t.notOk(ps.layers)
  t.notOk(ps.getX)
  t.notOk(ps.origData)
  t.notOk(ps.data)
  t.end()
})

test("StackPointSet#getLabel", function(t) {
  var stack1 = makeStack({data: [{a: 0, b: 1}, {a: 2, b: 3}]})
    , stack2 = makeStack({data: [{a: 0, b: 2}, {a: 2, b: 4}], layers: stack1.layers})
  stack1.prepare()
  t.equals(stack1.getLabel(0), 1)
  t.equals(stack1.getLabel(1), 3)
  t.equals(stack2.getLabel(0), 2)
  t.equals(stack2.getLabel(1), 4)
  t.end()
})

test("StackPointSet#setData 1 layer", function(t) {
  var points = [ptA(0, 1), ptA(2, 3), ptA(4, 5), ptA(6, 3)]
    , expect = [ptX(0, 1), ptX(2, 3), ptX(4, 5), ptX(6, 3)]
    , ps     = new makeStack({data: points})
  t.notOk(ps.data)
  t.equals(ps.layers.dirty, 0)
  ps.prepare()
  t.deepEquals(ps.data, expect)
  t.end()
})

test("StackPointSet#prepare", function(t) {
  var layers = new StackLayers()
    , ps1    = makeStack({layers: layers, data: [ptA(0, 1)]})
    , ps2    = makeStack({layers: layers, data: [ptA(0, 2)]})
  t.notOk(ps1.data)
  t.notOk(ps2.data)
  t.equals(layers.dirty, 0)
  ps1.prepare()
  ps2.prepare()
  t.ok(ps1.data)
  t.ok(ps2.data)
  t.equals(layers.dirty, null)
  t.end()
})

test("StackLayers#prevStack", function(t) {
  var stack1 = makeStack({})
    , stack2 = makeStack({layers: stack1.layers})
    , stack3 = makeStack({layers: stack2.layers})
  t.equals(stack1.prevStack(), null)
  t.equals(stack2.prevStack(), stack1)
  t.equals(stack3.prevStack(), stack2)
  t.end()
})


test("StackLayers#restack", function(t) {
  var ps1 = makeStack({data: [ptA(0, 1)]})
  ps1.restack({data: [ptX(0, 5)]})
  t.deepEquals(ps1.data, [ptX(0, 6)])
  ps1.restack()
  t.deepEquals(ps1.data, [ptX(0, 1)])
  t.end()
})


test("StackLayers#addTo", function(t) {
  var ps = makeStack({data: [ptA(0, 4), ptA(2, 5), ptA(3, 6)]})
  // Same length; corresponding X.
  t.deepEquals(ps.addTo(
    [ptX(0, 1), ptX(2, 2), ptX(3, 3)]),
    [ptX(0, 5), ptX(2, 7), ptX(3, 9)])

  // Too long
  t.deepEquals(ps.addTo(
    [ptX(0, 1), ptX(2, 2)]),
    [ptX(0, 5), ptX(2, 7), ptX(3, 6)])

  // Too short
  t.deepEquals(ps.addTo(
    [ptX(0, 1), ptX(2, 2), ptX(3, 3), ptX(4, 1)]),
    [ptX(0, 5), ptX(2, 7), ptX(3, 9), ptX(4, 1)])

  // Gap
  t.deepEquals(ps.addTo(
    [ptX(0, 1), ptX(3, 3)]),
    [ptX(0, 5), ptX(2, 5), ptX(3, 9)])

  // Fill gap
  t.deepEquals(ps.addTo(
    [ptX(0, 1), ptX(1, 2), ptX(2, 3)]),
    [ptX(0, 5), ptX(1, 2), ptX(2, 8), ptX(3, 6)])

  // Add to empty array
  t.deepEquals(ps.addTo([]),
    [ptX(0, 4), ptX(2, 5), ptX(3, 6)])

  t.end()
})

test("StackLayers#addToBottom", function(t) {
  var ps = makeStack({data: [ptA(0, 4), ptA(1, 5), ptA(2, 6)]})
  t.deepEquals(ps.addToBottom(),
    [ptX(0, 4), ptX(1, 5), ptX(2, 6)])
  t.end()
})

test("StackLayers#addToBottom empty:true", function(t) {
  var ps = makeStack({data: [ptA(0, 4), ptA(1, 5), ptA(2, undefined)]})
  t.deepEquals(ps.addToBottom(),
    [ptX(0, 4), ptX(1, 5), ptX(2, 0)])
  t.end()
})


function ptX(x, y) { return {x: x, y: y} }
function ptA(x, y) { return {a: x, b: y} }

function makeStack(opts) {
  var defaultOps =
    { data: []
    , x: "a"
    , y: "b"
    , layers: new StackLayers()
    }
  return new StackPointSet(lodash.extend(defaultOps, opts))
}
