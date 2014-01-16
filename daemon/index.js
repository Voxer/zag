var MetricsDaemon = require('./lib/daemon')

module.exports = function(options) { return new MetricsDaemon(options) }
