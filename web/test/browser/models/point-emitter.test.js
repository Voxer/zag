var test         = require('tap').test
  , PointEmitter = require('../../../client/js/models/point-emitter')
  , Channel      = require('../../../client/js/models/channel')
  , settings     = {start: 0, end: 10, delta: 60000}

Channel.inject(EventSource)

function noop() {}

test("PointEmitter", function(t) {
  var int = new MockIntervalLoader()
    , pe  = new PointEmitter(int, {start: 1, end: 100, delta: 60000})
  t.equals(pe.loader, int)
  t.equals(pe.start, 1)
  t.equals(pe.end,   100)
  t.equals(pe.delta, 60000)
  t.end()
})

test("PointEmitter#addChart, PointEmitter#removeChart", function(t) {
  var pe = new PointEmitter(new MockIntervalLoader(), settings)
  pe.addChart("abc", noop)
  t.deepEquals(pe.charts, {abc: noop})

  pe.removeChart("abc")
  t.deepEquals(pe.charts, {})
  t.end()
})

test("PointEmitter#addKey", function(t) {
  var pe = new PointEmitter(new MockIntervalLoader(), settings)
  pe.addChart("abc", noop)
  pe.addKey("abc", "key1")
  pe.addKey("abc", "key2")
  t.deepEquals(pe.keys, {key1: true, key2: true})
  t.end()
})

test("PointEmitter#addKey, PointEmitter#removeKey duplicate", function(t) {
  var pe = new PointEmitter(new MockIntervalLoader(), settings)
  pe.addChart("abc", noop)
  pe.addKey("abc", "key1")
  pe.addKey("abc", "key1")
  pe.removeKey("abc", "key1")
  t.deepEquals(pe.keys, {key1: true})

  pe.removeKey("abc", "key1")
  t.deepEquals(pe.keys, {})
  t.end()
})

test("PointEmitter#setRange", function(t) {
  test("change range", function(t) {
    var int = new MockIntervalLoader()
      , pe  = new PointEmitter(int, settings)
    pe.setRange(0, 10, 60000)
    t.equals(pe.start, 0)
    t.equals(pe.end, 10)
    t.equals(pe.delta, 60000)
    t.deepEquals(int.ops, [])
    pe.addChart("abc", noop)
    pe.updateKeys("abc", {add: ["key1"], remove: []})
    t.deepEquals(int.ops, [["loadMany", ["key1#60000"], 0, 10]])
    t.end()
  })

  test("change to live delta", function(t) {
    var int = new MockIntervalLoader()
      , pe  = new PointEmitter(int, settings)
    pe.setRange(0, 10, 1000)
    t.deepEquals(int.ops, [])
    t.ok(pe.channel)
    t.end()
  })

  t.end()
})

test("PointEmitter#getKeys", function(t) {
  var pe = new PointEmitter(new MockIntervalLoader(), settings)
  pe.addChart("abc", noop)
  pe.addKey("abc", "key1")
  pe.addKey("abc", "key2")
  t.deepEquals(pe.getKeys(), ["key1", "key2"])
  t.end()
})

test("PointEmitter#getLoaderKeys", function(t) {
  var pe = new PointEmitter(new MockIntervalLoader(), settings)
  pe.start = 0
  pe.end   = 3600000       // 1h window: a 1m delta fits, left untouched
  pe.delta = 60000
  pe.addChart("abc", noop)
  pe.addKey("abc", "key1")
  pe.addKey("abc", "key2")
  t.deepEquals(pe.getLoaderKeys(), ["key1#60000", "key2#60000"])
  t.end()
})

test("PointEmitter#loaderKey", function(t) {
  var pe = new PointEmitter(new MockIntervalLoader(), settings)
  // Delta fits the window: passed through unchanged.
  pe.start = 0
  pe.end   = 3600000
  pe.delta = 60000
  t.equals(pe.loaderKey("foo"), "foo#60000")

  // Delta wider than the window: clamped, and the KEY reflects the clamped delta
  // so the cache key matches the fetched resolution. This is the case the old
  // point-loader clamp got wrong — pinned 1h delta zoomed to a 30m window fetched
  // 15m data but cached it under the "#3600000" key, polluting later wide views.
  pe.start = 0
  pe.end   = 1800000       // 30m window
  pe.delta = 3600000       // pinned 1h
  t.equals(pe.loaderKey("foo"), "foo#900000") // 900000 = 30m/2 = 15m
  t.end()
})

test("PointEmitter.clampDelta", function(t) {
  var clampDelta = PointEmitter.clampDelta
  // Fits (delta <= half the window): unchanged.
  t.equals(clampDelta(60000, 0, 3600000), 60000)
  t.equals(clampDelta(900000, 0, 1800000), 900000, "exactly half the window is kept")
  // Wider than half the window: clamped down to half the window.
  t.equals(clampDelta(3600000, 0, 1800000), 900000, "1h delta on a 30m window -> 15m")
  // Never below the 1m minimum bucket, even when half the window is smaller.
  t.equals(clampDelta(60000, 0, 90000), 60000, "sub-2m window floors at 1m")
  t.equals(clampDelta(3600000, 0, 90000), 60000, "wide delta on a sub-2m window -> 1m floor")
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function MockIntervalLoader() {
  this.ops = []
}

MockIntervalLoader.prototype.loadMany = function(mkeys, start, end, callback) {
  this.ops.push(["loadMany", mkeys, start, end])
}

MockIntervalLoader.prototype.getData = function(mkey) { }

function EventSource() {}
EventSource.prototype.addEventListener = function(ev, listener) {}
