
  1. Set up a Postgres database.
  2. Run the setup script in [`zag-backend-pg`][backend].
    This will create the tables and indices.
  3. Setup some [`zag-daemon`][daemon] processes.
    The daemons are responsible for aggregating and monitoring the metrics and
    saving them to the database.
  4. Setup a [`zag-web`][web] process. [`zag-web`][web] handles data visualization
    and manages ancillary data such as tags and dashboards.
  5. Start sending data to the daemons using [`zag-agent`][agent] in your application.
  6. Explore the data in [`zag-web`][web]'s interface.

[agent]: https://github.com/Voxer/zag/tree/master/agent
[backend]: https://github.com/Voxer/zag/tree/master/backend-pg
[daemon]: https://github.com/Voxer/zag/tree/master/daemon
[web]: https://github.com/Voxer/zag/tree/master/web
