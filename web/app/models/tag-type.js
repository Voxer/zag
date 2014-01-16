module.exports = TagTypeManager

var reColor = /^#([0-9a-f]{3}){1,2}$/i

/// A rough wrapper around `db` that caches the list of tag types.
///
/// A tag type is:
///   * id    - String
///   * color - String, e.g. "#ff0000"
///   * name  - String, a short description of the tag.
///
/// There shouldn't need to be more than a dozen or so tag types, and they
/// are only rarely modified.
///
/// db - Backend
///
function TagTypeManager(db) {
  this.db    = db
  this.cache = null
}

// Returns Boolean
TagTypeManager.isColor = function(str) {
  return str && reColor.test(str)
}

// callback(err, [{id, name, color}])
TagTypeManager.prototype.getTagTypes = function(callback) {
  if (this.cache) return callback(null, this.cache)
  var _this = this
  this.db.getTagTypes(function(err, tagtypes) {
    if (err) return callback(err)
    callback(null, _this.cache = tagtypes)
  })
}

// opts - {color, name}
// callback(err)
TagTypeManager.prototype.createTagType = function(opts, callback) {
  this.cache = null
  this.db.createTagType(opts, callback)
}

// typeID - String
// callback(err)
TagTypeManager.prototype.deleteTagType = function(typeID, callback) {
  this.cache = null
  this.db.deleteTagType(typeID, callback)
}
