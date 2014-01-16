var TagDialog = require('./views/tag-dialog')
  , Tag       = require('../models/tag')
  , TagType   = require('../models/tag-type')
  , dialog

function noop() {}

// The user wants a tag created at the given point in time.
//
// timestamp     - Integer
// callback(tag) - optional
//
exports.createAt = function(timestamp, callback) {
  dialog && dialog.destroy()
  TagType.load(function(fail, tagtypes) {
    if (fail) return console.error("TagType.load", fail)
    dialog = new TagDialog(
      { tagtypes: tagtypes
      , ts:       timestamp
      , callback:
        function(opts) {
          var tag = new Tag(opts, true)
          tag.save(noop)
          callback && callback(tag)
        }
      })
  })
}

// Modify a tag.
//
// tag - Tag
//
exports.edit = function(tag) {
  dialog && dialog.destroy()
  TagType.load(function(fail, tagtypes) {
    if (fail) return console.error("TagType.load", fail)
    dialog = new TagDialog(
      { tagtypes: tagtypes
      , ts:       tag.ts
      , label:    tag.label
      , color:    tag.color
      , callback:
        function(tag_opts) {
          // Disallow blank label.
          if (!tag_opts.label) return
          // No change, dont update.
          if (tag_opts.label === tag.label
           && tag_opts.color === tag.color) {
            return
          }
          // Update the tag by deleting and re-creating it.
          tag.update(tag_opts, noop)
        }
      , delete:
        function() { tag.destroy(undefined, true) }
      })
  })
}
