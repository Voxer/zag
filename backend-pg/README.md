# Setup

The setup script will create the tables and indices.

    # Print usage.
    $ ./bin/setup.js

## Schema notes

This package (`@patrick.kokou/zag-backend-pg@^2.0.1`) is pinned to the
legacy `0.0.7`-era schema (`prod_metrics_data` with
`metrics_key/time_start/data text-blob`) so it interoperates with the
existing production Cloud SQL deployment. It does **not** require
TimescaleDB. The `pg` driver is upgraded to `^8` for Node 18+
compatibility (the only practical change vs. `0.0.7`).

The `master`-era schema migration (column-per-statistic +
`prod_metrics_data_llq`) lives elsewhere in the repo's history; pick it
up only when production Postgres is migrated.
