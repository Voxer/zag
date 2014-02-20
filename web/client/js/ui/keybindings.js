var keymap            = require('browser-keymap')
  , Dialog            = require('./views/dialog')
  , KeyBindingsDialog = require('./views/keybindings-dialog')

// Handle a global keydown event.
module.exports = function(controller) {
  return function(ev) {
    var k       = keymap(ev)
      , prevent = true

    // UI
    if        (k === "/")      { controller.sidebar.focus()
    } else if (k === "S")      { controller.sidebar.toggle()
    } else if (k === "D")      { controller.header.toggle("dashboards")
    } else if (k === "F")      { controller.header.toggle("functions")
    } else if (k === "a")      { controller.dashboardNewChart()
    } else if (k === "?")      { KeyBindingsDialog.toggle()
    } else if (k === "escape") { Dialog.pop()

    // Range
    } else if (k === "`") { setStart("-6h") // hours
    } else if (k === "1") { setStart("-1d") // days
    } else if (k === "2") { setStart("-2d")
    } else if (k === "3") { setStart("-3d")
    } else if (k === "4") { setStart("-4d")
    } else if (k === "5") { setStart("-5d")
    } else if (k === "6") { setStart("-6d")
    } else if (k === "7") { setStart("-1w") // weeks
    } else if (k === "8") { setStart("-2w")
    } else if (k === "9") { setStart("-3w")
    } else if (k === "0") { setStart("-1m") // months

    // Delta
    } else if (k === "~") { setDelta("auto")
    } else if (k === "!") { setDelta("1m")
    } else if (k === "%") { setDelta("5m")
    } else if (k === "^") { setDelta("1h")

    } else prevent = false

    if (prevent) {
      ev.preventDefault()
      ev.stopPropagation()
    }
  }

  function setStart(startReal) { controller.setRangeRealStart(startReal) }
  function setDelta(deltaReal) { controller.setDelta(deltaReal) }
}
