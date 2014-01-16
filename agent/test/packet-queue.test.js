var test        = require('tap').test
  , PacketQueue = require('../lib/packet-queue')

function noop() {}

test("PacketQueue", function(t) {
  var pq = new PacketQueue(noop, {block: 10})
  t.equals(pq.send, noop)
  t.equals(pq.blockSize, 10)
  t.deepEquals(pq.queue, [])
  t.end(); pq.destroy()
})

test("PacketQueue#reset", function(t) {
  var pq = new PacketQueue(noop, {block: 10})
  pq.queue.push("foo")
  pq.reset()
  t.deepEquals(pq.queue, [])
  t.end(); pq.destroy()
})

test("PacketQueue#write", function(t) {
  test("queue", function(t) {
    var pq  = new PacketQueue(function() { t.fail() }, {block: 30})
      , pos = pq.writePos
    pq.write("12345")
    t.deepEquals(pq.queue, ["12345"])
    t.equals(pq.writePos, pos + 6)
    t.end(); pq.destroy()
  })

  test("flush", function(t) {
    var blockSize = 30
      , w  = 0
      , pq = new PacketQueue(send, {block: blockSize, flush: 10})
    pq.write("123")
    pq.write("456")
    setTimeout(function() {
      t.equals(w, 1)
      t.end(); pq.destroy()
    }, 15)

    function send(data, offset, len) {
      w++
      t.deepEquals(data.toString(), "123\n456")
      t.equals(offset, 0)
      t.equals(len, data.length)
    }
  })

  test("overflow", function(t) {
    var pq = new PacketQueue(send, {block: 9})
    pq.write("123")
    pq.write("456")
    pq.write("789")

    function send(data, offset, len) {
      t.deepEquals(data.toString(), "123\n456")
      t.equals(offset, 0)
      t.equals(len, "123456".length + 1)
      process.nextTick(function() {
        t.deepEquals(pq.queue, ["789"])
        t.end(); pq.destroy()
      })
    }
  })

  t.end()
})
