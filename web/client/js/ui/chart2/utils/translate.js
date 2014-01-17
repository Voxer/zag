var translate = module.exports = function(dx, dy) {
   return "translate(" + dx + "px," + dy + "px)"
}

translate.transform = "transform"

// Source: https://github.com/component/transform-property
var styles =
  [ "webkitTransform"
  , "MozTransform"
  , "msTransform"
  , "OTransform"
  , "transform"
  ]
var el = document.createElement("p")

for (var i = 0; i < styles.length; i++) {
  style = styles[i]
  if (el.style[style] != null) {
    translate.transform = style
    break
  }
}
