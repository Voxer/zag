module.exports =
  { applySubKeys: applySubKeys
  , sameSorted:   sameSorted
  , same:         same
  }

// Create a list of histogram metrics keys "key@subkey", using a base key.
//
// mkey    - String
// subkeys - [String]
//
// Returns [String]
function applySubKeys(mkey, subkeys) {
  var mkeys  = new Array(subkeys.length)
  for (var i = 0, l = subkeys.length; i < l; i++) {
    mkeys[i] = mkey + "@" + subkeys[i]
  }
  return mkeys
}

// Compare two lists of strings.
//
// Returns Boolean
function same(list1, list2) {
  if (list1.length !== list2.length) return false
  for (var i = 0; i < list1.length; i++) {
    if (list1[i] !== list2[i]) return false
  }
  return true
}

// Returns true if the lists are the `same` when sorted.
function sameSorted(list1, list2) {
  return same(list1.slice().sort(), list2.slice().sort())
}
