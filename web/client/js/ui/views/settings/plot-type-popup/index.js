var ManyPicker      = require('./many')
  , HistogramPicker = require('./histogram')
  , DashboardMenu   = require('./dashboard')
  , SettingsPopup   = require('../settings-popup')

module.exports = function(opts) {
  var type = opts.controller.layoutToString()
  return new ( type === "many"      ? ManyPicker
             : type === "histogram" ? HistogramPicker
             : type === "counter"   ? CounterPicker
             : type === "dashboard" ? DashboardMenu
             : UnknownPicker)(opts)
}

function CounterPicker(opts) {
  opts.type = "plottype-counter"
  opts.body = "No options available"
  return new SettingsPopup(opts)
}

function UnknownPicker(opts) {
  opts.type = "plottype-unknown"
  opts.body = "unknown graph type"
  return new SettingsPopup(opts)
}
