#### Quick start guide

You'll need a Postgres database before you get started.

Then:

    $ npm install -g zag-standalone
    $ start-zag <tcp://postgres URI>
    zag-web listening on 0.0.0.0:8875
    zag-daemon pool: ["127.0.0.1:8876"]

The first time you run it, wait a minute for the key list to populate
with the first data points.
Next, point your browser to the address the script printed.

Now you're ready to start sending metrics data using [zag-agent][agent].

    $ npm install zag-agent

then:

```javascript
var agent = require('zag-agent')(["127.0.0.1:8876"])
for (var i = 0; i < 1000; i++) {
  agent.histogram("foo|bar", Math.random() * 100)
}

agent.counter("demo")

setTimeout(function() {
  agent.close()
}, 1500)
```

It can take up to 1 minute for non-live metrics to appear.

#### Scaling up

The standalone helper will only get you so far. If you are running zag in
production, the load should be spread across multiple daemons.

  1. Set up a postgres database.
  2. Run the setup script in [zag-backend-pg][backend].
    This will create the tables and indices.
  3. Set up some [zag-daemon][daemon] processes.
    The daemons are responsible for aggregating and monitoring the metrics and
    saving them to the database.
  4. Set up a [zag-web][web] process. [zag-web][web] handles data visualization
    and manages ancillary data such as tags and dashboards.
  5. Start sending data to the daemons using [zag-agent][agent] in your application.
  6. Explore the data in [zag-web][web]'s interface.

[agent]:   https://github.com/Voxer/zag/tree/master/agent
[backend]: https://github.com/Voxer/zag/tree/master/backend-pg
[daemon]:  https://github.com/Voxer/zag/tree/master/daemon
[web]:     https://github.com/Voxer/zag/tree/master/web
