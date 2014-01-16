module.exports =
  { create: create
  , remove: remove
  , on:     addListener
  , is:     testSelector
  , find:   findByID
  }

function create(html) {
  var frag = document.createElement("div")
  frag.innerHTML = html
  return frag.firstChild
}

function remove(el) {
  if (el.parentNode) {
    el.parentNode.removeChild(el)
  }
}

// Use event capturing so that "focus" & "blur" events work.
// See:
//   * http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
//
function addListener(el, name, listener) {
  el.addEventListener(name, listener, name === "focus" || name === "blur")
}

var reSelector = /^(\w+)?(?:\.([\w-]+))?$/
function testSelector(el, selector) {
  if (!selector) return true

  var match = reSelector.exec(selector)
  if (match[1] && el.tagName.toLowerCase() !== match[1]) return false
  if (match[2] && !hasClass(el, match[2])) return false
  return true
}

function hasClass(el, className) {
  return (" " + (el.className || "") + " ").indexOf(" " + className + " ") !== -1
}

function findByID(id) { return document.getElementById(id) }
