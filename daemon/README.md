## zag-daemon

The daemons aggregate the raw points sent by `zag-agent`.

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
