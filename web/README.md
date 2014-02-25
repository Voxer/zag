# zag

Zag-Web serves the graphing frontend.

# Setup

Start the server:

```javascript
require('zag')(
{ host:        "address:port"
, db:          "postgres://postgres:1234@localhost/postgres"
, env:         "dev" or "prod"
, daemons:    ["address:port", ...]
, defaultPath: "/graph/your_favorite_metric"
, backend:     require('zag-backend-pg')
// This directory needs to be readable and writable by the process.
, public:      "/tmp/metrics-public"
}).on("error", function(err) {
  // An error occurred.
}).on("ready", function() {
  // The server is listening.
})
```

# Features

  * Press `?` for keyboard shortcuts.
  * Graphs
    * To zoom a graph, click and drag vertically or horizontally.
    * To revert the zoom, double-click the graph.
    * To pan a graph, shift click and drag.
    * To monitor a live graph, select an interval from the "minutes" row of the range picker.
  * Tree
    * Clicking on a triangle expands/collapses the keys.
    * Shift-clicking on a triangle graphs all of the key's children.
    * Shift-click on a leaf to overlay it on the current graph.
  * Tags
    * Each "tag" has a timestamp, a label, and a category.
      The category determines the tag color.
    * Use the `admin.js` script to create and manage tag categories.
    * To create a tag manually, right-click a graph's X axis.
    * To edit an existing tag, left-click it's tick mark on the X axis.
  * There is an API CLI in [`web/bin/admin.js`](https://github.com/Voxer/metrics/blob/master/web/bin/admin.js).

