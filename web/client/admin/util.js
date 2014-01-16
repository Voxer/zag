var stdout = process.stdout

module.exports =
  { stdin: getStdin
  , table: table
  }

function getStdin(callback) {
  var bufs = []
    , isDone
  process.stdin.on("data", function(buf) { bufs.push(buf) })
  process.stdin.on("end", done)
  process.stdin.on("error", done)
  process.stdin.resume()

  function done(err) {
    if (isDone) return
    isDone = true
    callback(err, Buffer.concat(bufs))
  }
}

function table(rows) {
  var cols   = rows[0].length
    , widths = new Array(cols)
    , len    = rows.length
    , limit  = stdout.isTTY ? stdout.columns : undefined

  for (var r = 0; r < len; r++) {
    var row = rows[r]
    for (var c = 0; c < cols; c++) {
      var l = row[c] ? row[c].length : 0
      if (!widths[c] || l > widths[c]) { widths[c] = l; }
    }
  }

  var table_rows = new Array(len)
  for (var r2 = 0; r2 < len; r2++) {
    var row2   = rows[r2],
        tblRow = ""
    for (var c2 = 0; c2 < cols; c2++) {
      tblRow += padR(row2[c2] || "", widths[c2]) + " "
    }
    table_rows[r2] = tblRow.slice(0, limit)
  }
  table_rows[0] = bold(table_rows[0])
  return table_rows
}

function bold(str) { return '\x1B[1m' + str + '\x1B[22m' }

function padR(val, n) {
  var str = val.toString()
  while (str.length < n) str += " "
  return str
}
