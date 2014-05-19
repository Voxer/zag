var dateToString = require('../../../../lib/date-utils').dateToString
  , Dialog       = require('./dialog')
  , TimePicker   = require('./time-picker')
  , inherits     = require('util').inherits

module.exports = TagDialog

/// Tag creation dialog.
///
/// options  -
///   * tagtypes - [TagType]
///   * ts       - Integer timestamp
///   * label    - String, optional
///   * color    - String, optional
///   * delete() - Function, optional
///   * callback(tag_opts)
///     The callback is not called if the user cancels.
///
function TagDialog(opts) {
  this.tagtypes = opts.tagtypes
  this.ts       = opts.ts
  this.label    = opts.label || ""
  this.color    = opts.color
  this._delete  = opts.delete
  this.callback = opts.callback

  Dialog.call(this,
    { title:       opts.delete ? 'Edit'   : 'New'
    , create:      opts.delete ? 'Update' : 'Create'
    , label:       this.label.replace(/"/g, "&quot;")
    , deleteHTML:  opts.delete ? this.deleteHTML() : ''
    , optionsHTML: this.optionsHTML()
    })

  this.time = new TimePicker(
    { ts:       this.ts
    , readonly: !!opts.delete
    , appendTo: this.timeEl
    })
  this.labelEl.select()
}

inherits(TagDialog, Dialog)

TagDialog.prototype.View(
  { title: '{title} Tag'
  , body
    : '<input:labelEl type="text" placeholder="Tag label" class="tag-dialog-label" value="{label}"/>'
    + '<div class="tag-dialog-row">'
    +   '<div:timeEl class="tag-dialog-time"></div>'
    +   '<select:colorEl class="tag-dialog-color">{optionsHTML}</select>'
    + '</div>'
    + '<div class="dialog-footer">'
    +   '{deleteHTML}'
    +   '<button class="button-create">{create} Tag</button>'
    + '</div>'
  }).on(
  { ".button-create click": "save"
  , ".button-delete click": "delete"
  }).destroy(function() {
    this.time.destroy()
    this.tagtypes = this.callback = this._delete = this.time = null
  })

// Create/update the tag.
TagDialog.prototype.save = function() {
  var color = this.colorEl.value
    , label = this.labelEl.value
  if (!this.callback || !color || !label) return
  this.callback(
    { ts:    this.time.getValue()
    , label: label
    , color: color
    })
  this.destroy()
}

TagDialog.prototype.delete = function() {
  this._delete()
  this.destroy()
}

TagDialog.prototype.optionsHTML = function() {
  var current  = this.color
    , tagtypes = this.tagtypes
    , html     = ""
    , found
  for (var i = 0; i < tagtypes.length; i++) {
    var tt    = tagtypes[i]
      , attrs = current === tt.color ? " selected" : ""
    html += '<option value="' + tt.color + '"' + attrs + '>'
          +   sail.escapeHTML(tt.name)
          + '</option>'
    found = found || attrs
  }
  if (current && !found) {
    html += '<option value="' + current + '" selected>'
          +   sail.escapeHTML("Custom: " + current)
          + '</option>'
  }
  return html
}

TagDialog.prototype.deleteHTML = function() {
  return '<button class="button-delete">Delete Tag</button>'
}
