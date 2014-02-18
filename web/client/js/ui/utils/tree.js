var EventEmitter = require('events').EventEmitter
  , inherits     = require('util').inherits
  , keymap       = require('./keymap')
  , TreeScanner  = require('./scan')
  // Triangle icons
  , COLLAPSED    = "&#9656;"
  , EXPANDED     = "&#9662;"

module.exports = Tree

function noop() {}

/// A filterable lazy-loading tree widget.
///
/// Summary of UI Behavior:
///   Clicking a leaf selects it and deselects all others.
///   Shift-clicking a leaf will:
///     * select it if it is not selected.
///     * deselect it if it is selected.
///   Control-clicking will emit "select:open", which means to open the leaf
///   in a new browser tab.
///   Clicking the "expander" (triangle) will toggle expand/collapse of children.
///
/// options -
///   * load(leaf, callback)
///   * leafToPath(leaf)->[leaf]
///   * leafToParts(leaf)->[String]
///   * filter(text, callback(fail, leafs))
///   * filterInput - Input Element
///
/// Events:
///   * init()              - Emitted once when the top-level leafs are rendered.
///   * error()             - Emitted when an error occurs while loading leafs.
///   * select:one(leaf)    - Select a leaf, and deslect all others.
///     "select:remove" is implicit here: it will not be emitted.
///   * select:many(leafs)  - Select many leafs, and deselect all others.
///     "select:remove" is implicit here: it will not be emitted.
///   * select:add(leaf)    - Add a leaf to the selection.
///   * select:remove(leaf) - Deselect a leaf.
///   * select:open([leaf]) - Ctrl-click the leafs: open in new tab.
///   * load:start()        - Waiting for data (show a spinner).
///   * load:end()          - Done waiting.
///
function Tree(el, options) {
  this.el         = el
  this.rootTree   = new TreeView(this, makeSubTree())
  // Alternate tree root element for while filtering.
  this.filterTree = null

  this.selected     = []
  this.loadLeafs    = options.load
  this.leafToPath   = options.leafToPath
  this.leafToParts  = options.leafToParts
  this.initialized  = false

  // Filtering
  this.isFiltered     = false
  this.filter         = options.filter   // Function(text, callback(fail, leafs))
  this.filterEl       = options.filterEl // DOM Input Element
  this.lastFilter     = null             // String
  this.lastFilterTime = 0                // Integer timestamp
  if (this.filterEl) {
    sail(this.filterEl).on("keydown", this.onFilterKeydown.bind(this))
  }

  // When many keys are plotted the "init" events will trigger the warning.
  this.setMaxListeners(30)

  var _this = this
  setTimeout(function() {
    _this.load(null, _this.onRootLoad.bind(_this))
  }, 0)
}

inherits(Tree, EventEmitter)


// Get the (lexically) first selected key.
//
// Returns String.
// Returns undefined if no keys are selected.
Tree.prototype.firstKey = function() {
  var keys = this.selected
    , min, key
  for (var i = 0, l = keys.length; i < l; i++) {
    key = keys[i]
    if (key < min || min === undefined) min = key
  }
  return min
}

Tree.prototype.load = function(leaf, callback) {
  this.emit("load:start")

  var _this = this
  this.loadLeafs(leaf, function(fail, leafs) {
    callback(fail, leafs)
    _this.emit("load:end")
  })
}

////////////////////////////////////////////////////////////////////////////////
// Selection
////////////////////////////////////////////////////////////////////////////////

// Replace the current selection with the given leaf.
// leaf - String
Tree.prototype.selectOne = function(leaf) {
  this.deselectAll()
  this.selectAdd(leaf)
}

// Add a leaf to the current selection.
// leaf - String
Tree.prototype.selectAdd = function(leaf) {
  if (!this.initialized) {
    return this.once("init", this.selectAdd.bind(this, leaf))
  }
  this.selected.push(leaf)

  var rootTree = this.rootTree
  if (rootTree.resolve(leaf)) {
    rootTree.current(leaf)
  } else {
    var path = this.leafToPath(leaf)
    this.loadLeafs(path[path.length - 2], this.selectSelected.bind(this))
  }

  if (this.isFiltered) {
    this.filterTree.current(leaf)
  }
}

// Set the selection.
// leafs - [String]
Tree.prototype.selectMany = function(leafs) {
  this.deselectAll()
  for (var i = 0, l = leafs.length; i < l; i++) {
    this.selectAdd(leafs[i])
  }
}

// Remove the leaf from current the selection.
// leaf - String
Tree.prototype.selectRemove = function(leaf) {
  var index = this.selected.indexOf(leaf)
  if (index > -1) this.selected.splice(index, 1)
  this.rootTree.uncurrent(leaf)
  if (this.isFiltered) {
    this.filterTree.uncurrent(leaf)
  }
}

// Doesn't emit any events, just update the UI.
Tree.prototype.deselectAll = function() {
  var deselect   = this.selected
    , isFiltered = this.isFiltered
    , rootTree   = this.rootTree
    , filterTree = this.filterTree
  for (var i = 0, l = deselect.length; i < l; i++) {
    var leaf = deselect[i]
    rootTree.uncurrent(leaf)
    if (isFiltered) {
      filterTree.uncurrent(leaf)
    }
  }
  this.selected = []
}

// Initialize the selection.
// Relies on all initially selected leafs being preloaded, so that the `expand`
// call is synchronous.
Tree.prototype.selectSelected = function() {
  var selected = this.selected
    , rootTree = this.rootTree
    , leaf, path, pathLen

  for (var i = 0; i < selected.length; i++) {
    leaf    = selected[i]
    path    = this.leafToPath(leaf)
    pathLen = path.length
    for (var j = 0; j < pathLen - 1; j++) {
      rootTree.expand(path[j])
    }
  }
  rootTree.selectSelected()

  this.scrollToFirst()
}

// Find out whether or not the leaf is already selected.
//
// leaf - String
//
// Returns Boolean
Tree.prototype.isSelected = function(leaf) {
  return this.selected.indexOf(leaf) > -1
}

// Returns TreeView
Tree.prototype.currentTree = function() {
  return this.isFiltered ? this.filterTree : this.rootTree
}

// Scroll to the lexically-first selected key.
Tree.prototype.scrollToFirst = function() {
  var first = this.firstKey()
  if (first) this.currentTree().setCursor(first)
}

////////////////////////////////////////////////////////////////////////////////
// Event handlers
////////////////////////////////////////////////////////////////////////////////

Tree.prototype.onRootLoad = function(fail, leafs) {
  if (fail) return this.emit("error")
  this.rootTree.populateTop(leafs)
  this.el.appendChild(this.rootTree.el)
  this.initialized = true

  this.emit("init")
  this.scrollToFirst()
}

// A leaf was clicked.
//
// leaf - String
// ev   - {shiftKey, ctrlKey, metaKey}
//
Tree.prototype.onSelectLeaf = function(leaf, ev) {
  var shiftKey = ev.shiftKey
    , ctrlKey  = ev.ctrlKey || ev.metaKey

  if (ctrlKey) {
    this.emit("select:open", [leaf])
  } else if (shiftKey) {
    this.emit("select:" + (this.isSelected(leaf) ? "remove" : "add"), leaf)
  } else {
    this.emit("select:one", leaf)
  }
}

Tree.prototype.onSelectLeafs = function(leafs, ev) {
  var shiftKey = ev.shiftKey
    , ctrlKey  = ev.ctrlKey || ev.metaKey
  if (ctrlKey) {
    this.emit("select:open", leafs)
  } else {
    this.emit("select:many", leafs)
  }
}


///
/// Filtering events
///

// Filter the tree.
//
// ev - DOM "keydown" event from `filterEl`.
//
Tree.prototype.onFilterKeydown = function(ev) {
  var key     = keymap(ev)
    , prevent = true
  if (key === "escape") {
    this.filterEl.value = ""
    this.filterEl.blur()
    this.clearFilter()
  } else if (key === "down") { this.currentTree().cursorDown()
  } else if (key === "up")   { this.currentTree().cursorUp()
  } else if (key === "\t")   {
    var view = this.currentTree()
      , leaf = view.cursor
    if (leaf) view.toggleLeaf(leaf)
  } else if (key === "\n" || key === "C-\n" || key === "S-\n") {
    var leaf = this.currentTree().cursor
    if (leaf) this.onSelectLeaf(leaf, ev)
  // Re-filter, but wait till the next tick so that the `input.value` is updated.
  } else {
    var _this = this
    setTimeout(function() { _this.onFilterChange() }, 0)
    prevent = false
  }
  if (prevent) ev.preventDefault()
}

// `input.value` is current.
Tree.prototype.onFilterChange = function() {
  var text = this.filterEl.value
  // Don't re-filter on the same text.
  if (this.lastFilter === text) return

  if (text) {
    this.lastFilter = text

    // Use the timestamps to prevent a race condition that overwrites results
    // if successive filters return out of order.
    var _this = this
      , start = Date.now()
    this.filter(text, function(fail, leafs) {
      if (start < _this.lastFilterTime) return
      _this.lastFilterTime = start
      _this.showFilterResults(fail, leafs)
    })
  } else {
    this.lastFilterTime = Date.now()
    this.clearFilter()
  }
}


////////////////////////////////////////////////////////////////////////////////
// Filtering
////////////////////////////////////////////////////////////////////////////////

// Render the list of matching leafs.
//
// fail  - Boolean
// leafs - [{key, hasChildren}]
//
Tree.prototype.showFilterResults = function(fail, leafs) {
  if (fail) return this.emit("error")
  this.setIsFiltered(true)
  this.filterTree.populateTop(leafs)
  this.filterTree.selectSelected()
}

// All done filtering, switch back to the regular tree.
Tree.prototype.clearFilter = function() { this.setIsFiltered(false) }

//
// isFiltered - Boolean
//
Tree.prototype.setIsFiltered = function(isFiltered) {
  if (this.isFiltered === isFiltered) return
  this.isFiltered = isFiltered

  var filterTree = this.filterTree
    , displayRoot, displayFilter
  if (isFiltered) {
    if (!filterTree) {
      filterTree = this.filterTree = new TreeView(this, makeSubTree())
      this.el.appendChild(filterTree.el)
    }
    displayFilter = null
    displayRoot   = "none"
  // If its not filtered and there isn't even a filter tree,
  // theres nothing to do.
  } else if (!filterTree) {
    return
  } else {
    filterTree.empty()
    displayFilter   = "none"
    displayRoot     = null
    this.lastFilter = null
  }
  this.rootTree.display(displayRoot)
  this.filterTree.display(displayFilter)

  if (!isFiltered && filterTree) {
    this.scrollToFirst()
  }
}

////////////////////////////////////////////////////////////////////////////////
// View
////////////////////////////////////////////////////////////////////////////////

// A Tree has 1-2 TreeViews: a default one and one for filter results.
//
// Each view has a "cursor", which is displayed as an outline around a leaf.
//
// tree - Tree
// el   - DOM Element for the root subtree.
//
function TreeView(tree, el) {
  this.tree     = tree
  this.el       = el
  this.elements = null // { leaf : Element }
  this.cursor   = null // leaf
  sail(this.el).on("mousedown", this.onMouseDown.bind(this))
}

// leaf - String
TreeView.prototype.resolve = function(leaf) { return this.elements[leaf] }

////////////////////////////////////////////////////////////////////////////////

TreeView.prototype.display = function(style) { this.el.style.display = style }

TreeView.prototype.empty = function() {
  this.elements     = {}
  this.el.innerHTML = ""
}

var currentClass = "tree-leaf-current"
// Add to visual selection.
// leaf - String
TreeView.prototype.current = function(leaf) {
  if (!this.tree.initialized) return
  var leafEl = this.resolve(leaf)
    , rowEl  = leafEl && leafEl.firstChild
  if (rowEl && rowEl.className.indexOf(currentClass) === -1) {
    rowEl.className += " " + currentClass
  }
}

// Select many.
TreeView.prototype.currentMany = function(leafs) {
  for (var i = 0, l = leafs.length; i < l; i++) {
    this.current(leafs[i])
  }
}

TreeView.prototype.selectSelected = function() {
  this.currentMany(this.tree.selected)
}

// leaf - String
TreeView.prototype.uncurrent = function(leaf) {
  if (!this.tree.initialized) return
  var leafEl = this.resolve(leaf)
  if (leafEl) sail(leafEl.firstChild).removeClass(currentClass)
}

// Ensure that the leaf element is visible.
TreeView.prototype.scrollToEl = function(leafEl) {
  leafEl = leafEl.firstChild
  var treeEl     = this.tree.el
    , scrollTop  = treeEl.scrollTop
    , offsetTop  = leafEl.offsetTop
    , containerH = treeEl.clientHeight
    , leafH      = leafEl.clientHeight
  // Too high, scroll up.
  if (offsetTop < scrollTop
  // Too low, scroll down.
   || offsetTop + leafH >= scrollTop + containerH) {
    this.setScrollTop(offsetTop - containerH/2 + leafH)
  }
}

TreeView.prototype.setScrollTop = function(scrollTop) {
  this.tree.el.scrollTop = scrollTop
}

// leaf - String
TreeView.prototype.toggleLeaf = function(leaf) { this.toggleElement(this.resolve(leaf)) }
// leaf - String
TreeView.prototype.expand = function(leaf, callback) { this.expandElement(this.resolve(leaf), callback) }
// leaf - String
TreeView.prototype.collapse = function(leaf) { this.collapseElement(this.resolve(leaf)) }

// Toggle subtree visibility.
TreeView.prototype.toggleElement = function(leafEl) {
  var lastChild = leafEl.lastElementChild
  // If there is no list yet or it is invisible, expand it.
  if (lastChild.tagName !== "UL" || lastChild.style.display === "none") {
    this.expandElement(leafEl)
  // Otherwise, hide.
  } else {
    this.collapseElement(leafEl)
  }
}

// Expand the leaf's children.
//
// leafEl     - A leaf's `li.leaf` DOM Element.
// callback() - optional, called on completion.
//
TreeView.prototype.expandElement = function(leafEl, callback) {
  var lastChild = leafEl.lastElementChild
    , expander  = getLeafExpander(leafEl)
  if (!expander) return

  callback = callback || noop
  expander.innerHTML = EXPANDED
  // If the list has already been loaded and then collapsed, display it.
  if (lastChild.tagName === "UL") {
    lastChild.style.display = null
    return callback()
  }

  var leaf    = leafEl.dataset.leaf
    , subtree = makeSubTree()
    , _this   = this
  this.tree.load(leaf, function(fail, leafs) {
    if (fail) {
      _this.emit("error")
      return callback()
    }
    // Prevent a race condition that allows multiple identical subtrees to be appended.
    if (leafEl.lastElementChild.tagName !== "UL") {
      _this.populate(subtree, leafs)
      _this.selectSelected()
      leafEl.appendChild(subtree)
    }
    callback()
  })
}

// Expand the leaf element, then select all of the children.
//
// leafEl - A leaf's `li.leaf` DOM Element.
// ev     - DOM Event: {shiftKey, ctrlKey, metaKey}
//
TreeView.prototype.selectChildren = function(leafEl, ev) {
  var tree = this.tree
  this.expandElement(leafEl, function() {
    var subLeafEls = leafEl.children[1].children
      , subLeafs   = []
    for (var i = 0, l = subLeafEls.length; i < l; i++) {
      subLeafs.push(subLeafEls[i].dataset.leaf)
    }
    tree.onSelectLeafs(subLeafs, ev)
  })
}

// Collapse the leaf's children.
//
// leafEl - A leaf's `li.leaf` DOM Element.
//
TreeView.prototype.collapseElement = function(leafEl) {
  var subtree = leafEl.lastElementChild
  if (subtree.tagName !== "UL") return
  subtree.style.display = "none"

  getLeafExpander(leafEl).innerHTML = COLLAPSED
}

////////////////////////////////////////////////////////////////////////////////
// Cursor
////////////////////////////////////////////////////////////////////////////////

// Position the cursor on the leaf.
//
// leaf - String
//
TreeView.prototype.setCursor = function(leaf) {
  var oldLeafEl = this.cursor && this.resolve(this.cursor)
  if (oldLeafEl) {
    sail(oldLeafEl.firstChild).removeClass("tree-leaf-cursor")
  }
  this.cursor = leaf
  if (!leaf) return

  var leafEl = this.resolve(leaf)
  if (!leafEl) return
  leafEl.firstChild.className += " tree-leaf-cursor"
  this.scrollToEl(leafEl)
}

// Move the cursor up/down.
TreeView.prototype.cursorUp   = makeMoveCursor("prev")
TreeView.prototype.cursorDown = makeMoveCursor("next")

var scan = new TreeScanner(
  { parent:
    function(leafEl) {
      var parent = leafEl.parentElement.parentElement
      if (parent.tagName === "LI") return parent
    }
  , children:
    function(leafEl) {
      var children = leafEl.lastElementChild
      if (children.tagName === "UL" && children.style.display !== "none") {
        return children.children
      }
    }
  , prev: getSibling("previous")
  , next: getSibling("next")
  })

function getSibling(fn) {
  return function(cursorEl) {
    do {
      cursorEl = sail[fn](cursorEl)
    } while (cursorEl && cursorEl.className === "tree-parent")
    return cursorEl
  }
}

function makeMoveCursor(fn) {
  return function() {
    if (!this.cursor) return
    var cursorEl = this.resolve(this.cursor)
      , next     = scan[fn](cursorEl)
    if (next) this.setCursor(next.dataset.leaf)
  }
}

////////////////////////////////////////////////////////////////////////////////
// Events
////////////////////////////////////////////////////////////////////////////////
TreeView.prototype.onMouseDown = function(ev) {
  // Left click only.
  if (ev.button !== 0) return

  var target = ev.target
  if (target.className === "tree-leaf-label") {
    target = target.parentElement
  }

  var className = target.className
  // Select the leaf.
  if (~className.indexOf("tree-leaf-inner")) {
    this.tree.onSelectLeaf(target.parentElement.dataset.leaf, ev)
  // Toggle the children.
  } else if (~className.indexOf("tree-expander")) {
    var leafEl = target.parentElement.parentElement
    // Select all children.
    if (ev.shiftKey) {
      this.selectChildren(leafEl, ev)
    // Toggle expand/collapse.
    } else {
      this.toggleElement(leafEl)
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// Initialize the top level of leafs.
TreeView.prototype.populateTop = function(leafs) {
  this.elements = {}
  this.populate(this.el, leafs, true)

  var first = leafs[0]
  this.setCursor(first && first.key)
}

// Populate a [sub]tree element with the leafs.
TreeView.prototype.populate = function(subtreeEl, leafs, isTop) {
  subtreeEl.innerHTML = this.leafsToHTML(leafs, isTop)
  var children = subtreeEl.children
    , elements = this.elements
    , leafsL   = leafs.length
    , childI   = 0
  for (var leafI = 0; leafI < leafsL;) {
    var child = children[childI++]
    if (child.className === "tree-leaf") {
      elements[leafs[leafI++].key] = child
    }
  }
}

var expanderHTML = '<span class="tree-expander">' + COLLAPSED + '</span>'

//
// leafs - [Leaf]
// isTop - Boolean
//
// Returns String HTML.
TreeView.prototype.leafsToHTML = function(leafs, isTop) {
  var html        = ""
    , leafToParts = this.tree.leafToParts
    , leaf, key, path, label, parent, lastParent
  for (var i = 0, l = leafs.length; i < l; i++) {
    leaf  = leafs[i]
    key   = leaf.key
    path  = leafToParts(key)
    label = path[path.length - 1]
    if (isTop && path.length > 1) {
      parent = key.slice(0, -label.length)
      if (lastParent !== parent) {
        lastParent = parent
        html += '<li class="tree-parent">'
              +   sail.escapeHTML(parent)
              + '</li>'
      }
    }
    html += '<li class="tree-leaf" data-leaf="' + key.replace(/["']/g, "") + '">'
          +   '<div class="tree-leaf-inner">'
          +     (leaf.hasChildren ? expanderHTML : '')
          +     '<span class="tree-leaf-label">'
          +       sail.escapeHTML(label)
          +     '</span>'
          +   '</div>'
          + '</li>'
  }
  return html
}

function getLeafExpander(leafEl) {
  var expander = leafEl.firstElementChild.firstElementChild
  if (expander && expander.className.indexOf("tree-expander") > -1) {
    return expander
  }
}

function makeSubTree() {
  return sail.createElement("ul", {className: "tree-sub"})
}
