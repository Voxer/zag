var test        = require('tap').test
  , Channel     = require('../../../../client/js/models/channel/channel')
  , MockAPI     = require('./channel-api.mock')
  , EventSource = require('./event-source.mock')

Channel.inject(EventSource)

test("Channel", function(t) {
  var channel = new Channel(new MockAPI(), 1000, function() { t.fail() })
  t.equals(channel.delta, 1000)
  t.ok(channel.id)
  t.isa(channel.es, EventSource)
  t.deepEquals(channel.keys, [])
  t.end()
})

test("Channel#close", function(t) {
  var channel = new Channel(new MockAPI(), 1000, function() { t.fail() })
    , es      = channel.es
  t.equals(es.isClosed, false)
  channel.close()
  t.equals(es.isClosed, true)
  t.equals(channel.es, null)
  t.equals(channel.keys, null)
  t.equals(channel._onError, null)
  t.end()
})

test("Channel#url", function(t) {
  var channel = new Channel(new MockAPI(), 1000, function() { t.fail() })
  channel.id = "foo"
  t.equals(channel.url(), "/api/channels/foo?delta=1000")
  t.end()
})

test("Channel#setKeys", function(t) {
  var api     = new MockAPI()
    , channel = new Channel(api, 1000, function() { t.fail() })
  channel.setKeys(["a", "b"])
  t.deepEquals(channel.keys, ["a", "b"])
  channel.setKeys(["b", "c"])
  t.deepEquals(channel.keys, ["b", "c"])
  // duplicate does nothing
  channel.setKeys(["b", "c"])
  t.deepEquals(channel.keys, ["b", "c"])
  t.deepEquals(api.ops,
    [ ["setChannelMetrics", channel.id, {add: ["a", "b"], remove: []}]
    , ["setChannelMetrics", channel.id, {add: ["c"],      remove: ["a"]}]
    ])
  t.end()
})

test("Channel#updateKeys", function(t) {
  var api     = new MockAPI()
    , channel = new Channel(api, 1000, function() { t.fail() })
  channel.updateKeys(["a"], [])
  t.deepEquals(channel.keys, ["a"])
  channel.updateKeys(["b"], [])
  t.deepEquals(channel.keys, ["a", "b"])
  channel.updateKeys([], ["a"])
  t.deepEquals(channel.keys, ["b"])
  channel.updateKeys([], ["b"])
  t.deepEquals(channel.keys, [])
  channel.updateKeys([], []) // ([], []) :: noop
  t.deepEquals(channel.keys, [])

  t.deepEquals(api.ops,
    [ ["setChannelMetrics", channel.id, {add: ["a"], remove: []}]
    , ["setChannelMetrics", channel.id, {add: ["b"], remove: []}]
    , ["setChannelMetrics", channel.id, {add: [],    remove: ["a"]}]
    , ["setChannelMetrics", channel.id, {add: [],    remove: ["b"]}]
    ])
  t.end()
})

test("Channel 'init'", function(t) {
  test("no keys", function(t) {
    var api     = new MockAPI()
      , channel = new Channel(api, 1000, function() { t.fail() })
    t.deepEquals(api.ops, [])
    channel.es.emit("init")
    t.deepEquals(api.ops, [])
    t.end()
  })

  test("some keys", function(t) {
    var api     = new MockAPI()
      , channel = new Channel(api, 1000, function() { t.fail() })
    channel.setKeys(["a", "b", "c"])
    channel.es.emit("init")
    t.deepEquals(api.ops,
      [ ["setChannelMetrics", channel.id, {add: ["a", "b", "c"], remove: []}]
      , ["setChannelMetrics", channel.id, {add: ["a", "b", "c"]}]
      ])
    t.end()
  })

  t.end()
})

test("Channel 'point'", function(t) {
  var point   = {ts: 123, count: 5, key: "a"}
  var channel = new Channel(new MockAPI(), 1000, function(pt) {
    t.deepEquals(pt, point)
    t.end()
  })
  channel.es.emit("point", {data: JSON.stringify(point)})
})
