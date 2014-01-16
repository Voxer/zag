var EventEmitter = require('events').EventEmitter
  , ROOT = ""

module.exports = DedupKeyAPI

/// Between the Tree widget and the type resolution, the same metrics key is
/// often fetched multiple times at once. This dedups the API calls so that
/// the minimum number of requests are made.
///
/// api - APIClient
///
function DedupKeyAPI(api) {
  this.api     = api
  this.ee      = new EventEmitter()
  this.pending = {} // { String mkey : true }
}

DedupKeyAPI.prototype.getRootKeys = function(callback) {
  this.ee.once(ROOT, callback)
  if (this.pending[ROOT]) return
  this.pending[ROOT] = true

  var _this = this
  this.api.getRootKeys(function(fail, res) {
    _this.pending[ROOT] = false
    _this.ee.emit(ROOT, fail, res)
  })
}

DedupKeyAPI.prototype.getChildKeys = function(mkeys, callback) {
  var ee      = this.ee
    , pending = this.pending
    , res     = {}
    , total   = mkeys.length
    , missing = []

  for (var i = 0; i < mkeys.length; i++) {
    var mkey = mkeys[i]
    ee.once(mkey, listener.bind(null, mkey))
    if (!pending[mkey]) {
      missing.push(mkey)
      pending[mkey] = true
    }
  }

  // Only make the additional API call if there are keys that aren't
  // already being fetched.
  if (missing.length) {
    this.api.getChildKeys(missing, done)
  }

  function listener(mkey, fail, children) {
    if (fail) {
      callback(fail)
      total = -1
    }
    if (children) res[mkey] = children
    if (--total === 0) callback(null, res)
  }

  function done(fail, leafsByParent) {
    var parents = Object.keys(leafsByParent)
    for (var i = 0; i < parents.length; i++) {
      var parent = parents[i]
      pending[parent] = false
      ee.emit(parent, fail, leafsByParent[parent])
    }
  }
}

DedupKeyAPI.prototype.filterKeys = function(query, limit, callback) {
  this.api.filterKeys(query, limit, callback)
}

function merge(obj1, obj2) {
  var keys = Object.keys(obj2)
  for (var i = 0, l = keys.length; i < k; i++) {
    var k = keys[i]
    obj1[k] = obj2[k]
  }
  return l
}
