var parse = require('./parser')
  , ops   = require('./operators')

/// Phase 2 function-key evaluator.
///
/// Dispatched from MetricsLoader.load when the requested key is a function-key
/// (matches isFunction in web/lib/mkey.js). Parses the expression, computes
/// the total look-back needed across the AST, fans out raw-series loads via
/// the loader (over-fetched by lookback so visible-range output has filled
/// windows), evaluates operators bottom-up, slices back to the visible range.
///
/// Output is a counter-shaped scalar series — `[{ts, count}]` — so the chart
/// pipeline can render derived series without learning a new type.
///
/// No caching of derived points. The underlying raw series are cached by
/// MetricsLoader's existing path; operator math is cheap; invalidation across
/// dependent function-keys is the kind of cross-key bookkeeping we agreed
/// to avoid in this phase.
///
/// loader   - MetricsLoader
/// fkey     - String function-key, including `{...}` wrapper
/// options  - {start, end, delta, nocacheR, nocacheW, abnormal}
/// callback - (err, points, type)
module.exports = evaluate

function evaluate(loader, fkey, options, callback) {
  var ast
  try {
    ast = parse(fkey)
    validateArity(ast)
  } catch (e) {
    return process.nextTick(function() { callback(e) })
  }

  var delta      = options.delta
    , lookbackMs = ops.lookback(ast, delta)
    , loadOpts   = mergeOpts(options, { start: options.start - lookbackMs })

  loadLeaves(loader, ast, loadOpts, function(err, byKey) {
    if (err) return callback(err)
    var derived
    try { derived = evalNode(ast, byKey, delta) }
    catch (e) { return callback(e) }
    var visible = sliceTo(derived, options.start, options.end)
    callback(null, visible.map(toCounterShape), "counter")
  })
}

// Walk the AST and confirm every call has the right number of args. Cheap;
// catches user-facing typos before any backend load happens.
function validateArity(node) {
  if (node.type !== "call") return
  var expected = ops.arity[node.op]
  if (node.args.length !== expected) {
    throw new Error(
      node.op + " expects " + expected + " arg(s), got " + node.args.length)
  }
  for (var i = 0; i < node.args.length; i++) validateArity(node.args[i])
}

////////////////////////////////////////////////////////////////////////////////
// Loading
////////////////////////////////////////////////////////////////////////////////

// Collect every distinct raw key referenced by the AST and load each once.
// Two key refs to the same storage key with different subkeys share the load.
function loadLeaves(loader, ast, loadOpts, callback) {
  var rawKeys = collectRawKeys(ast, {})
  var keys = Object.keys(rawKeys)
  var byKey = {}

  if (keys.length === 0) {
    return process.nextTick(function() { callback(null, byKey) })
  }

  var remaining = keys.length
    , firstErr  = null

  keys.forEach(function(rawKey) {
    loader.load(rawKey, loadOpts, function(err, points) {
      if (err && !firstErr) firstErr = err
      byKey[rawKey] = points || []
      if (--remaining === 0) callback(firstErr, byKey)
    })
  })
}

function collectRawKeys(node, out) {
  if (node.type === "key")  { out[node.key] = true; return out }
  if (node.type !== "call") return out
  for (var i = 0; i < node.args.length; i++) collectRawKeys(node.args[i], out)
  return out
}

////////////////////////////////////////////////////////////////////////////////
// Evaluation
////////////////////////////////////////////////////////////////////////////////

// evalNode returns either a scalar series (for "key" and "call" nodes) or a
// raw number (for "number" nodes — only meaningful as an operator argument).
function evalNode(node, byKey, delta) {
  if (node.type === "key") {
    return extractSubkey(byKey[node.key] || [], node.subkey || "count")
  }
  if (node.type === "number") return node.value
  if (node.type === "call") {
    var fn = ops[node.op]
    var argVals = []
    for (var i = 0; i < node.args.length; i++) {
      argVals.push(evalNode(node.args[i], byKey, delta))
    }
    argVals.push(delta) // operators take delta as their trailing arg
    return fn.apply(null, argVals)
  }
  throw new Error("unknown AST node type: " + node.type)
}

// Histogram points carry many fields ({count, mean, p95, std_dev, ...}); the
// operator API works on scalar {ts, value} series. Pull the subkey out here
// so the operators don't have to know about subkey semantics.
function extractSubkey(points, subkey) {
  var out = new Array(points.length)
  for (var i = 0; i < points.length; i++) {
    var p = points[i]
    if (p.empty || p[subkey] === undefined || p[subkey] === null) {
      out[i] = { ts: p.ts, empty: true }
    } else {
      out[i] = { ts: p.ts, value: p[subkey] }
    }
  }
  return out
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function sliceTo(points, start, end) {
  var out = []
  for (var i = 0; i < points.length; i++) {
    if (points[i].ts >= start && points[i].ts <= end) out.push(points[i])
  }
  return out
}

function toCounterShape(p) {
  return p.empty ? { ts: p.ts, empty: true } : { ts: p.ts, count: p.value }
}

function mergeOpts(base, overrides) {
  var out = {}
  for (var k in base) out[k] = base[k]
  for (var k2 in overrides) out[k2] = overrides[k2]
  return out
}
