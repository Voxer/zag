/// JavaScript's native sort is fine for Strings, but this version is much faster
/// for arrays of Numbers.
///
/// Source:
///   http://jsperf.com/sorting-algorithms/9
///
module.exports = function(ary) {
  return inplace_quicksort(ary, 0, ary.length)
}

function inplace_quicksort(ary, start, end) {
  if (start < end - 1) {
    var pivotIndex = Math.floor((start + end) / 2)
    pivotIndex = inplace_quicksort_partition(ary, start, end, pivotIndex)
    inplace_quicksort(ary, start, pivotIndex)
    inplace_quicksort(ary, pivotIndex, end)
  }
  return ary
}

function inplace_quicksort_partition(ary, start, end, pivotIndex) {
  var i = start
    , j = end
    , pivot = ary[pivotIndex]
  while (true) {
    while (ary[i] < pivot) i++
    j--
    while (pivot < ary[j]) j--
    if (!(i<j)) return i
    swap(ary,i,j)
    i++
 }
}

function swap(ary, a, b) {
  var t = ary[a]
  ary[a] = ary[b]
  ary[b] = t
}
