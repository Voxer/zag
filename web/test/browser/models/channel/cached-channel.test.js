var test          = require('tap').test
  , Channel       = require('../../../../client/js/models/channel/channel')
  , CachedChannel = require('../../../../client/js/models/channel/cached-channel')
  , MockAPI       = require('./channel-api.mock')
  , EventSource   = require('./event-source.mock')

Channel.inject(EventSource)

test("CachedChannel", function(t) {
  var channel = new CachedChannel(new MockAPI(), 1000, onPoint)
  t.isa(channel, Channel)
  t.equals(channel._onPoint, onPoint)
  t.deepEquals(channel._cache, {})
  t.equals(channel._max, 0)
  t.end()

  function onPoint() { t.fail() }
})

test("CachedChannel#close", function(t) {
  var channel = new CachedChannel(new MockAPI(), 1000, function() { t.fail() })
    , es      = channel.es
  channel.close()
  t.equals(es.isClosed, true)
  t.equals(channel._onPoint, null)
  t.equals(channel._cache, null)
  t.end()
})

test("CachedChannel#getData", function(t) {
  var channel = new CachedChannel(new MockAPI(), 1000, onPoint)
    , pt1     = {ts: 1, key: "a", count: 5}
    , pt2     = {ts: 1, key: "b", count: 6}
    , pt3     = {ts: 3, key: "a", count: 7}
    , pt4     = {ts: 2, key: "b", count: 8}
    , i       = 0
  channel.onLivePoint(pt1)
  channel.onLivePoint(pt2)
  channel.onLivePoint(pt3)
  channel.onLivePoint(pt4)
  t.deepEquals(channel.getData("a"), [pt1, pt3])
  t.deepEquals(channel.getData("b"), [pt2, pt4])
  t.equals(channel._max, 3)
  t.equals(i, 4)
  t.end()

  function onPoint(pt) { i++ }
})

test("CachedChannel#getMaxTime", function(t) {
  var channel = new CachedChannel(new MockAPI(), 1000, function() {})
  channel.onLivePoint({ts: 1, key: "a", count: 5})
  channel.onLivePoint({ts: 1, key: "b", count: 6})
  channel.onLivePoint({ts: 3, key: "a", count: 7})
  channel.onLivePoint({ts: 2, key: "b", count: 8})
  t.equals(channel.getMaxTime(), 3)
  t.end()
})

test("CachedChannel 'point'", function(t) {
  var pt      = {ts: 1, key: "a", count: 5}
    , channel = new CachedChannel(new MockAPI(), 1000, onPoint)
    , done
  channel.es.emit("point", {data: JSON.stringify(pt)})
  t.deepEquals(channel._cache, {a: [pt]})
  t.equals(channel._max, 1)
  t.ok(done)
  t.end()

  function onPoint(point) {
    t.deepEquals(point, pt)
    done = true
  }
})

test("CachedChannel#updateKeys", function(t) {
  var pt      = {ts: 1, key: "a", count: 5}
    , channel = new CachedChannel(new MockAPI(), 1000, onPoint)

  channel.updateKeys(["a"], [])
  channel.es.emit("point", {data: JSON.stringify(pt)})
  t.deepEquals(channel._cache, {a: [pt]})
  t.deepEquals(channel.keys, ["a"])

  channel.updateKeys([], ["a"])
  t.deepEquals(channel._cache, {})
  t.deepEquals(channel.keys, [])
  t.end()

  function onPoint(point) { }
})
