var dateTools = require('../../../lib/date-utils')
  , Tag       = require('./tag')

module.exports = PlotSettings

var HISTOGRAM = ["mean", "median", "std_dev", "p10", "p75", "p95", "p99"]

///
/// All plots have common settings: the date range that they plot, and
/// the delta. These are computed and stored here.
///
/// options -
///   Global:
///     * start - String or Integer. May be relative.
///     * end   - Integer, optional. Defaults to now.
///     * delta - String, optional. Defaults to "auto".
///   Ignored by dashboards
///     * renderer - String, default: "line"
///     * subkey   - String Subkey to plot for type=many.
///     * histkeys - String comma-separated histogram subkeys.
///     * rate     - Boolean, default: false
///
function PlotSettings(options) {
  this.theEnd    = Date.now()
  var psets      = this.decode(options)
  this.deltaReal = psets.deltaReal
  this.setRangeReal(psets.startReal, psets.endReal)
  this.rate      = psets.rate
  this.nocache   = psets.nocache
  // These will be ignored in LAYOUT_DASHBOARD, since each graph has their own.
  this.renderer  = psets.renderer
  this.subkey    = psets.subkey
  this.histkeys  = psets.histkeys
}

PlotSettings.HISTOGRAM = HISTOGRAM

// Returns [Tag]
PlotSettings.prototype.getTags = function() { return Tag.all() }

// Load the tags.
//
// callback(fail, tags)
//
PlotSettings.prototype.loadTags = function(callback) {
  // No tags for live metrics until I figure out how to make them
  // not refresh constantly.
  if (this.isLive()) {
    return setTimeout(function() { callback(null, Tag.all()) })
  }
  Tag.load(this.start, this.end, function(fail, tagInterval) {
    callback(fail, tagInterval && tagInterval.data)
  })
}

PlotSettings.prototype.isLive = function() {
  return this.delta < 60000
}

////////////////////////////////////////////////////////////////////////////////
// Setters
////////////////////////////////////////////////////////////////////////////////

//
// start, end - Integer timestamp bounds
//
// Returns Boolean: whether or not the `delta` changed.
PlotSettings.prototype.setRange = function(start, end) {
  this.start = start
  this.end   = end
  return this.recomputeDelta()
}

//
// startReal - String: "-3d", timestamp, etc
// endReal   - String or undefined
//
PlotSettings.prototype.setRangeReal = function(startReal, endReal) {
  this.startReal = startReal
  this.endReal   = endReal
  var theEnd     = this.theEnd
  this.setRange(dateTools.parse(startReal, theEnd),
       Math.min(dateTools.parse(endReal,   theEnd) || theEnd, theEnd))
}

// Set the `deltaReal` and `delta`.
//
// deltaReal - String, "auto", "5m", "1h", etc.
//
PlotSettings.prototype.setDelta = function(deltaReal) {
  this.deltaReal = deltaReal
  this.delta     = deltaReal === "auto"    ? computeDelta(this.start, this.end)
                 : deltaReal == +deltaReal ? +deltaReal
                 : dateTools.parseInterval(deltaReal)
}

// Reload the delta. This assumes that start/end has changed.
//
// Returns Boolean: whether or not it changed.
PlotSettings.prototype.recomputeDelta = function() {
  var oldDelta = this.delta
  this.setDelta(this.deltaReal)
  return this.delta !== oldDelta
}

////////////////////////////////////////////////////////////////////////////////
// UI helpers
////////////////////////////////////////////////////////////////////////////////

PlotSettings.prototype.rangeToString = function() {
  return this.endReal
       ? dateTools.verboseRange(this.startReal, this.endReal)
       : dateTools.verbose(this.startReal)
}

// Pretty-print the delta. If the delta is "auto", the computed value will
// be returned instead.
//
// Returns String
PlotSettings.prototype.deltaToString = function() {
  if (this.deltaReal !== "auto") {
    return this.deltaReal == +this.deltaReal ? this.deltaReal + "ms"
         : this.deltaReal
  }
  return (this.delta % 60000 === 0) ? (this.delta / 60000) + "m (auto)"
       : (this.delta %  1000 === 0) ? (this.delta / 1000)  + "s (auto)"
       :  this.delta + "ms (auto)"
}

////////////////////////////////////////////////////////////////////////////////
// History helpers
////////////////////////////////////////////////////////////////////////////////
// Convert the URL querystring data to settings.
//
// Returns Object
PlotSettings.prototype.decode = function(options) {
  return { deltaReal: (options.delta || "auto").toString()
         , startReal: (options.start || "-3d").toString()
         , endReal:   (options.end ? options.end.toString() : null)
         , rate:      options.rate     || false
         , nocache:   options.nocache  || false
         , renderer:  options.renderer || "line"
         , subkey:    options.subkey   || "count"
         , histkeys:  options.histkeys ? options.histkeys.split(",") : HISTOGRAM.slice()
         }
}

////////////////////////////////////////////////////////////////////////////////
// Delta computation
////////////////////////////////////////////////////////////////////////////////

function secToMS(sec) { return sec * 1000 }
function minToMS(min) { return min * 60000 }

// For small ranges, use the default/minimum delta of 1.
// As the range becomes larger, use 5 or 60.
//
// Returns Integer minutes.
function computeDelta(start, end) {
  var mins  = (end - start - 1) / 1000 / 60
    , hours = mins / 60
  return (mins  <=  1)         ? 200
       : (mins  <=  5)         ? secToMS(1)
       : (mins  <= 10)         ? secToMS(2)
       : (mins  <= 20)         ? secToMS(4)
       : (hours <=  8)         ? minToMS(1)
       : (hours <= 48)         ? minToMS(5)
       : (hours <= 24 * 7 * 4) ? minToMS(60)
       : minToMS(1440)
}
