module.exports = DeltaList

/// Maintain a set of numbers for each metrics key.
/// Most of the time a metric only needs to track the default delta, 60000.
/// When a live metric is registered, though, it may have other values.
///
/// defaultI - Integer
///
function DeltaList(defaultI) {
  this.deltas      = {} // { mkey : [Integer] }
  this.defaultI    =  defaultI
  this.defaultList = [defaultI]
}

// mkey - String
// Returns [Integer]
DeltaList.prototype.get = function(mkey) {
  return this.deltas[mkey] || this.defaultList
}

// mkey  - String
// delta - Integer
DeltaList.prototype.add = function(mkey, delta) {
  if (delta === this.defaultI) return
  var deltas = this.deltas[mkey]
  if (deltas) {
    if (deltas.indexOf(delta) === -1) {
      deltas.push(delta)
    }
  } else {
    this.deltas[mkey] = [this.defaultI, delta]
  }
}

// mkey  - String
// delta - Integer
DeltaList.prototype.remove = function(mkey, delta) {
  if (delta === this.defaultI) return
  var deltas = this.deltas[mkey]
  if (!deltas) return

  var index = deltas.indexOf(delta)
  if (index === -1) return

  // 1 is 60000, the other is being removed.
  if (deltas.length === 2) {
    delete this.deltas[mkey]
  } else {
    deltas.splice(index, 1)
  }
}

// Returns Integer, number of keys being listened to.
DeltaList.prototype.size = function() {
  return Object.keys(this.deltas).length
}
