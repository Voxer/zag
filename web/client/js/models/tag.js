var api            = require('../api')
  , IntervalLoader = require('./interval-loader')
  , tagLoader      = new IntervalLoader(loadTags)

module.exports = Tag

/// Tags mark events at a certain point in time.
///
/// options:
///   * id    - String ID
///   * ts    - Integer timestamp (required)
///   * label - String (required)
///   * color - String (optional)
/// isNew - Boolean
///
function Tag(opts, isNew) {
  this.id    = opts.id || (Date.now() + "_" + digits(3))
  this.ts    = opts.ts
  this.label = opts.label
  this.color = opts.color || "#00ff00"

  // Insert into the sorted interval
  if (isNew) {
    var all   = Tag.all()
      , index = Tag.sortedIndex(all, opts, "ts")
    all.splice(index, 0, this)
  }
}

Tag.all = function() {
  var interval = tagLoader.get("tags")
  return interval ? interval.data : []
}

// Override this.
// It is called any time the tags change.
Tag.onChange = function() {}

// Get all the tags in the range. May include tags outside the range.
//
// begin - Integer timestamp.
// end   - Integer timestamp.
// callback(fail, tags)
//
Tag.load = function(begin, end, callback) {
  tagLoader.load("tags", begin, end, callback)
}

Tag.sortedIndex = function(objects, obj, prop) {
  var min = 0
    , max = objects.length
    , cmp = obj[prop]
  while (min < max) {
    var mid = Math.floor((min + max) / 2)
    if (objects[mid][prop] < cmp) min = mid + 1
    else                          max = mid
  }
  return min
}

Tag.prototype.toJSON = function() {
  return { id:    this.id
         , ts:    this.ts
         , label: this.label
         , color: this.color
         }
}

// Write the tag to the server.
Tag.prototype.save = function(callback) {
  api.createTag(this.toJSON(), callback)
  Tag.onChange()
}

// Delete the tag.
//
// callback(fail)
// really - Boolean. By default (false), dont remove the tag
//          from the UI, just from the database.
//          `true` when the user deletes the tag.
//          `false` when the user updates the tag.
//
Tag.prototype.destroy = function(callback, really) {
  api.deleteTag(this.id, callback)
  if (really) {
    var all = Tag.all()
    all.splice(all.indexOf(this), 1)
    Tag.onChange()
  }
}

// Update a tag by deleting it, updating the properties, then re-creating.
//
// tag_opts - Object {label, color}
// callback(fail)
//
Tag.prototype.update = function(tag_opts, callback) {
  this.destroy()
  this.label = tag_opts.label
  this.color = tag_opts.color
  this.save(callback)
}

function makeTag(opts) { return new Tag(opts) }

// key   - String, ignore it
// start - Integer timestamp
// end   - Integer timestamp
// callback(fail, tags)
function loadTags(key, start, end, callback) {
  api.getTags(Math.floor(start), Math.floor(end), function(fail, tags) {
    callback(fail, tags && tags.map(makeTag))
  })
}

function digits(n) {
  return Math.floor(Math.random() * Math.pow(10, n))
}
