/// Like `setInterval`, but calibrate to the interval.
///
/// For example, if it is 8:32:21, and `delay` is 60000 (1 minutes),
/// the first call of `fn` will occur at 8:33:00. The next call will be at
/// 8:34:00, and so on.
///
/// fn    - Function
/// delay - Integer, milliseconds. The interval.
///
/// Returns Function. Calling will clear the timers.
module.exports = function(fn, delay) {
  var interval
  var timeout = setTimeout(function() {
    timeout  = null
    interval = setInterval(fn, delay)
  }, delay - Date.now() % delay)

  return function() {
    if (timeout)  clearTimeout(timeout)
    if (interval) clearInterval(interval)
  }
}
