var Router   = require('./models/router')
  , pageload = Date.now()

module.exports = History

Router.parseQuery    = sail.parseQuery
Router.toQueryString = sail.toQueryString

// Use the HTML5 history API to keep the URL in sync with the currently plotted metrics.
//
// Singleton
//
// router - Router
//
function History(router) {
  this.router = router.on("title", this.setDocumentTitle.bind(this))
  // Listening for the initial popstate event doesn't work in firefox.
  setTimeout(function() {
    router.onPopState()
    window.addEventListener("popstate", router.onPopState.bind(router))
  }, 0)
}

// Set the `<title>`.
//
// title - String
//
History.prototype.setDocumentTitle = function(title) { document.title = title }

// Push a URL with the current graph state.
//
// mode - "dashboard" or "graph"
// data - If mode is "dashboard", this will be the dashboard ID.
//        If mode is "graph", this will be an Array of String metrics keys.
//
History.prototype.update = function(mode, data) {
  // The PlotSettings' defaults get applied to the query string on page load,
  // but we dont want a separate history entry.
  var isReplace = Date.now() - pageload < 1500
    , newURL    = this.router.update(mode, data)
  if (newURL) setURL(newURL, isReplace)
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// HTML5 history.
//
// <https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Manipulating_the_browser_history>
//
// path      - String pathname and query string.
// isReplace - Boolean, default: false.
//             If true, replace the current URL.
//             If false, push the URL.
//
function setURL(path, isReplace) {
  window.history[isReplace ? "replaceState" : "pushState"](null, "", path)
}

// Why is this here? Just try and take it out. I dare you.
// This works around some annoying bugs where the history is popped then
// immediately pushed (twice?), or something like that.
setURL = sail.debounce(setURL, 10)
