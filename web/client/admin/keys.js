var stdin = require('./util').stdin

// Bulk key deletion max concurrency.
var DELETE_CC    = 50
// Default key filter limit.
  , FILTER_LIMIT = 1000

module.exports = KeysAdmin

function KeysAdmin(api) { this.api = api }

KeysAdmin.prototype.help =
  [ "all                    List ALL keys. This might take a while."
  , "list [parent]          When parent is not provided, list root keys."
  , "filter <pattern> [max]"
  , "delete <key>           Recursive. Can bulk-delete a \\n-delimited keys via STDIN"
  ]

KeysAdmin.prototype.all = function() {
  this.api.getAllKeys(function(err, keys) {
    if (err) throw err
    for (var i = 0; i < keys.length; i++) {
      console.log(keys[i])
    }
  })
}

// args - [String parent?]
KeysAdmin.prototype.list = function(args) {
  var parent = args[0]
  if (!parent) {
    this.api.getRootKeys(printKeysCallback)
    return
  }
  this.api.getChildKeys(parent, function(err, mtree) {
    if (err) throw err
    var mkeys = mtree[parent]
    if (mkeys) printKeys(mkeys)
  })
}

KeysAdmin.prototype.ls = KeysAdmin.prototype.list

// args - [String pattern, Integer limit?]
KeysAdmin.prototype.filter = function(args) {
  var pattern = args[0]
    , limit   = args[1] ? +args[1] : FILTER_LIMIT
  if (!pattern || isNaN(limit)) return 1

  this.api.filterKeys(pattern, limit, printKeysCallback)
}

// args - [String mkey]
KeysAdmin.prototype.delete = function(args) {
  var mkey  = args[0]
    , _this = this
  if (mkey) this.api.deleteKey(mkey, done)
  else {
    stdin(function(err, data) {
      if (err) throw err
      _this.deleteMany(data.toString().trim().split("\n"))
    })
  }
}

// Internal: Bulk delete.
//
// This isn't terribly kind to the server.
KeysAdmin.prototype.deleteMany = function(mkeys) {
  var cc  = Math.min(DELETE_CC, mkeys.length)
    , api = this.api
  for (var i = 0; i < cc; i++) {
    var mkey = mkeys[i]
    if (mkey) api.deleteKey(mkey, next)
  }

  function next(err) {
    if (err) throw err
    var mkey = mkeys[i++]
    if (mkey === undefined) return
    api.deleteKey(mkey, next)
  }
}

function done(err) {
  if (err) throw err
}

function printKeysCallback(err, mkeys) {
  if (err) throw err
  printKeys(mkeys)
}

function printKeys(mkeys) {
  for (var i = 0; i < mkeys.length; i++) {
    console.log(mkeys[i].key)
  }
}
