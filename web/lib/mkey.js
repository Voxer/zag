var reKey = /^([^@']+)(@[^@']+)?$/
  , reSep = /[>|]/

// Parse a complex metrics key.
//
// One of:
//
//   "metrics_key"
//   "metrics_key@subkey"
//   "{ .. function .. }"
//
// Examples:
//
//   mkey("metrics_keys@mean")
//   // => {key: "metrics_keys", subkey: "mean"}
//
// Returns `{key, subkey}` or {fn}.
var Parse = module.exports = function(fullkey) {
  if (isFunction(fullkey)) return { fn: fullkey }
  var match = reKey.exec(fullkey)
  return { key:    match[1]
         , subkey: match[2] && match[2].slice(1)
         }
}

Parse.base       = base
Parse.subkey     = getSubKey
Parse.setSubKey  = setSubKey
Parse.toPath     = keyToPath
Parse.toParts    = keyToParts
Parse.parent     = keyParent
Parse.isFunction = isFunction

// Get the base key.
function base(mkey) { return Parse(mkey).key || null }

function getSubKey(mkey) { return Parse(mkey).subkey || null}

// mkey   - String
// subkey - String
// Returns String key
function setSubKey(mkey, subkey) {
  var key = Parse(mkey)
  return key.fn || (key.key + "@" + subkey)
}

// Get the path to the mkey.
//
// mkey - String
//
// Examples:
//
//   > keyToPath("alpha>beta|gamma")
//   ["alpha", "alpha>beta", "alpha>beta|gamma"]
//
// Returns [String]
function keyToPath(mkey) {
  var path = []
    , iG = mkey.indexOf(">")
    , iP = mkey.indexOf("|")
    , g1 = iG === -1
    , p1 = iP === -1

  while (!g1 || !p1) {
    if (g1 || (!p1 && iP < iG)) {
        path.push(mkey.slice(0, iP))
        iP = mkey.indexOf("|", iP + 1)
        p1 = iP === -1
    } else if (p1 || (!g1 && iG < iP)) {
        path.push(mkey.slice(0, iG))
        iG = mkey.indexOf(">", iG + 1)
        g1 = iG === -1
    }
  }
  path.push(mkey)
  return path
}
//
// This is the old implementation of keyToPath for, clarity's sake.
// The new version is ~20% faster, but much less readable.
//
// function keyToPath(mkey) {
//   var path = []
//     , char
//   for (var i = 0, l = mkey.length; i < l; i++) {
//     char = mkey[i]
//     if (char === "|" || char === ">") {
//       path.push(mkey.slice(0, i))
//     }
//   }
//   path.push(mkey)
//   return path
// }
//


// Split the mkey into it's parts.
//
// mkey - String
//
// Examples:
//
//   > keyToParts("alpha>beta|gamma")
//   ["alpha", "beta", "gamma"]
//
// Returns [String]
function keyToParts(mkey) { return mkey.split(reSep) }

// Get the parent key. If the key is top-level, return null.
//
// mkey - String
//
// Examples:
//
//   > parent("alpha")
//   null
//   > parent("alpha>beta")
//   "alpha"
//   > parent("alpha>beta|gamma")
//   "alpha>beta"
//
// Returns String or null.
function keyParent(mkey) {
  var path    = keyToPath(mkey)
    , pathLen = path.length
  return pathLen === 1 ? null : path[pathLen - 2]
}

// mkey - String
// Returns Boolean
function isFunction(mkey) {
  return "{" === mkey[0]
      && "}" === mkey[mkey.length - 1]
}
