## zag

Zag-Web serves the graphing frontend.

## Setup

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

## Features

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
  * There is an API CLI in [`web/bin/admin.js`](https://github.com/Voxer/zag/blob/master/web/bin/admin.js).

## HTTP API
### Metrics
#### `GET /api/metrics/:mkey`
Get historical (_not_ live) metrics data for a `:mkey`.
##### Querystring

  * `start` - Integer timestamp, _required_
  * `end`   - Integer timestamp, _required_
  * `delta` - Integer milliseconds.
    The downsample interval (e.g. 60000, 300000, ...) _optional_.
    Defaults to 1 minute (60000).

##### Response: 200
The response JSON will depending on whether the data is a histogram, counter, heat map, etc.

**Histogram**:
```javascript
[ { "ts":    Integer
  , "count": Number
  , "mean":  Number
  , "p10":   Number
  , ...
  } or { "ts": Integer, "empty": true }
, ...
]
```

**Counter**:
```javascript
[ { "ts":    Integer
  , "count": Number
  } or { "ts": Integer, "empty": true }
, ...
]
```

**Heat map**: (buckets are sorted)
```javascript
[ [timestamp, bucketA, frequencyA, bucketB, frequencyB, ...]
, ...
]
```

---

### Keys
#### `GET /api/keys`
Get a sorted list of the top-level metrics keys.

##### Response: 200
```javascript
[ { "key":         String
  , "hasChildren": Boolean
  , "type":       "histogram" | "counter" | "none"
  }
, ...
]
```

`"none"` is the type of the key `A` when data is sent to `A>B`,
because there is no actual metrics data associated with it.

#### `GET /api/keys/:parents`
Get the children of 1 or more parent metrics keys.

`:parents` is a comma-separated list of metrics keys to look up.

##### Response: 200
Returns lists of the child keys keyed by their parents.
```javascript
{ "parentkey1":
  [ { "key":         String
    , "hasChildren": Boolean
    , "type":       "histogram" | "counter" | "none"
    }
  , ...
  ]
, ...
}
```

#### `DELETE /api/keys/:mkey`
Delete a metrics key and all of its children.
The associated metrics data is not deleted.
##### Response: `204`


#### `GET /api/filter`
Get a list of metrics keys matching a query.
##### Querystring

  * `q`     - String, the query. _required_
  * `limit` - Integer, max results _optional_

##### Response: 200
```javascript
[ { "key":         String
  , "hasChildren": Boolean
  , "type":       "histogram" | "counter" | "none"
  }
, ...
]
```

#### `GET /api/allkeys`
Get a sorted list of _all_ metrics keys (recursive).
##### Response: 200
```javascript
[ "key1"
, "key2"
, "key2|bar"
, "key2|foo"
, "key3"
, ...
]
```

---

### Tags
#### `GET /api/tags`
Get a list of tags in a time range, sorted by `ts`.
##### Querystring

  * `begin` - Integer timestamp, _required_
  * `end`   - Integer timestamp, _required_

##### Response: 200
```javascript
[ { "id":    String, unique tag identifier
  , "ts":    Integer, position timestamp
  , "label": String
  , "color": String, hex e.g. "#f00"
  }
, ...
]
```

#### `POST /api/tags`
Create a tag.
##### Querystring

  * `ts`    - Integer timestamp, _required_
  * `color` - String hex color, _required_
  * `label` - String tag label, _required_
  * `id`    - String, _optional_. If `id` isn't passed, it will be assigned.

##### Response: 204

#### `DELETE /api/tags/:id`
Delete a tag by `:id`.
##### Response: 204

### Tag types
#### `GET /api/tagtypes`
List all tag types.

##### Response: 200
```javascript
[ { "color": String
  , "name":  String
  , "id":    String
  }
, ...
]
```

#### `POST /api/tagtypes`
Create a tag type.
##### Querystring

  * `color` - String, e.g. "#ff0000" _required_
  * `name`  - String, a short description of the category _required_

##### Response: 204

#### `DELETE /api/tagtypes/:id`
Delete a tag type by `:id`.
The tag type's ID can by found via `GET /api/tagtypes`.
##### Response: 204

---

### Dashboards
#### `GET /api/dashboards`
Get a sorted list of all dashboard IDs.

##### Response: 200
```javascript
[ "dashboard1"
, "dashboard1>subdashboard"
, "dashboard2"
, ...
]
```

#### `GET /api/dashboards/:id`
Get a dashboard by `:id`.
##### Response: 200
```javascript
{ "id": String :id
, "graphs":
  { "<graph id 1>":
    { "id":      "<graph id 1>"
    , "key":     [String metrics key]
    , "title"     String, optional
    , "subkey"    String, optional
    , "renderer"  String, optional
    , "histkeys" [String], optional
    }
  , ...
  }
}
```

#### `POST /api/dashboards/:id`
Replace the dashboard.
The post data should be `{"graphs": {all the graphs}}`.
##### Response: 204

#### `PATCH /api/dashboards/:id`
To rename a dashboard, the request body should be `{"id": "<new id>"}`.

To edit a dashboard's graphs, the request body should be `{"graphs": {updated graphs by graph id}}`.
Graphs that are not included will be left unchanged, not removed.
##### Response: 204

#### `DELETE /api/dashboards/:id`
Delete the dashboard by `:id`.
##### Response: 204
