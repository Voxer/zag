var parseMKey = require('../../../lib/mkey')
  , CACHE     = {} // { String : MetricsFunction }

module.exports = MetricsFunction

///
/// mkey - String "{expression}"
///
function MetricsFunction(mkey) {
  var expr  = mkey.slice(1, -1)
  this.mkey = mkey
  this.fn   = parseFunction(expr)
  this.args = parseArgs(expr)
}

// Returns MetricsFunction
MetricsFunction.get = function(mkey) {
  return CACHE[mkey] || (CACHE[mkey] = new MetricsFunction(mkey))
}

// Compute a function of multiple metrics.
// Doesn't support sparse points or llquantize data.
//
// pointsByMKey - { mkey : points }
//
// Returns [{ts, count}]
MetricsFunction.prototype.process = function(pointsByMKey) {
  var results = []
    , args    = this.args
    , fn      = this.fn
    , points1 = pointsByMKey[args[0]]
  for (var i = 0; i < points1.length; i++) {
    var params = {}
    for (var j = 0; j < args.length; j++) {
      var mkey = args[j]
        , pt   = pointsByMKey[mkey][i]
      if (!pt) return results
      params[mkey] = pt
    }
    results.push(
      { ts:    points1[i].ts
      , count: fn(params)
      })
  }
  return results
}

// Returns Function
function parseFunction(expr) {
  return new Function("args"
    , "return ("
    +   expr.replace(/@(\w+)}/g,   "}.$1")      // subkey
            .replace(/}([^.]|$)/g, "}.count$1") // default subkey
            .replace(/[{]/g,       "args['")
            .replace(/[}]/g,       "']")
    + ")")
}

// Returns [String]
function parseArgs(expr) {
  var args   = {} // { mkey : true }
    , reArgs = /[{]([^{}]+)[}]/g
    , match
  while (match = reArgs.exec(expr)) {
    args[parseMKey.base(match[1])] = true
  }
  return Object.keys(args)
}
