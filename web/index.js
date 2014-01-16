var MetricsWeb = require('./app')

// For options see `app/index.js`.
module.exports = function(options) {
  return new MetricsWeb(options)
}
