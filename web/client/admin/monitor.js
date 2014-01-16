var table = require('./util').table

var HEADER = ["", "key", "value", "", "expected", "", "margin", "std_dev"]
  , FIELDS = {count: "C", mean: "M"}

module.exports = MonitorAdmin

function MonitorAdmin(api) { this.api = api }

MonitorAdmin.prototype.help =
  [ "json   Print warnings as JSON."
  , "table  Print a table of alerts every minute."
  ]

MonitorAdmin.prototype.json = function() {
  this.api.monitor(function(err, warnings) {
    if (err) throw err
    console.log(JSON.stringify(warnings, null, "  "))
  })
}

MonitorAdmin.prototype.table = function() {
  var api = this.api

  ;(function getWarnings() {
    api.monitor(onWarnings)
    setTimeout(getWarnings, 60000)
  })()

  function onWarnings(err, warnings) {
    if (err) throw err
    var rows = table([HEADER].concat(warnings.sort(byMKey).map(warningToRow)));
    console.log()
    for (var i = 0; i < rows.length; i++) {
      console.log(rows[i])
    }
  }
}

function warningToRow(warn) {
  return [ FIELDS[warn.field]
         , warn.mkey
         , warn.value.toFixed(1)
         , warn.cmp
         , warn.target.toFixed(1)
         , "+"
         , warn.margin.toFixed(1)
         , Math.sqrt(warn.margin).toFixed(1)
         ]
}

function byMKey(warnA, warnB) {
  var ak = warnA.mkey
    , bk = warnB.mkey
  return ak < bk ? -1
       : ak > bk ?  1
       : 0
}
