var Dialog   = require('./dialog')
  , inherits = require('util').inherits
  , dialog

module.exports = KeyBindingsDialog

function KeyBindingsDialog() {
  Dialog.call(this)
}

inherits(KeyBindingsDialog, Dialog)

KeyBindingsDialog.toggle = function() {
  dialog ? dialog.destroy() : (dialog = new KeyBindingsDialog())
}

KeyBindingsDialog.prototype.View(
  { title: "Key Bindings"
  , body:  keyBindingsToHTML()
  }).destroy(function() { dialog = null })

function keyBindingsToHTML() {
  var byCat =
    { General:
      [ ["/", "Filter keys"]
      , ["S", "Toggle sidebar"]
      , ["D", "Toggle dashboards"]
      , ["F", "Toggle functions"]
      , ["?", "Toggle keybindings help"]
      ]
    , Interval:
      [ ["`",    "Back 6 hours"]
      , ["1..7", "Back N days"]
      , ["8",    "Back 2 weeks"]
      , ["9",    "Back 3 weeks"]
      , ["0",    "Back 1 month"]
      ]
    , Delta:
      [ ["S-`", "delta = auto"]
      , ["S-1", "delta = 1 minute"]
      , ["S-5", "delta = 5 minutes"]
      , ["S-6", "delta = 1 hour"]
      ]
    , Tree:
      [ ["enter",   "Go to graph"]
      , ["&uarr;",  "Navigate keys up"]
      , ["&darr;",  "Navigate keys down"]
      , ["tab",     "Collapse/expand children"]
      , ["S-enter", "Toggle graph"]
      , ["C-enter", "Open graph in new tab"]
      , ["esc",     "Reset filter"]
      ]
    , Dashboard:
      [ ["a", "Add chart to dashboard"]
      ]
    }
  var cats = ["General", "Interval", "Delta", "Tree", "Dashboard"]
    , html = ""

  for (var i = 0, l = cats.length; i < l; i++) {
    if (i > 0 && i % 3 === 0) html += '<hr/>'
    var cat = cats[i]
    html += '<div class="hotkey-group">'
          +   '<h3 class="hotkey-category">' + cat + '</h3>'
          +   '<ul class="hotkey-pairs">'
          +     keysToHTML(byCat[cat])
          +   '</ul>'
          + '</div>'
  }
  return html
}

// keys - [[String key, String label]]
// Returns String HTML
function keysToHTML(keys) {
  var html = ""
  for (var i = 0; i < keys.length; i++) {
    var pair = keys[i]
    html += '<li class="hotkey-pair">'
          +   '<span class="hotkey-key">'    + pair[0] + '</span>'
          +   '<span class="hotkey-action">' + pair[1] + '</span>'
          + '</li>'
  }
  return html
}
