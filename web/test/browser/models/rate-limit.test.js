var test      = require('tap').test
  , RateLimit = require('../../../client/js/models/rate-limit')

test("RateLimit", function(t) {
  var rl = new RateLimit(fn, {max_cc: 4})
  t.equals(rl.ajax, fn)
  t.equals(rl.max_cc, 4)
  t.equals(rl.running, 0)
  t.deepEquals(rl.waiters, [])
  t.end()

  function fn() {}
})

test("RateLimit#get max_cc=1", function(t) {
  var running  = 0
    , complete = 0
    , total    = 10
    , rl       = new RateLimit(ajax, {max_cc: 1})

  for (var i = 0; i < total; i++) {
    rl.get("/foo", onComplete)
  }

  function onComplete() {
    running--
    if (++complete === total) t.end()
  }

  function ajax(url, callback) {
    t.equals(++running, 1)
    process.nextTick(callback)
  }
})

test("RateLimit#onChange", function(t) {
  var rl    = new RateLimit(ajax, {max_cc: 1, onChange: onChange})
    , total = 20
    , done  = 0
    , c     = 0

  for (var i = 0; i < total; i++) {
    rl.get("/foo", onComplete)
  }

  function onComplete() {
    if (++done < total) return
    t.equals(c, total * 2 - 1)
    t.end()
  }

  function onChange() { c++ }
  function ajax(url, callback) { process.nextTick(callback) }
})
