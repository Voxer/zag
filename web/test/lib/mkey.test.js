var test = require('tap').test
  , mkey = require('../../lib/mkey')

test("mkey()", function(t) {
  // simple
  t.deepEquals(mkey("foo"),
    { key:    "foo"
    , subkey: undefined
    })
  // subkey
  t.deepEquals(mkey("foo@mean"),
    { key:    "foo"
    , subkey: "mean"
    })
  t.deepEquals(mkey("q@mean"),
    { key:    "q"
    , subkey: "mean"
    })
  t.end()
})

test("base", function(t) {
  t.equals(mkey.base("foo"), "foo")
  t.equals(mkey.base("foo|bar"), "foo|bar")
  t.equals(mkey.base("foo>bar"), "foo>bar")
  t.equals(mkey.base("foo@mean"), "foo")
  t.equals(mkey.base("foo|bar@mean"), "foo|bar")
  t.equals(mkey.base("foo>bar@mean"), "foo>bar")
  t.equals(mkey.base("{foo@mean} / {bar@p99}"), null)
  t.end()
})

test("subkey", function(t) {
  t.equals(mkey.subkey("foo"), null)
  t.equals(mkey.subkey("foo|bar"), null)
  t.equals(mkey.subkey("foo>bar"), null)
  t.equals(mkey.subkey("foo@mean"), "mean")
  t.equals(mkey.subkey("foo|bar@mean"), "mean")
  t.equals(mkey.subkey("foo>bar@mean"), "mean")
  t.equals(mkey.subkey("{{foo@mean} / {bar@p99}}"), null)
  t.end()
})

test("setSubKey", function(t) {
  t.equals(mkey.setSubKey("foo", "mean"), "foo@mean")
  t.equals(mkey.setSubKey("foo@p99", "mean"), "foo@mean")
  t.equals(mkey.setSubKey("{{foo} / {bar}}", "mean"), "{{foo} / {bar}}")
  t.end()
})

test("toPath", function(t) {
  t.deepEquals(mkey.toPath("foo"), ["foo"])
  t.deepEquals(mkey.toPath("foo>bar"), ["foo", "foo>bar"])
  t.deepEquals(mkey.toPath("foo|bar"), ["foo", "foo|bar"])
  t.deepEquals(mkey.toPath("alpha>beta|gamma"), ["alpha", "alpha>beta", "alpha>beta|gamma"])
  t.end()
})

test("toParts", function(t) {
  t.deepEquals(mkey.toParts("foo"), ["foo"])
  t.deepEquals(mkey.toParts("foo>bar"), ["foo", "bar"])
  t.deepEquals(mkey.toParts("foo|bar"), ["foo", "bar"])
  t.deepEquals(mkey.toParts("alpha>beta|gamma"), ["alpha", "beta", "gamma"])
  t.end()
})

test("parent", function(t) {
  t.deepEquals(mkey.parent("foo"), null)
  t.deepEquals(mkey.parent("foo>bar"), "foo")
  t.deepEquals(mkey.parent("foo|bar"), "foo")
  t.deepEquals(mkey.parent("alpha>beta|gamma"), "alpha>beta")
  t.deepEquals(mkey.parent("alpha|beta>gamma"), "alpha|beta")
  t.end()
})

test("isFunction", function(t) {
  var isFn = mkey.isFunction
  t.equals(isFn("foo"), false)
  t.equals(isFn("{{foo} / {bar}}"), true)
  t.end()
})
