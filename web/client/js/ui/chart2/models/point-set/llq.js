var HeatMapPointSet = require('./heat')
  , HeatMap         = require('../../../../../../lib/heat')
  , inherits        = require('util').inherits

module.exports = LLQPointSet

/// Wrapper for HeatMap that takes log/linear quantile data instead of linear.
///
/// options -
///   * base  - Integer
///   * steps - Integer
///   * rows  - Integer
///   * data  - [ [x, y, freq, ...], ...]
///
function LLQPointSet(options) {
  this.heat     = null
  this.origData = null

  this.base  = options.base
  this.steps = options.steps
  this.rows  = options.rows

  HeatMapPointSet.call(this, options)
}

inherits(LLQPointSet, HeatMapPointSet)

LLQPointSet.prototype.destroy = function() {
  this.heat.destroy()
  this.heat = this.origData = null
  HeatMapPointSet.prototype.destroy.call(this)
}

LLQPointSet.prototype.setData = function(llqData) {
  this.heat && this.heat.destroy()
  var heat = this.heat = new HeatMap(this.base, this.steps, llqData, this.rows)

  this.yMax     = heat.yMax
  this.dy       = heat.cellHeight
  this.origData = llqData

  HeatMapPointSet.prototype.setData.call(this, heat.getColumns())
}

// rows - Integer
LLQPointSet.prototype.setRows = function(rows) {
  if (this.rows === rows) return
  this.rows = rows
  this.setData(this.origData)
}
