# metrics-daemon

The daemons aggregate the raw points sent by `metrics-agent`.

# Service setup

    require('metrics-daemon')(
    { host:   "address:port"
    , join:  ["address:port"]
    , db:     "postgres://postgres:1234@localhost/postgres"
    , env:    "dev" or "prod"
    , logger:  console
    , backend: require('metrics-backend-pg')
    }).on("error", function(err) { })

