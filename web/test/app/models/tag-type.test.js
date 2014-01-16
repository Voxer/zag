var test           = require('tap').test
  , TagTypeManager = require('../../../app/models/tag-type')

test("TagTypeManager.isColor", function(t) {
  var isC = TagTypeManager.isColor
    , yes = ["#012", "#345", "#abc", "#def", "#DEF", "#123456"]
    , no  = ["345",  "a#bc", "#abq", "a#bcd", "#1", "#12", "#1234", "#12345", "#1234567"]

  for (var i = 0; i < yes.length; i++) t.equals(isC(yes[i]), true)
  for (var i = 0; i < no.length;  i++) t.equals(isC(no[i]), false)
  t.end()
})
