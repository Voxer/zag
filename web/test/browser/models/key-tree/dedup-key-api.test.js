var test     = require('tap').test
  , DedupAPI = require('../../../../client/js/models/key-tree/dedup-key-api')
  , MockAPI  = require('./api.mock')

test("DedupAPI#getRootKeys", function(t) {
  var dd  = new DedupAPI(new MockAPI())
    , top = []

  dd.getRootKeys(done)
  dd.getRootKeys(done)
  dd.getRootKeys(done)

  function done(err, leafs) {
    if (err) throw err
    top.push(leafs)
    if (top.length === 3) {
      t.deepEquals(dd.pending, {"": false})
      t.equals(top[0], top[1])
      t.equals(top[0], top[2])
      again()
    }
  }

  function again() {
    dd.getRootKeys(function(err, leafs) {
      if (err) throw err
      t.deepEquals(dd.pending, {"": false})
      t.notEquals(leafs, top[0])
      t.end()
    })
  }
})

test("DedupAPI#getChildKeys dedup", function(t) {
  var dd  = new DedupAPI(new MockAPI())
    , res = []
  dd.getChildKeys(["a", "b", "c"], done)
  dd.getChildKeys(["a", "b", "d"], done)

  function done(fail, leafsByParent) {
    if (fail) throw fail
    res.push(leafsByParent)
    if (res.length < 2) return
    t.deepEquals(dd.pending, {a: false, b: false, c: false, d: false})
    t.equals(res[0].a, res[1].a)
    t.equals(res[0].b, res[1].b)
    t.ok(res[0].c || res[0].d); t.ok(res[1].c || res[1].d)
    t.ok(res[0].c || res[1].c); t.ok(res[0].d || res[1].d)
    t.end()
  }
})

test("DedupAPI#getChildKeys exact match", function(t) {
  var api = new MockAPI()
    , dd  = new DedupAPI(api)
    , res = []
  dd.getChildKeys(["a", "b"], done)
  api.getChildKeys = function() { throw new Error }
  dd.getChildKeys(["a", "b"], done)

  function done(fail, leafsByParent) {
    if (fail) throw fail
    res.push(leafsByParent)
    if (res.length < 2) return
    t.deepEquals(dd.pending, {a: false, b: false})
    t.equals(res[0].a, res[1].a)
    t.equals(res[0].b, res[1].b)
    t.end()
  }
})
