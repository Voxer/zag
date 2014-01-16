# Setup

  1. Setup a Postgres database.
  2. Run the setup script in `metrics-backend-pg`.
    This will create the tables and indices.
  3. Setup some `metrics-daemon` processes.
    The daemons are responsible for aggregating and monitoring the metrics and
    saving them to the database.
  4. Setup a `metrics-web` process. `metrics-web` handles data visualization
    and manages ancillary data such as tags and dashboards.
  5. Start sending data to the daemons using `metrics-agent` in your application.
  6. Explore the data in `metrics-web`'s interface.

