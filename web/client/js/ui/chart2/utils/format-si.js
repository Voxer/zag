var commas = d3.format(",g")

module.exports = function(val) {
  v = Math.abs(val)
  if (v < 1e3)  return val
  if (v < 1e6)  return commas(val / 1e3)  + "K"
  if (v < 1e9)  return commas(val / 1e6)  + "M"
  if (v < 1e12) return commas(val / 1e9)  + "G"
  if (v < 1e15) return commas(val / 1e12) + "T"
  if (v < 1e18) return commas(val / 1e15) + "P"
  if (v < 1e21) return commas(val / 1e18) + "E"
  if (v < 1e24) return commas(val / 1e21) + "Z"
  return commas(val / 1e24) + "Y"
}
