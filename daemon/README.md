## zag-daemon

The daemons aggregate the raw points sent by [`zag-agent`][agent].

It is also responsible for monitoring and alerting, though that functionality
is disabled for now.

## Service setup

In order to scale, metrics data can be spread across multiple daemons that are
configured as a ring. A list of their `address:port`s needs to be passed in
as the `join` option.

```javascript
require('zag-daemon')(
{ host:   "address:port"
, join:  ["address:port"]
, db:     "postgres://postgres:1234@localhost/postgres"
, env:    "prod" or "dev"
, backend: require('zag-backend-pg')
}).on("error", function(err) { })
```

## API

[zag-agent][agent] uses the UDP API.

### UDP

The primary protocol for recording metrics is over UDP. Each daemon is running a UDP
server on `options.host`.

The data should be newline-delimited lines of the form:

    <type>:<key>=<value>

where

  * `type`  - `counter` or `histogram`.
  * `key`   - `[>| \w/._()+:-]+`
  * `value` - Number. Positive or negative, integer or decimal.

### HTTP
#### POST /api/metrics

The POST body should be in the same format as the UDP data. The points are
recorded as the arrive, so the client can just keep sending data down a
single connection instead of making repeated requests.

[agent]: https://github.com/Voxer/zag/tree/master/agent
