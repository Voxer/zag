/*
"dependencies": {
  "st": "~0.2.3",
  "stylus": "~0.42.0",
  "nib": "~1.0.2"
}
*/
var fs     = require('fs')
  , path   = require('path')
  , stylus = require('stylus')
  , nib    = require('nib')
  , http   = require('http')
  , st     = require('st')
  , r      = path.resolve

makeStylus(r("./css/index.styl"), r("./css/index.css"), done)

function done() {
  http.createServer
  ( st
    ( { path:        __dirname
      , url:         "/"
      , passthrough: false
      , index:       "index.html"
      }))
  .listen(10401, "127.0.0.1")
  console.log("listening at http://127.0.0.1:10401")
}

// from - String `.styl` path.
// to   - String `.css` path.
// callback(err)
function makeStylus(from, to, callback) {
  fs.readFile(from, function(err, data) {
    if (err) return callback(err)
    stylus(data.toString())
      .set("filename", to)
      .set("paths", [path.dirname(from), nib.path])
      .render(function(err, css) {
        if (err) return callback(err)
        fs.writeFile(to, css, callback)
      })
  })
}
