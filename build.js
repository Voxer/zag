#!/usr/bin/env node

/*
"dependencies": {
  "st": "~0.2.3",
  "stylus": "~0.42.0",
  "nib": "~1.0.2",
  "marked": "~0.3.1"
}
*/
var fs     = require('fs')
  , path   = require('path')
  , http   = require('http')
  , stylus = require('stylus')
  , nib    = require('nib')
  , marked = require('marked')
  , st     = require('st')
  , r      = path.resolve
  , reTmpl = /{{([^{}]*)}}/g
  , reGif  = /\.gif$/
  , left   = 2

makeStylus(r("./template/index.styl"), r("./index.css"), done)
makeHTML(r("./template/index.html"), r("./template/index.md"), r("./index.html"), done)

function done(err) {
  if (err) throw err
  if (--left > 0) return
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

function makeHTML(fromHTML, fromMarkdown, to, callback) {
  var html = fs.readFileSync(fromHTML).toString()
    , md   = fs.readFileSync(fromMarkdown).toString()
  fs.writeFile(to,
    html.replace("{body}", marked(md))
        .replace(reTmpl, template), callback)
}

function template(match, inner) { return eval(inner) }

///
/// Helpers
///

function feature(img, label, href) {
  var gif = ""
  if (reGif.test(img)) {
    img = img.replace(reGif, ".png")
    gif = '<button class="feature-play-gif">&#9654;</button>'
  }
  return '<div class="feature feature-png">'
       +   (href ? '<a class="feature-link" href="' + href + '">' : '')
       +     '<img class="feature-image" src="' + img + '" alt="' + label + '"/>'
       +     '<p class="feature-label">' + label + '</p>'
       +   (href ? '</a>' : '')
       +   gif
       + '</div>'
}
