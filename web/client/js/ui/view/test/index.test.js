var test     = require('tap').test
  , inherits = require('util').inherits
  , SkyView  = require('../')
  , Shim     = require('../lib/shims/node')

test("Initialization", function(t) {
  test("View", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView, {body: "hello"})
    View.prototype.View('<div>{body}</div>')

    var view = new View()
    t.isa(view._scope, "string")
    t.ok(view._scope == +view._scope)
    t.deepEquals(view.el, {html: "<div>hello</div>"})
    t.end()
  })

  test("unique scope", function(t) {
    var shim   = makeShim()
      , View   = makeView(SkyView, {body: "hello"})
      , scopes = {}
    View.prototype.View('<div>{body}</div>')

    for (var i = 0; i < 100; i++) {
      scopes[(new View())._scope] = true
    }
    t.equals(Object.keys(scopes).length, 100)
    t.end()
  })

  test("View#render", function(t) {
    var shim     = makeShim()
      , View     = makeView(SkyView, {body: "hello"})
      , rendered = false
    View.prototype.View('<div>{body}</div>')
    View.prototype.render = function() {
      t.isa(this, View)
      t.ok(this._scope)
      t.deepEquals(this.el, {html: "<div>hello</div>"})
      rendered = true
    }
    var view = new View()
    t.ok(rendered)
    t.end()
  })

  test("bind elements", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView, {body: "hello"})
    View.prototype.View('<div:top><span:title class="bar">foo</span></div>')
    var view = new View()
    t.ok(hmatch(view.el.html, '<div id="sv-?-?"><span id="sv-?-?" class="bar">foo</span></div>'))
    t.isa(view.top.id, "string")
    t.isa(view.title.id, "string")
    t.notEquals(view.top.id, view.title.id)
    t.end()
  })

  test("template inheritance is precomputed", function(t) {
    var shim       = makeShim()
      , ParentView = makeView(SkyView)
      , View       = makeView(ParentView)

    ParentView.prototype.View('<div><span>{title}</span></div>')
    View.prototype.View({title: "TITLE"})

    var view = new View({title: "ignored"})
    t.deepEquals(view.el, {html: "<div><span>TITLE</span></div>"})
    t.end()
  })

  test("copy template by default", function(t) {
    var shim       = makeShim()
      , ParentView = makeView(SkyView)
      , View       = makeView(ParentView)

    ParentView.prototype.View('<div><span>{title}</span></div>')
    View.prototype.View()

    var view = new View({title: "TITLE"})
    t.deepEquals(view.el, {html: "<div><span>TITLE</span></div>"})
    t.end()
  })

  t.end()
})

test("Events", function(t) {
  test("string listener", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView, {title: "hello"})

    View.prototype.View('<div>{title}</div>')
      .on({"div click": "onClick"})
    View.prototype.onClick = function(ev) {
      t.deepEquals(ev, { type: "click", target: {tag: "div"} })
      t.equals(this, view)
      c++
    }

    var view = new View({title: "hi"})
      , c    = 0
    shim.emit("click", {tag: "div"})
    t.equals(c, 1)
    t.end()
  })

  test("function listener", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView, {body: "hello"})

    View.prototype.View('<div>{title}</div>')
      .on({"div click": onClick})
    var view = new View({title: "hi"})
      , c    = 0
    shim.emit("click", {tag: "div"})
    t.equals(c, 1)
    t.end()

    function onClick (ev) {
      t.deepEquals(ev, { type: "click", target: {tag: "div"} })
      t.equals(this, view)
      c++
    }
  })

  test("inherits events", function(t) {
    var shim       = makeShim()
      , ParentView = makeView(SkyView, {title: "hello"})
      , View       = makeView(ParentView)

    ParentView.prototype.View('<div><span>{title}</span></div>')
      .on({"div click": "onClick1"})
    ParentView.prototype.onClick1 = function(ev) {
      t.deepEquals(ev, { type: "click", target: {tag: "div"} })
      c1++
    }
    View.prototype.View({})
      .on({"span click": "onClick2"})
    ParentView.prototype.onClick2 = function(ev) {
      t.deepEquals(ev, { type: "click", target: {tag: "span"} })
      c2++
    }

    var view = new View()
      , c1 = 0, c2 = 0
    shim.emit("click", {tag: "div"})
    t.equals(c1, 1)
    t.equals(c2, 0)
    shim.emit("click", {tag: "span"})
    t.equals(c1, 1)
    t.equals(c2, 1)
    t.end()
  })

  test("catch-all selector", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView, {body: "hello"})

    View.prototype.View('<div>{title}</div>').on({"click": onClick})
    var view = new View({title: "hi"})
      , c    = 0

    shim.emit("click", {tag: "span"})
    t.equals(c, 1)
    t.end()

    function onClick (ev) {
      t.deepEquals(ev, { type: "click", target: {tag: "span"} })
      t.equals(this, view)
      c++
    }
  })

  t.end()
})


test("View#remove", function(t) {
  var shim = makeShim()
    , View = makeView(SkyView)
    , el   = {html: "<div>hi</div>"}
  View.prototype.View("<div>{body}</div>")

  var view = new View({body: "hi"})
  view.remove()
  t.deepEquals(view.el, el)
  t.deepEquals(shim.ops, [ ["create", el], ["remove", el] ])
  t.end()
})


test("View#destroy", function(t) {
  test("simple", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView)
    View.prototype.View("<div>{body}</div>")

    var view = new View({body: "hi"})
    t.ok(view.el)
    view.destroy()
    t.notOk(view.el)
    t.deepEquals(shim.ops,
      [ ["create", {html: "<div>hi</div>"}]
      , ["remove", {html: "<div>hi</div>"}]
      ])
    t.end()
  })

  test("element bindings", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView)
    View.prototype.View("<div:top>{body}</div>")

    var view = new View({body: "hi"})
    t.ok(view.el)
    t.ok(view.top)
    view.destroy()
    t.notOk(view.el)
    t.notOk(view.top)
    t.end()
  });

  test("onDestroy function", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView)
      , d    = 0
    View.prototype.View("<div:top>{body}</div>").destroy(function() { d++ })

    var view = new View({body: "hi"})
    view.destroy()
    t.equals(d, 1)
    t.end()
  })

  test("onDestroy string", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView)
      , d    = 0
    View.prototype.View("<div:top>{body}</div>").destroy("onDestroy")
    View.prototype.onDestroy = function() {
      d++
      t.equals(this, view)
    }

    var view = new View({body: "hi"})
    view.destroy()
    t.equals(d, 1)
    t.end()
  })

  test("onDestroy inheritance", function(t) {
    var shim       = makeShim()
      , ParentView = makeView(SkyView)
      , View       = makeView(ParentView)
      , d0 = 0, d1 = 0
    ParentView.prototype.View("<div:top>{body}</div>").destroy(function() {
      d0++; t.equals(this, view)
    })
    View.prototype.View({body: "hi"}).destroy(function() {
      d1++; t.equals(this, view)
    })

    var view = new View()
    view.destroy()
    t.equals(d0, 1)
    t.equals(d1, 1)
    t.end()
  })

  test("onDestroy chain", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView)
      , d    = 0
    View.prototype.View("<div:top>{body}</div>").on({}).destroy(function() { d++ })

    var view = new View({body: "hi"})
    view.destroy()
    t.equals(d, 1)
    t.end()
  })

  test("multiple times", function(t) {
    var shim = makeShim()
      , View = makeView(SkyView)
      , d    = 0
    View.prototype.View("<div:top>{body}</div>").on({}).destroy(function() { d++ })

    var view = new View({body: "hi"})
    view.destroy()
    view.destroy()
    t.equals(d, 1)
    t.end()
  })

  t.end()
})


test("View.template", function(t) {
  var tmpl = SkyView.template
  t.equals(tmpl("",                {}),            "")
  t.equals(tmpl("{body}",          {}),            "{body}")
  t.equals(tmpl("{body} body",     {}),            "{body} body")
  t.equals(tmpl("",                {body: "foo"}), "")

  t.equals(tmpl("{body}",          {body: "foo"}), "foo")
  t.equals(tmpl("({body})",        {body: "foo"}), "(foo)")
  t.equals(tmpl("{a.b} {a_b}",     {"a.b": "Q"}),  "Q {a_b}")
  t.equals(tmpl("(a.b {a.b})",     {"a.b": "Q"}),  "(a.b Q)")

  t.equals(tmpl("{title}:{title}", {title: "Q"}),  "Q:Q")
  t.equals(tmpl("{A}:{B}:{C}",     {A: "a", B: "b", C: "c"}), "a:b:c")
  t.end()
})


////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function makeView(ParentView, opts) {
  function View(o) { ParentView.call(this, o || opts) }
  inherits(View, ParentView)
  return View
}

function hmatch(html, pat) {
  var re = new RegExp
    ( "^"
    + pat.replace(/([^\w\s?])/g, "[$1]").replace(/\?/g, "\\d+")
    + "$")
  return re.test(html)
}

function makeShim() {
  var shim = new Shim()
  SkyView.shim(shim)
  return shim
}
