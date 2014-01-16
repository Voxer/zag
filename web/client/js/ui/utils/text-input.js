module.exports =
  { insert:    insert
  , moveTo:    setCursor
  , moveLeft:  moveLeft
  , moveRight: moveRight
  , nextChar:  nextChar
  , prevChar:  prevChar
  }

///
/// input - DOM Element
/// text  - String to insert.
///
function insert(input, text) {
  var offset = input.selectionStart
    , value  = input.value
  input.value = value.slice(0, offset)
              + text
              + value.slice(offset)
  setCursor(input, offset)
}

// Shift the cursor to the left or right.
function moveLeft(input)  { setCursor(input, input.selectionStart - 1) }
function moveRight(input) { setCursor(input, input.selectionStart + 1) }

// Set the cursor position.
//
// input  - DOM Element.
// offset - Integer
//
function setCursor(input, offset) {
  input.focus()
  input.selectionStart = input.selectionEnd = offset
}

function nextChar(input) { return input.value[input.selectionStart] }
function prevChar(input) { return input.value[input.selectionStart - 1] }
