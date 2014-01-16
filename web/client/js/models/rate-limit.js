module.exports = RateLimit

function noop() {}

/// Don't fire all the requests at once.
///
/// ajax(url, callback(fail, body))
///   Perform the actual AJAX request.
/// options -
///   max_cc - Integer, >0
///     The maximum concurrency, i.e. the max number of outstanding requests
///     before they start getting queued.
///   onChange() - Function
///     Called when the number of waiters changes.
///
function RateLimit(ajax, options) {
  this.ajax     = ajax
  this.running  = 0
  this.waiters  = []
  this.max_cc   = options.max_cc
  this.onChange = options.onChange || noop
}

// Public: Run the AJAX request if there are fewer than `max_cc` running,
// otherwise queue it up.
//
// url - String
// callback(fail, body)
//
RateLimit.prototype.get = function(url, callback) {
  // Don't run all the requests simultaneously.
  if (this.running === this.max_cc) {
    this.waiters.push(new GetWaiter(url, callback))
  } else {
    this.getNow(url, callback)
  }
  this.onChange()
}

// Internal: Unthrottled AJAX request.
//
// url - String
// callback(err, body)
//
RateLimit.prototype.getNow = function(url, callback) {
  this.running++
  var _this = this
  this.ajax(url, function(fail, body) {
    _this.running--
    callback(fail, body)
    if (_this.waiters.length) {
      var waiter = _this.waiters.shift()
      _this.getNow(waiter.url, waiter.callback)
    }
    _this.onChange()
  })
}

function GetWaiter(url, callback) {
  this.url      = url
  this.callback = callback
}
