var parseMKey = require('../../../lib/mkey')

/// Function-key syntax (server-side, Phase 2):
///
///   {op(arg1, arg2, ...)}
///
/// The `{...}` wrapper is the existing isFunction signal (web/lib/mkey.js).
/// Inside the braces the syntax is a named-operator call. Args may be:
///
///   * a metric key, possibly with @subkey: `latency`, `latency@p95`,
///     `notifications>gcm>sent_type|image`
///   * a numeric literal (typically a millisecond window): `3600000`
///   * a nested function call: `zscore(rate(requests), 3600000)`
///
/// Restrictions in this V1:
///   * The operator name must be one of OPERATORS below. Anything else is a
///     parse error so a typo doesn't get treated as a bare key.
///   * Bare key args cannot contain `(`, `)`, or `,`. Storage keys with those
///     chars (rare; allowed by the daemon's key regex) cannot be used inside
///     function-keys until we add quoted-key syntax.
///
/// AST node shapes:
///   { type: "call",   op: String, args: [Node, ...] }
///   { type: "key",    key: String, subkey: String|null }
///   { type: "number", value: Number }
///
module.exports = parse
module.exports.OPERATORS = OPERATORS

var OPERATORS =
  { rate:           true
  , delta:          true
  , rolling_mean:   true
  , rolling_sum:    true
  , rolling_stddev: true
  , zscore:         true
  , ratio:          true
  }

// fullkey - String, the full mkey including the {...} wrapper.
// Returns AST root, or throws SyntaxError on malformed input.
function parse(fullkey) {
  if (!parseMKey.isFunction(fullkey)) {
    throw new SyntaxError("not a function-key: " + fullkey)
  }
  var src = fullkey.slice(1, -1) // strip {}
  var p = new Parser(src)
  var ast = p.parseExpr()
  p.skipWS()
  if (p.pos !== src.length) {
    throw new SyntaxError("trailing junk at " + p.pos + " in: " + src)
  }
  if (ast.type !== "call") {
    throw new SyntaxError("function-key root must be a call, got " + ast.type)
  }
  return ast
}

function Parser(src) {
  this.src = src
  this.pos = 0
}

Parser.prototype.parseExpr = function() {
  this.skipWS()
  // A call iff the next token is `<ident>(`.
  var save = this.pos
  var ident = this.readIdent()
  if (ident !== null && this.peek() === "(") {
    if (!OPERATORS.hasOwnProperty(ident)) {
      throw new SyntaxError("unknown operator: " + ident)
    }
    return this.parseCallTail(ident)
  }
  this.pos = save
  // Number iff it looks numeric at this position. Otherwise treat as a key.
  if (looksNumeric(this.src, this.pos)) return this.parseNumber()
  return this.parseKey()
}

Parser.prototype.parseCallTail = function(op) {
  this.expect("(")
  var args = []
  this.skipWS()
  if (this.peek() !== ")") {
    args.push(this.parseExpr())
    while (this.skipWS(), this.peek() === ",") {
      this.pos++
      args.push(this.parseExpr())
    }
  }
  this.skipWS()
  this.expect(")")
  return { type: "call", op: op, args: args }
}

Parser.prototype.parseNumber = function() {
  var start = this.pos
  if (this.src[this.pos] === "-") this.pos++
  while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos])) this.pos++
  if (this.src[this.pos] === ".") {
    this.pos++
    while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos])) this.pos++
  }
  var raw = this.src.slice(start, this.pos)
  var n = Number(raw)
  if (raw === "" || raw === "-" || isNaN(n)) {
    throw new SyntaxError("invalid number at " + start + ": " + raw)
  }
  return { type: "number", value: n }
}

Parser.prototype.parseKey = function() {
  var start = this.pos
  while (this.pos < this.src.length) {
    var c = this.src[this.pos]
    if (c === "," || c === "(" || c === ")") break
    this.pos++
  }
  var raw = this.src.slice(start, this.pos).replace(/\s+$/, "")
  if (raw.length === 0) {
    throw new SyntaxError("empty key at " + start)
  }
  var parts = parseMKey(raw)
  // parseMKey returns {fn} for `{...}`-wrapped strings — we already stripped
  // the outer wrapper, so a nested wrapped key would mean the user nested a
  // function-key as a bare arg, which they shouldn't. Reject explicitly.
  if (parts.fn) throw new SyntaxError("nested {} not allowed as key arg: " + raw)
  return { type: "key", key: parts.key, subkey: parts.subkey || null }
}

Parser.prototype.readIdent = function() {
  this.skipWS()
  var start = this.pos
  if (!/[a-z_]/i.test(this.src[this.pos] || "")) return null
  while (this.pos < this.src.length && /[a-z0-9_]/i.test(this.src[this.pos])) this.pos++
  return this.src.slice(start, this.pos)
}

Parser.prototype.peek = function() { return this.src[this.pos] }

Parser.prototype.skipWS = function() {
  while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++
}

Parser.prototype.expect = function(ch) {
  if (this.src[this.pos] !== ch) {
    throw new SyntaxError("expected '" + ch + "' at " + this.pos + " in: " + this.src)
  }
  this.pos++
}

// True if a number could begin at src[pos]. Used to disambiguate keys from
// numeric args; checks for an optional `-` followed by a digit.
function looksNumeric(src, pos) {
  var c = src[pos]
  if (c === "-") return /[0-9]/.test(src[pos + 1] || "")
  return /[0-9]/.test(c || "")
}
