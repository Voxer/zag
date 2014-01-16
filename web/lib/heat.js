var sort = require('./sort')

module.exports = HeatMap

///
/// This class handles all of the math for converting log/linear quantile
/// data into a more linear representation appropriate for heat mapping.
///
/// All of it's conversions take place in the original data's coordinate space.
///
/// Vocabulary
///   * bucket - The logarithm boundaries (2, 4, 8, 32, 64, ...)
///   * step   - The linear step boundaries (2, 3... 16, 18..., 64, 72...)
///     Each bucket has at most <STEPS> linear steps within it. The minimum
///     height of a step is 1. Otherwise, the height is <bucket>/<steps>.
///
///
/// base   - Integer, bucket logarithm base.
/// steps  - Integer, number of linear bucket subdivision.
/// points - [ [ts, bucketA, freqA, bucketB, freqB, ...], ... ]
/// rows   - Integer
///
function HeatMap(base, steps, points, rows) {
  this.base   = base
  this.steps  = steps

  this.points = points
  this.rows   = rows

  this.yMax       = null
  this.cellHeight = null
  this._setYMax(this.getYMax())
}

// For testing
HeatMap.quantile          = quantile
HeatMap.rankGradient      = rankGradient
HeatMap.columnFrequencies = columnFrequencies

HeatMap.prototype.destroy = function() { this.points = null }

HeatMap.prototype.getColumns = function() {
  var columnL = this.points.length
    , columns = new Array(columnL)
  for (var i = 0; i < columnL; i++) {
    columns[i] = this.getColumn(i)
  }
  rankGradient(columns)
  return columns
}

// Compute the cell offsets/gradient for a column.
//
// columnIndex - Integer index of the column in `points`.
//
// Returns [timestamp, yOffset, frequency, gradient, ...]
HeatMap.prototype.getColumn = function(columnIndex) {
  var column      = this.points[columnIndex]
    , cells       = [column[0]]
    , cellHeight  = this.cellHeight
    , cellMargin  = cellHeight / 2
    , currentFreq = 0
    , currentCell

  // For each step in the point, break it up into `stepCells` and
  // merge into `cells`.
  for (var i = 1, l = column.length; i < l; i+=2) {
    var stepBase  = column[i]
      , freq      = column[i + 1]
      , stepCells = this.stepToCells(stepBase)
    for (var j = 0; j < stepCells.length; j+=2) {
      var cellOffset = stepCells[j]
        , cellFract  = stepCells[j + 1]
      // Can't check with `cellOffset !== currentCell` because floating points cause striping.
      if (currentCell === undefined || Math.abs(cellOffset - currentCell) > cellMargin) {
        if (currentFreq > 0) {
          cells.push(currentCell)
          cells.push(currentFreq)
          cells.push(0) // gradient
        }
        currentCell = cellOffset
        currentFreq = 0
      }
      currentFreq += freq * cellFract
    }
  }
  if (currentFreq > 0) {
    cells.push(currentCell)
    cells.push(currentFreq)
    cells.push(0) // gradient
  }
  return cells
}

// Split a step across multiple cells.
// Return their offsets and the fraction of the area for each.
//
// step - Number
//
// Returns [cellBase, freqFraction, ...]
HeatMap.prototype.stepToCells = function(step) {
  var cells      = []
    , cellHeight = this.cellHeight
    , cellBase   = round(step, cellHeight)
    , stepHeight = this.getStepHeight(step)
    , stepMax    = step + stepHeight

  while (cellBase < stepMax) {
    var partialStepHeight
      = Math.min(cellBase + cellHeight, stepMax) // top edge
      - Math.max(cellBase, step) // bottom edge
    var fraction = partialStepHeight / stepHeight
    // drop tiny fractions of a block (magic number)
    if (fraction > 0.0000000000001) {
      cells.push(cellBase)
      cells.push(fraction)
    }
    cellBase += cellHeight
  }
  return cells
}

// Get the highest point in the heat map, across the whole X.
// This is equivalent to:
//
//   <highest step> + <height of that step>
//
// Returns Number.
HeatMap.prototype.getYMax = function() {
  var max     = 0
    , columns = this.points
  for (var i = 0, l = columns.length; i < l; i++) {
    var col    = columns[i]
      , bucket = col[col.length - 2]
    if (bucket > max) max = bucket
  }
  return max + this.getStepHeight(max)
}

// Compute the height of a block.
//
// Returns Number.
HeatMap.prototype.getCellHeight = function() {
  return this.yMax / this.rows
}

// Compute the height of a bucket-step, i.e. the distance from the base of this
// bucket to the one above it.
//
//   10,10 : 10,20,30,40,50,60,70,80,90 : 100 => 10
//   02,16 : 64,72,80,88,96,104,112,120 : 128 => 08
//
// val - Integer
//
// Returns Integer
HeatMap.prototype.getStepHeight = function(val) {
  var quant     = quantile(val, this.base)
    , nextLevel = Math.pow(this.base, quant + 1)
  return Math.max(1, nextLevel / this.steps)
}

// Internal and for testing. Force a value for the yMax.
HeatMap.prototype._setYMax = function(yMax) {
  this.yMax       = yMax
  this.cellHeight = this.getCellHeight()
}



// Get the value's quantile exponent.
//
// Returns Integer.
function quantile(val, bucket_size) {
  if (val === 0) return 0
  // Add a little so that `quantile(1000, 10) = 3`, because math.
  return Math.floor(Math.log(val) / Math.log(bucket_size) + 0.000000000001)
}

// Round to arbitrary base.
function round(val, base) {
  return base * Math.floor(val / base)
}

// Perform the frequency rating of a column in preparation for rank-based
// color distribution.
//
// It would probably be more accurate to rank across all columns, but thats slower.
//
//   * http://dtrace.org/blogs/dap/2011/06/20/heatmap-coloring/
//
// columns - [ [ts, cellOffset, cellFrequency, cellGradient, ...], ... ]
//
// Returns (and mutates) columns so that `cellFrequency` is between 0 and 1,
//   where 1 is dark and 0 is light.
function rankGradient(columns) {
  var allFreqs     = sort(columnFrequencies(columns))
    , allFreqCount = allFreqs.length
    , uniqFreqs    = {}
    , uniqCount    = 0
    , last

  // First pass to rank.
  for (var i = 0; i < allFreqCount; i++) {
    var freq = allFreqs[i]
    if (freq !== last) uniqFreqs[last = freq] = ++uniqCount
  }
  last = null

  // Second pass for the ratio.
  var per = 1 / uniqCount
  for (var i = 0, l = allFreqs.length; i < l; i++) {
    var freq = allFreqs[i]
    if (freq !== last) uniqFreqs[last = freq] *= per
  }

  for (var c = 0; c < columns.length; c++) {
    var cells = columns[c]
    // Apply the ratios to the cells' frequencies.
    for (var i = 2, l = cells.length; i < l; i+=3) {
      cells[i + 1] = uniqFreqs[cells[i]]
    }
  }
  return columns
}

// Pull a list of frequencies from the cells.
//
// Returns [Integer]
function columnFrequencies(columns) {
  var allFreqs = []
  for (var c = 0; c < columns.length; c++) {
    var cells = columns[c]
    for (var i = 2, l = cells.length; i < l; i+=3) {
      allFreqs.push(cells[i])
    }
  }
  return allFreqs
}
