# Example

To create a widget type, you inherit from `require('view')` or from another view.

```javascript
var View     = require('view')
  , inherits = require('util').inherits

function Dialog(opts) {
  this.clicks = 0
  View.call(this, opts)
}

inherits(Dialog, View)
```

Define the template. Substitutions are `{field}`, in this case `{title}`
and `{body}`. The `:title` bit indicates that that element should be attached
to the Dialog &ndash; it will be available as `this.title` once the
element is rendered.

```javascript
Dialog.prototype.View
( '<div class="dialog">'
+   '<button class="dialog-close">close</button>'
+   '<div:title class="dialog-title">{title}</div>'
+   '<div class="dialog-body">{body}</div>'
+ '</div>' )
```

Attach events. For example, when an element matching `.dialog-close` within
`this.el` is clicked, `this.onClick` will be called with the event.

```javascript
.on(
{ ".dialog-close click": "onClick"
, ".dialog-close mousedown":
  function() {
    console.log("closing soon")
  }
, "dblclick": "onDoubleClick"
})
```

The given function will be called when the Dialog is destroyed.

```javascript
.destroy(function() {
  console.log("destroying", this)
})
```

Every View needs a `render()` method, which attaches `this.el` to the DOM.

```javascript
Dialog.prototype.render = function() {
  document.body.appendChild(this.el)
}
```

Implement the event handlers.

```javascript
Dialog.prototype.onClick = function(event) {
  console.log("you clicked the close button", event)
  this.destroy()
}

Dialog.prototype.onDoubleClick = function() {
  console.log("you double-clicked on the dialog", ++this.clicks, "times")
}
```

When a `Dialog` is initialized, the template is filled, an element is created,
`render` is called to add it to the DOM, and appropriate the event listeners
are attached (using event delegation).

```javascript
var dialog = new Dialog(
  { title: "<h1>The title</h1>"
  , body:  "some content"
  })
dialog.el    // div.dialog
dialog.title // div.dialog-title
// Removes the element and cleans up, calling the `destroy()` listeners.
// Alternatively, there is a `remove()` method that only detaches the element from the DOM.
dialog.destroy()
```

Views can inherit from one another.

```javascript
function LoudDialog(label) {
  Dialog.call(this, {label: label})
}

inherits(LoudDialog, Dialog)
```

Fill the `body` field of the Dialog template with a new template.

```javascript
LoudDialog.prototype.View({body: '<strong:content>{label}</strong>'})

var loud = new LoudDialog("go away")
loud.content.outerHTML // "<strong>go away</strong>"
```
