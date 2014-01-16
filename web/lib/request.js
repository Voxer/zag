var http  = require('http')
  , https = require('https')
  , url   = require('url')
  , qs    = require('querystring')

// host - String "http://..."
module.exports = function(host) {
  var hostURL = url.parse(host)
    , module  = hostURL.protocol === "https://" ? https : http

  ///
  /// path    - String
  /// options - {method, parameters, body}
  /// callback(err, body)
  ///
  return function(path, options, callback) {
    if (options.parameters) {
      path += "?" + qs.stringify(options.parameters)
    }

    var done = once(callback)
    var req  = module.request(
      { hostname: hostURL.hostname
      , port:     hostURL.port
      , auth:     hostURL.auth
      , method:   options.method
      , path:     path
      }, function(res) { collect(res, done) })

    req.on("error", done)

    if (options.body) {
      req.end(options.body)
    } else req.end()
  }
}

function collect(stream, callback) {
  var bufs = []
  stream.on("error", callback)
  stream.on("data", function(buf) { bufs.push(buf) })
  stream.on("end", function() {
    callback(null, Buffer.concat(bufs).toString())
  })
}

function once(fn) {
  var ran
  return function(err, body) {
    if (ran) return
    ran = true
    fn(err, body)
  }
}
