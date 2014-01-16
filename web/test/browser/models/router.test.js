var test         = require('tap').test
  , qs           = require('querystring')
  , Router       = require('../../../client/js/models/router')
  , PlotSettings = require('../../../client/js/models/plot-settings')
  , HISTOGRAM    = PlotSettings.HISTOGRAM

Router.toQueryString = qs.stringify
Router.parseQuery    = qs.parse

test("Router", function(t) {
  var loc    = toLocation("/")
    , sett   = new PlotSettings({})
    , router = new Router(loc, sett)
  t.equals(router.location, loc)
  t.equals(router.settings, sett)
  t.end()
})

;[{ name: "select:none"
  , url:  "/graph/"
  , events:
    [ ["select:none"]
    , ["title",       "[M] "]
    , ["range:real",  "-3d", null]
    , ["delta",       "auto"]
    , ["renderer",    "line"]
    , ["histkeys",     HISTOGRAM]
    , ["subkey",      "count"]
    ]
  }
, { name: "select:one"
  , url: "/graph/foo?delta=5m"
  , events:
    [ ["select:one", "foo"]
    , ["title",      "[M] foo"]
    , ["range:real", "-3d", null]
    , ["delta",      "5m"]
    , ["renderer",   "line"]
    , ["histkeys",    HISTOGRAM]
    , ["subkey",     "count"]
    ]
  }
, { name: "select:many"
  , url: "/graph/foo,bar?end=1385228354776"
  , events:
    [ ["select:many", ["foo", "bar"]]
    , ["title",       "[M] foo \u2026"]
    , ["range:real",  "-3d", "1385228354776"]
    , ["delta",       "auto"]
    , ["renderer",    "line"]
    , ["histkeys",     HISTOGRAM]
    , ["subkey",      "count"]
    ]
  }
, { name: "select:dashboard"
  , url: "/dashboards/" + encodeURIComponent("a b> c")
  , events:
    [ ["select:dashboard", "a b> c"]
    , ["title",            "[M] a b> c"]
    , ["range:real",       "-3d", null]
    , ["delta",            "auto"]
    , ["renderer",         "line"]
    , ["histkeys",          HISTOGRAM]
    , ["subkey",           "count"]
    ]
  }
].forEach(function(T) {
  test("Router#onPopState " + T.name, function(t) {
    var router = new Router(toLocation(T.url), new PlotSettings({}))
      , events = []
    router.emit = function() { events.push([].slice.apply(arguments)) }
    router.onPopState()
    t.deepEquals(events, T.events)
    t.end()
  })
})

;[{ name:  "select:one"
  , mode:  "graph"
  , data: ["bar"]
  , title: "[M] bar"
  , url:   "/graph/bar?start=-3d"
  }
, { name:  "select:many"
  , mode:  "graph"
  , data: ["abc", "def"]
  , title: "[M] abc \u2026"
  , url:   "/graph/abc,def?start=-3d"
  }
, { name:  "select:dashboard"
  , mode:  "dashboard"
  , data:  "a b> c"
  , title: "[M] a b> c"
  , url:   "/dashboards/" + encodeURIComponent("a b> c") + "?start=-3d"
  }
, { name:  "unchanged"
  , mode:  "graph"
  , data: ["foo"]
  , title: "[M] foo"
  , url:   null
  }
].forEach(function(T) {
  test("Router#update " + T.name, function(t) {
    var router = new Router(toLocation("/graph/foo?start=-3d"), new PlotSettings({}))
      , _title
    router.on("title", function(title) {
      t.equals(title, T.title)
      _title = true
    })
    t.equals(router.update(T.mode, T.data), T.url)
    if (T.title) {
      t.ok(_title)
    } else {
      t.notOk(_title)
    }
    t.end()
  })

  test("Router#permalink " + T.name, function(t) {
    if (!T.url) return t.end()
    var router = new Router(toLocation("/graph/foo?start=-3d"), new PlotSettings({}))
    t.equals(router.permalink(T.mode, T.data)
      , "http://127.0.0.1"
      + T.url.split("?")[0]
      + "?start=" + router.settings.start
      + "&end="   + router.settings.end)
    t.end()
  })
})

test("Router#getGraphURL", function(t) {
  var router = new Router(toLocation("/graph/foo"), new PlotSettings({}))
  // One
  t.equals(router.getGraphURL(["foo bar"]), "/graph/" + encodeURIComponent("foo bar") + "?start=-3d")
  // Many
  t.equals(router.getGraphURL(["foo", "bar"]), "/graph/foo,bar?start=-3d")
  // QS
  t.equals(router.getGraphURL(["foo"], {start: "-1d"}), "/graph/foo?start=-1d")
  // Clean falsey QS values.
  t.equals(router.getGraphURL(["foo"], {subkey: false}), "/graph/foo?start=-3d")
  // Clean histkeys
  t.equals(router.getGraphURL(["foo"], {histkeys: HISTOGRAM}), "/graph/foo?start=-3d")
  t.end()
})

test("Router#getDashboardURL", function(t) {
  var router = new Router(toLocation("/graph/foo"), new PlotSettings({}))
  t.equals(router.getDashboardURL("a b> c"), "/dashboards/" + encodeURIComponent("a b> c") + "?start=-3d")
  t.end()
})


test("Router#path", function(t) {
  var router = new Router(toLocation("/foo/bar?a=b"), new PlotSettings({}))
  t.equals(router.path(), "/foo/bar?a=b")
  t.end()
})

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function toLocation(url) {
  var parts = url.split("?")
  return { origin:  "http://127.0.0.1"
         , pathname: parts[0]
         , search:   parts[1] && ("?" + parts[1])
         }
}
