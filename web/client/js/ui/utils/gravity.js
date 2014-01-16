///
///
///
/// options - {gravity}
///
module.exports = function(el, anchor, options) {
  var gravity = options.gravity || ""

  var isLeft = gravity.indexOf("r") === -1
    , isTop  = gravity.indexOf("b") === -1
    , totalW = window.innerWidth
    , totalH = window.innerHeight

  var anchorOffset = sail.offset(anchor)
    , anchorW      = sail.width(anchor)
    , anchorH      = sail.height(anchor)
    , elW          = sail.width(el)
    , elH          = sail.height(el)

  var left   = anchorOffset.left + anchorW
    , right  = anchorOffset.left + anchorW - elW
    , top    = anchorOffset.top  + anchorH
    , bottom = anchorOffset.top  + anchorH - elH

  // Overflow right
  if (isLeft && left + elW > totalW) isLeft = false
  // Underflow left
  else if (!isLeft && right < 0) isLeft = true

  // Overflow bottom.
  if (isTop && top + elH > totalH) isTop = false
  // Underflow top.
  else if (!isTop && bottom < 0)   isTop = true

  return { left:    isLeft ? left : right
         , top:     isTop  ? top  : bottom
         , isLeft:  isLeft
         , isTop:   isTop
         , gravity: (isLeft ? "l" : "r")
                  + (isTop  ? "t" : "b")
         }
}
