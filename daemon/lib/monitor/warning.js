module.exports = Warning

///
/// mkey   - String metrics key
/// field  - String "count" or "mean"
/// value  - Number, current value
/// target - Number, ideal value
/// margin - Number, the margin on either side of the `target`.
/// cmp    - String, ">" or "<". ">" means too high, "<" is too low.
///
function Warning(mkey, field, value, target, margin, cmp) {
  this.mkey   = mkey
  this.field  = field
  this.value  = value
  this.target = target
  this.margin = margin
  this.cmp    = cmp
}
