window.d3   = require('d3')
window.sail = require('./sail')

var PlotSettings = require('./models/plot-settings')
  , Layout       = require('./ui')

document.addEventListener("DOMContentLoaded", function() {
  var loc      = document.location
    , settings = new PlotSettings(sail.parseQuery(loc.search))
    , layout   = new Layout(settings)

  window.onresize = function() { layout.onResize() }
})
