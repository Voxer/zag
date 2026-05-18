var test  = require('tap').test
  , parse = require('../../../../app/metrics/function/parser')

test("simple call with one key arg", function(t) {
  t.deepEquals(parse("{rate(requests)}"),
    { type: "call", op: "rate", args:
      [ { type: "key", key: "requests", subkey: null } ]
    })
  t.end()
})

test("key with subkey", function(t) {
  t.deepEquals(parse("{rolling_mean(latency@p95, 3600000)}"),
    { type: "call", op: "rolling_mean", args:
      [ { type: "key", key: "latency", subkey: "p95" }
      , { type: "number", value: 3600000 }
      ]
    })
  t.end()
})

test("hierarchical/tagged key", function(t) {
  t.deepEquals(parse("{rate(notifications>gcm>sent_type|image)}"),
    { type: "call", op: "rate", args:
      [ { type: "key", key: "notifications>gcm>sent_type|image", subkey: null } ]
    })
  t.end()
})

test("ratio of two keys", function(t) {
  t.deepEquals(parse("{ratio(requests_ok, requests_err)}"),
    { type: "call", op: "ratio", args:
      [ { type: "key", key: "requests_ok", subkey: null }
      , { type: "key", key: "requests_err", subkey: null }
      ]
    })
  t.end()
})

test("nested call", function(t) {
  t.deepEquals(parse("{zscore(rate(requests), 3600000)}"),
    { type: "call", op: "zscore", args:
      [ { type: "call", op: "rate", args:
          [ { type: "key", key: "requests", subkey: null } ]
        }
      , { type: "number", value: 3600000 }
      ]
    })
  t.end()
})

test("whitespace tolerance", function(t) {
  t.deepEquals(parse("{ zscore(  latency@p95 ,  3600000 ) }"),
    { type: "call", op: "zscore", args:
      [ { type: "key", key: "latency", subkey: "p95" }
      , { type: "number", value: 3600000 }
      ]
    })
  t.end()
})

test("negative numbers", function(t) {
  t.deepEquals(parse("{delta(requests, -60000)}"),
    { type: "call", op: "delta", args:
      [ { type: "key", key: "requests", subkey: null }
      , { type: "number", value: -60000 }
      ]
    })
  t.end()
})

test("decimal numbers", function(t) {
  t.deepEquals(parse("{rolling_stddev(latency, 1.5)}"),
    { type: "call", op: "rolling_stddev", args:
      [ { type: "key", key: "latency", subkey: null }
      , { type: "number", value: 1.5 }
      ]
    })
  t.end()
})

// tap 0.4's t.throws doesn't accept regex matchers, so use try/catch.
function throwsLike(t, fn, pattern, msg) {
  try { fn() } catch (e) {
    t.ok(pattern.test(e.message), msg + " — got: " + e.message)
    return
  }
  t.fail(msg + " — did not throw")
}

test("rejects unknown operator", function(t) {
  throwsLike(t, function() { parse("{foo(bar)}") }, /unknown operator: foo/,
    "unknown op")
  t.end()
})

test("rejects missing wrapper", function(t) {
  throwsLike(t, function() { parse("rate(bar)") }, /not a function-key/,
    "missing wrapper")
  t.end()
})

test("rejects bare key at root", function(t) {
  // Root must be a call, not a bare key (which would be a normal series query,
  // routed by the loader without going through the function parser).
  throwsLike(t, function() { parse("{requests}") }, /root must be a call/,
    "bare key at root")
  t.end()
})

test("rejects malformed: missing close paren", function(t) {
  throwsLike(t, function() { parse("{rate(bar}") }, /expected '\)'/,
    "missing )")
  t.end()
})

test("rejects malformed: trailing junk", function(t) {
  throwsLike(t, function() { parse("{rate(bar))}") }, /trailing junk/,
    "trailing junk")
  t.end()
})

test("zero-arg call parses (arity is the evaluator's job)", function(t) {
  t.deepEquals(parse("{rate()}"),
    { type: "call", op: "rate", args: [] })
  t.end()
})

test("rejects empty key inside arg list", function(t) {
  // Trailing comma yields an empty key, which IS the parser's job to reject.
  throwsLike(t, function() { parse("{ratio(foo,)}") }, /empty key/,
    "empty trailing arg")
  t.end()
})

test("rejects key containing parens (V1 restriction)", function(t) {
  // Storage keys may legally contain `(` `)` but function-keys can't yet.
  // The parser stops at `)` and treats `weird` as a complete key, then
  // the dangling `(suffix)` fails to parse at the outer call level.
  throwsLike(t, function() { parse("{rate(weird(suffix))}") }, /./,
    "paren in key")
  t.end()
})
