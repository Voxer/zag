module.exports = EventSource

// This is a server-side implementation of the EventSource API.
//
// Resources:
//
//   * <http://www.w3.org/TR/eventsource/>
//   * <https://developer.mozilla.org/en-US/docs/Server-sent_events/Using_server-sent_events>
//   * <https://gist.github.com/a901a011eee32f756499>
//
// req     - ServerRequest
// res     - ServerResponse
// options - optional
//   * onClose   - Function
//   * timeout   - Integer, milliseconds.
//   * limit     - Integer, number of events.
//   * keepAlive - Boolean, default: false. If true, send some comment data
//     down the socket every 15 seconds to keep the connection from timing out.
//
function EventSource(req, res, options) {
  options       = options || {}
  this.res      = res
  this.limit    = options.limit   || 0
  this._onClose = options.onClose || noop

  var onClose = this.onClose.bind(this)
  res.on("aborted", onClose)
  res.on("close",   onClose)
  res.on("error",   onClose)
  res.on("end",     onClose)

  var timeout = options.timeout
  if (timeout) {
    setTimeout(this.end.bind(this), timeout)
  }

  res.writeHead(200,
    { "Content-Type":  "text/event-stream"
    , "Cache-Control": "no-cache"
    })

  // Emit an initial chunk to ensure that the headers are sent.
  // Then, send additional data every 15 seconds to keep the connection alive.
  if (options.keepAlive) {
    this.alive()
    this.interval = setInterval(this.alive.bind(this), 15000)
  }
}

// Send an 'event' down the event stream.
//
// type - String
// data - A JSON.stringify-able thing.
//
EventSource.prototype.emit = function(type, data) {
  this.res.write( "event: " + type + "\n"
                + "data: "  + JSON.stringify(data)
                + "\n\n")

  if (!--this.limit) {
    this.end()
  }
}

// Send a comment down the event stream.
//
// text - String
//
EventSource.prototype.comment = function(text) {
  this.res.write(":" + text + "\n\n")
}

// Excerpt from the W3 EventSource spec:
//
// > Legacy proxy servers are known to, in certain cases, drop HTTP connections
// > after a short timeout. To protect against such proxy servers, authors can
// > include a comment line (one starting with a ':' character) every 15
// > seconds or so.
//
// The text of the comment is not important.
//
EventSource.prototype.alive = function() { this.comment("keepalive") }

// Gracefully close the connection.
EventSource.prototype.end = function() {
  this.res.end()
  this.onClose()
}

// Clean up the connection.
EventSource.prototype.onClose = function() {
  this.interval && clearInterval(this.interval)
  this._onClose && this._onClose()
  this.interval = null
  this._onClose = null
}

function noop() {}
