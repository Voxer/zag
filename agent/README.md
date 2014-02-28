## zag-agent

The metrics agent sends raw points to the zag-daemons where they will
be aggregated.

## API

```javascript
var agent = require('zag-agent')([/* list of all metrics daemon "address:ports" */])
```

### `MetricsAgent#counter(String mkey[, Number value])`

Increment a counter.

```javascript
agent.counter("signup")
```

Increment a counter by a specific value.

```javascript
agent.counter("search_results", results.length)
```

### `MetricsAgent#histogram(String mkey, Number value)`

Track a distribution of values.
All histograms automatically get a heat map.

```javascript
agent.histogram("HTTP_server_latency|/index.html", 123)
```

### `MetricsAgent#scope(String scope)`

Often times all of the metrics in a particular module should be scoped under
the same key. `#scope(key)` returns a `MetricsAgent` that automatically prepends
that key:

```javascript
var latency = agent.scope("http_latency")
// This is the same as `agent.counter("http_latency>/index.html")`:
latency.counter("/index.html")
```

`.close()`ing a scoped agent will close the parent agent (they share a socket).

### `MetricsAgent#on("error", function(err) { })`

The socket emitted an error.

### `MetricsAgent#close()`

Close the socket.

```javascript
agent.close()
```
