var parseMKey    = require('../../../../lib/mkey')
  , util         = require('./util')
  , applySubKeys = util.applySubKeys

// Histogram coloring.
var SUBKEY_COLORS =
  { count:      "#f00"    // bright red
  , mean:       "#f00"    // bright red
  , median:     "#3a3"    // green
  , std_dev:    "#4a00dc" // purple
  , p10:        "#caac00" // yellow
  , p75:        "#37c"    // dark blue
  , p95:        "#00acfa" // light blue
  , p99:        "#ff3b89" // pink
  , max:        "#ff9d3b" // orange
  , llquantize: "#000000" // black
  }

// Non-histogram coloring.
var COLOR_POOL = Object.keys(SUBKEY_COLORS).slice(1).map(function(k) { return SUBKEY_COLORS[k] })
  , COLOR_POOL_LEN = COLOR_POOL.length

module.exports = Chart

/// A Chart represents all the different things plotted on a single chart.
///
/// mkeys    - [String], "foo" or "foo@bar". If there is no explicit subkey,
///            the default from `settings.subkey` will be used.
/// settings - {subkey, renderer, histkeys, title, id}
///   subkey, renderer - String,   LAYOUT_MANY
///   histkeys         - [String], LAYOUT_HISTOGRAM
///   id               - String,   LAYOUT_DASHBOARD
///   title            - String,   LAYOUT_DASHBOARD (optional)
///
function Chart(mkeys, settings) {
  this.mkeys    = mkeys
  this.subkey   = settings.subkey
  this.renderer = settings.renderer
  this.histkeys = settings.histkeys
  this.id       = settings.id || Date.now().toString()
  this.title    = settings.title

  if (this.histkeys) {
    this.setHistKeys(this.histkeys)
  }

  // { mkey : color } cached to help color reuse for the same key.
  this.colorCache  = {}
  this.c           = 0 // Color counter
  this.isDestroyed = false
}

Chart.SUBKEY_COLORS = SUBKEY_COLORS
Chart.COLOR_POOL    = COLOR_POOL

Chart.prototype.destroy = function() {
  this.isDestroyed = true
  this.mkeys = this.histkeys = this.colorCache = null
}

// Get a list of Plot options that get passed to the charting library.
//
// Plots are labeled as follows:
//   * If all plots are of the same metrics key, the label is just the subkey.
//   * Otherwise, the label is "<key>@<subkey>".
// Plots are colored as follows:
//   * If all plots are of the same metrics key, the color corresponds to the subkey.
//   * Otherwise, the next one will be picked from `COLOR_POOL`.
//
// Returns [Plot]
Chart.prototype.getPlots = function() {
  //this.c = 0
  var mkeys = this.mkeys
    , isOne = this.isOne()
    , plots = []
  for (var i = 0; i < mkeys.length; i++) {
    var mkey = mkeys[i]
      , plot = this.keyToPlot(mkey, isOne)
    // Heat maps go to the front of the line so that they are the back layers
    // when plotted.
    if (parseMKey.subkey(mkey) === "llquantize") {
      plots.unshift(plot)
    } else plots.push(plot)
  }
  return plots
}

// Add a sub-plot to the chart.
//
// mkey - String "foo" or "foo@bar"
//
// Returns Plot: the plot for the key that was added.
Chart.prototype.plotAdd = function(mkey) {
  this.mkeys.push(mkey)
  return this.keyToPlot(mkey)
}

// Unplot the key.
//
// mkey - String "foo" or "foo@bar"
//
// Returns String: the deleted plot ID "key@subkey".
Chart.prototype.plotRemove = function(mkey) {
  var mkeys = this.mkeys
    , index = mkeys.indexOf(mkey)
  if (index > -1) mkeys.splice(index, 1)
  return this.keyToID(mkey)
}

// subkey - String
Chart.prototype.setSubKey = function(subkey) { this.subkey = subkey }

// renderer - String (e.g. "line", "stack")
Chart.prototype.setRenderer = function(renderer) { this.renderer = renderer }

// mkeys - [String]
Chart.prototype.setHistKeys = function(histkeys) {
  this.histkeys = histkeys
  this.mkeys    = this.getHistogramKeys()
}

// Public: Get a list of plot IDs.
//
// Returns [String] "key@subkey"
Chart.prototype.plotIDs = function() {
  var mkeys = this.mkeys
    , ids   = []
  for (var i = 0; i < mkeys.length; i++) {
    ids.push(this.keyToID(mkeys[i]))
  }
  return ids
}

// Get the chart's title. For dashboards this can be explicitly specified,
// for other graphs it is inferred from the mkeys.
//
// Returns String
Chart.prototype.getTitle = function() {
  return this.title || this.baseKey()
}

// Returns [String]
Chart.prototype.getKeys = function() {
  return this.histkeys
      ? [this.baseKey()]
      :  this.mkeys.slice() // non-histogram
}

var JSON_PLUCK = ["id", "title", "subkey", "renderer", "histkeys"]

// Serialize the Chart to a plain Object.
//
// Returns Object
Chart.prototype.toJSON = function() {
  var mkeys = this.getKeys()
  var chart = {keys: mkeys}
  for (var i = 0; i < JSON_PLUCK.length; i++) {
    var prop = JSON_PLUCK[i]
    if (this[prop]) chart[prop] = this[prop]
  }
  return chart
}

Chart.prototype.getID = function() { return this.id }
Chart.prototype.setID = function(id) { this.id = id }

////////////////////////////////////////////////////////////////////////////////
// Internal
////////////////////////////////////////////////////////////////////////////////

// mkey  - String "key" or "key@subkey"
// isOne - Boolean, optional
// Returns Plot
Chart.prototype.keyToPlot = function(mkey, isOne) {
  return this.makePlot(parseMKey(mkey), isOne)
}

//
// mkey   - String
// subkey - String
// isOne  - Boolean, default: false. Set to true if all of the plots belong
//          to the same key (and just vary by subkey).
//
// Returns Plot.
Chart.prototype.makePlot = function(mkeyObj, isOne) {
  var key    = mkeyObj.key
    , fn     = mkeyObj.fn
    , subkey = fn ? "count" : (mkeyObj.subkey || this.subkey)
    , isHeat = subkey === "llquantize"
    , id     = fn || (key + "@" + subkey)
    , label  = isOne  ? (fn || subkey) : id
    , type   = isHeat ? "heat"
             : isOne  ? "line"
             : this.renderer
    , color  = (isOne && !fn) ? SUBKEY_COLORS[subkey]
             : (this.colorCache[fn || key]
            || (this.colorCache[fn || key] = COLOR_POOL[this.c++ % COLOR_POOL_LEN]))
    , plot = { id:    id
             , label: label
             , type:  type
             , color: color
             , data:  null
             }
  if (!isHeat) {
    plot.x = "ts"
    plot.y = subkey
  }
  return plot
}

// Get the plot ID by mkey.
//
// mkey - String "key" or "key@subkey"
//
// Returns String "key@subkey"
Chart.prototype.keyToID = function(mkey) {
  if (parseMKey.isFunction(mkey)) return mkey
  var mkeyObj = parseMKey(mkey)
  return mkeyObj.key + "@" + (mkeyObj.subkey || this.subkey)
}

// Get whether or not all of the plotted keys are the same base key.
//
// Returns Boolean.
Chart.prototype.isOne = function() {
  var mkeys = this.mkeys
    , base1 = mkeys[0] && parseMKey.base(mkeys[0])
    , base2 = mkeys[1] && parseMKey.base(mkeys[1])
  return mkeys.length === 1
      || (base1 && base1 === base2)
}

// LAYOUT_HISTOGRAM
// Returns [String "foo@bar"]
Chart.prototype.getHistogramKeys = function() {
  return applySubKeys(parseMKey.base(this.mkeys[0]), this.histkeys)
}

// Returns String "foo"
Chart.prototype.baseKey = function() {
  var first = parseMKey(this.mkeys[0])
  return first.fn || first.key
}
