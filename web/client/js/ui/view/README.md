# Usage

      var View = require('view')

      function Dialog(opts) {
        View.call(this, opts)
      }

      Dialog.prototype.View
      ( '<div class="dialog">'
      +   '<button class="dialog-close">close</button>'
      +   '<div class="dialog-title">{title}</div>'
      +   '<div class="dialog-body">{body}</div>'
      + '</div>'
      ).on({".dialog-close click": "destroy"})

      Dialog.prototype.render = function() {
        document.body.appendChild(this.el)
      }

