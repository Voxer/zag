/// Convert a `keydown` event to a human-readable version of the key pressed.
///
/// ev - DOM Event (or similar object).
///
/// Example key strings:
///
///   * "A-C-r"   - control-alt-r
///   * "!"       - shift-1
///   * "C-a"     - control-a
///   * "S-enter" - shift-enter
///
/// Returns Maybe String.
module.exports = function(ev) {
  var k = ev.which
    , C = ev.metaKey || ev.ctrlKey
    , A = ev.altKey
    , S = ev.shiftKey

  var prefix     = ""
  if (A) prefix += "A-"
  if (C) prefix += "C-"

  if (k === 16) return "shift"
  if (k === 17) return "control"
  if (k === 18) return "alt"

  var char
  // Alpha
  if (65 <= k && k <= 90) {
    char = String.fromCharCode(k)
    if (!S) char = char.toLowerCase()
    return prefix + char
  }

  // Number or otherwise.
  char = (48 <= k && k <= 57)
       ? String.fromCharCode(k)
       : map[k]

  if (S && char) {
    var special = shift_map[char]
    if (special) return prefix + special
    return prefix + "S-" + char
  }
  return char && prefix + char
}

var map =
    { 8: "backspace"
    , 9: "\t"
    , 13: "\n"
    , 20: "capslock"
    , 27: "escape"
    , 32: " "
    , 33: "pageup"
    , 34: "pagedown"
    , 35: "end"
    , 36: "home"
    , 37: "left"
    , 38: "up"
    , 39: "right"
    , 40: "down"
    , 45: "insert"
    , 46: "delete"
    , 107: "+"
    , 109: "-"
    , 186: ";"
    , 187: "="
    , 188: ","
    , 189: "-"
    , 190: "."
    , 191: "/"
    , 192: "`"
    , 219: "["
    , 220: "\\"
    , 221: "]"
    , 222: "'"
    }
  , shift_map =
    { "`": "~"
    , 1: "!"
    , 2: "@"
    , 3: "#"
    , 4: "$"
    , 5: "%"
    , 6: "^"
    , 7: "&"
    , 8: "*"
    , 9: "("
    , 0: ")"
    , ";": ":"
    , ",": "<"
    , ".": ">"
    , "=": "+"
    , "-": "_"
    , "/": "?"
    , "[": "{"
    , "\\": "|"
    , "]": "}"
    , "'": "\""
    }
