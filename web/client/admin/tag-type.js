module.exports = TagTypeAdmin

function TagTypeAdmin(api) { this.api = api }

TagTypeAdmin.prototype.help =
  [ "list"
  , "create <#color> <name>"
  , "delete <tagID>"
  ]

TagTypeAdmin.prototype.list = function() {
  this.api.getTagTypes(function(err, tagtypes) {
    if (err) throw err
    for (var i = 0; i < tagtypes.length; i++) {
      var tt = tagtypes[i]
      console.log(tt.id + "\t" + tt.color + "\t'" + tt.name + "'")
    }
  })
}

// args - [String color, String name]
TagTypeAdmin.prototype.create = function(args) {
  var color = args[0]
    , name  = args[1]
  if (!color || !name) return 1

  this.api.createTagType(
  { color: color
  , name:  name
  }, done)
}

// args - [String tagID]
TagTypeAdmin.prototype.delete = function(args) {
  var tagID = args[0]
  if (!tagID) return 1
  this.api.deleteTagType(tagID, done)
}

function done(err) { if (err) throw err }
