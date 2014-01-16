module.exports = function(all, exclude) {
  var some  = []
    , exSet = arrayToSet(exclude)
  for (var i = 0; i < all.length; i++) {
    var item = all[i]
    if (!exSet[item]) some.push(item)
  }
  return some
}

function arrayToSet(arr) {
  var set = {}
  for (var i = 0, l = arr.length; i < l; i++) set[arr[i]] = true
  return set
}
