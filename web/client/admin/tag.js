module.exports = TagAdmin

function TagAdmin(api) { this.api = api }

TagAdmin.prototype.help =
  [ "list [begin [end]]"
  , "create <#color> <label> [timestamp]"
  , "delete <id>"
  ]

// args - [Integer start?, Integer end??]
TagAdmin.prototype.list = function(args) {
  var start = args[0] ? +args[0] : (Date.now() - 24*60*60*1000)
    , end   = args[1] ? +args[1] :  Date.now()
  if (isNaN(start) || isNaN(end)) return 1

  this.api.getTags(start, end, function(err, tags) {
    if (err) throw err
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i]
      console.log(tag.ts + "\t" + tag.color + "\t" + tag.id + "\t'" + tag.label + "'")
    }
  })
}

// args - [String color, String label, Integer timestamp?]
TagAdmin.prototype.create = function(args) {
  var color = args[0]
    , label = args[1]
    , ts    = args[2] ? +args[2] : Date.now()

  if (!color || !label || isNaN(ts)) return 1

  this.api.createTag(
  { color: color
  , label: label
  , ts:    ts
  }, done)
}

// args - [String id]
TagAdmin.prototype.delete = function(args) {
  var id = args[0]
  if (!id) return 1
  this.api.deleteTag(id, done)
}

function done(err) { if (err) throw err }
