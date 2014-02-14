# Setup

  1. Set up a Postgres database.
  2. Run the setup script in [`metrics-backend-pg`][backend].
    This will create the tables and indices.
  3. Setup some [`metrics-daemon`][daemon] processes.
    The daemons are responsible for aggregating and monitoring the metrics and
    saving them to the database.
  4. Setup a [`metrics-web`][web] process. [`metrics-web`][web] handles data visualization
    and manages ancillary data such as tags and dashboards.
  5. Start sending data to the daemons using [`metrics-agent`][agent] in your application.
  6. Explore the data in [`metrics-web`][web]'s interface.

[agent]: https://github.com/Voxer/metrics/tree/master/agent
[backend]: https://github.com/Voxer/metrics/tree/master/backend-pg
[daemon]: https://github.com/Voxer/metrics/tree/master/daemon
[web]: https://github.com/Voxer/metrics/tree/master/web
