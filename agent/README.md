# metrics-agent

The metrics agent sends raw points to the metrics-daemons where they will
be aggregated.

Metrics keys may include the characters: `[ \w/._()+:-]`, as well as `>`
and `|` as separators. Metrics sent with invalid keys are silently ignored.

In `A|B`, A is an aggregate key.
In `A>B`, A has no points associated with it, it is just a scope in the tree widget.

# Usage

    var agent = require('metrics-agent')([/* list of all metrics daemon "address:ports" */])

## `MetricsAgent#counter(String mkey[, Number value])`

Increment a counter.

    agent.counter("signup")

Increment a counter by a specific value.

    agent.counter("search_results", results.length)

## `MetricsAgent#histogram(String mkey, Number value)`

Track a distribution of values.
All histograms automatically get a heat map.

    agent.histogram("HTTP_server_latency|/index.html", 123)

## `MetricsAgent#scope(String scope)`

Often times all of the metrics in a particular module should be scoped under
the same key. `#scope(key)` returns a `MetricsAgent` that automatically prepends
that key:

    var latency = agent.scope("http_latency")
    // This is the same as `agent.counter("http_latency>/index.html")`:
    latency.counter("/index.html")

`.close()`ing a scoped agent will close the parent agent (they share a socket).

## `MetricsAgent#on("error", function(err) { })`

The socket emitted an error.

## `MetricsAgent#close()`

Close the socket.

    agent.close()

