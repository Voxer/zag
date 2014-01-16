// Server-side testing safe: noop will be set as the APIClient's ajax function.
module.exports = new (require('../api'))(
  typeof window === "undefined" ? function() {} : sail.ajax)
