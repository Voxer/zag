var api = require('../api')
  , all

module.exports = TagType

function TagType(opts) {
  this.id    = opts.id
  this.name  = opts.name
  this.color = opts.color
}

// callback(fail, [TagType]
TagType.load = function(callback) {
  if (all) return callback(null, all)
  api.getTagTypes(function(fail, tagtypes) {
    callback(fail, all = tagtypes && tagtypes.map(makeTagType))
  })
}

function makeTagType(opts) { return new TagType(opts) }
