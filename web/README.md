# metrics-web

Metrics-Web serves the graphing frontend.

# Setup

Start the server: (the public directory needs to be readable/writable).

    require('metrics-web')(
    { host:        "address:port"
    , db:          "postgres://postgres:1234@localhost/postgres"
    , env:         "dev" or "prod"
    , daemons:    ["address:port", ...]
    , defaultPath: "/graph/your_favorite_metric"
    , backend:     require('metrics-backend-pg')
    , public:      "/tmp/metrics-public"
    }).on("error", function(err) {
      // An error occurred.
    }).on("ready", function() {
      // The server is listening.
    })

# Features

  * Press `?` for keyboard shortcuts.
  * Graphs
    * To zoom a graph, click and drag vertically or horizontally.
    * To revert the zoom, double-click the graph.
    * To pan a graph, shift click and drag.
  * Tree
    * Clicking on a triangle expands/collapses the keys.
    * Shift-clicking on a triangle graphs all of the key's children.
  * Tags
    * To create a tag manually, right-click a graph's X axis.
    * To edit an existing tag, left-click it's tick mark on the X axis.

