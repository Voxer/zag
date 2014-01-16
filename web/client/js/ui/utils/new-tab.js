/// Open the link in a new browser tab.
///
/// url - String
///
module.exports = function(url) {
  var a  = document.createElement("a")
    , ev = document.createEvent("MouseEvents")
  a.href = url

  ev.initMouseEvent( "click", true, true, window
                   , 0, 0, 0, 0, 0, true, false
                   , false, true, 0, null )
  a.dispatchEvent(ev)
}
