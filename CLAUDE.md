# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a multi-package monorepo. Each subdirectory is an independently published npm package:

- `agent/` (`zag-agent`) — client library; emits raw metric points over UDP/HTTP to daemons.
- `daemon/` (`zag-daemon`) — receives raw points, aggregates them, and writes through a backend.
- `backend-pg/` (`zag-backend-pg`) — Postgres/TimescaleDB storage backend used by the daemon and web. Setup script at `backend-pg/bin/setup.js` requires TimescaleDB.
- `web/` (`zag` on npm, but currently `@patrick.kokou/zag` in `package.json`) — HTTP server that exposes the read API and serves the browser UI. **Most work happens here.**

The packages depend on each other by published name (`zag-agent`, `zag-daemon`, `zag-backend-leveldb`), not via workspaces — `web/` has its own `node_modules/`. There is no top-level `package.json` and no monorepo tooling (no Lerna/Yarn workspaces). When developing across packages you may need to `npm link` or install local copies into `web/node_modules/`.

## Commands

Tests use [`tap`](https://node-tap.org/) ~0.4 (legacy version):

```bash
# Run a package's full test suite (from inside that package directory):
cd web && npm test           # tap $(find test -name '*.test.js' | sort)
cd agent && npm test
cd daemon && npm test

# Run a single test file:
cd web && ./node_modules/.bin/tap test/api.test.js
```

`backend-pg` has no tests (its `npm test` is a stub).

The web app is started by requiring `zag` and calling it with options — there is no `npm start`. See `web/README.md` for the option shape. In a local dev session, the server typically runs on `127.0.0.1:8080` (the `.claude/settings.local.json` allowlist hits that address).

CSS (Stylus) and JS (Browserify) are **bundled at server startup** by `web/app/index.js` — there is no separate build step. Edits to `client/stylus/*.styl` or `client/js/**/*.js` require restarting the web process to take effect. In `env: "prod"` the JS bundle is also minified with UglifyJS and a sourcemap is emitted; in any other env the unminified bundle is reused as `bundle.min.js`.

The dev backend of choice is LevelDB via `zag-backend-leveldb` (a separate repo) — it's lighter than Postgres for testing, and is what the integration test in `web/test/index.test.js` uses.

## Architecture

### Data flow
`agent` → (UDP) → `daemon` → (backend writes) → Postgres/Timescale → `web` reads same backend → HTTP/SSE → browser.

The daemons are configured as a ring (the `join` option). Each daemon owns a slice of the metric key space; the web layer fans reads out across all daemons it knows about (the `daemons` option).

### Metric key syntax
Metric keys use two special separators that show up everywhere in both UI and storage:

- `>` denotes hierarchy. `notifications>gcm>sent` is a leaf under the `notifications>gcm` parent. The web client renders this as a tree (`web/client/js/models/implicit-tree.js`).
- `|` denotes a tag dimension. `notifications>gcm>sent_type|image` is the `sent_type` metric tagged with `image`.

Both characters are reserved in keys — see the UDP key regex in `daemon/README.md`. Anywhere you see "subkey" / "histkeys" / "tag" in code, the `|` separator is likely involved.

### Web server (`web/`)

- Entry: `web/index.js` → `web/app/index.js` (`MetricsWeb`). Constructor wires up the daemon agent, the backend, the router, and an HTTP server, and **synchronously kicks off the CSS+JS build before listening**. The `"ready"` event fires only after assets are built and the port is bound.
- Routing: `web/app/routes.js` (`MetricsRouter`). Hand-rolled with the `routes` package, no Express. Adds `/api/*` JSON routes plus catch-all `/graph/*` and `/dashboards/*` that all serve the same SPA HTML.
- Models (server side, in `web/app/models/`):
  - `dashboard.js` — `DashboardManager`; dashboard JSON shape is `{ id, graphs: { <id>: { title, keys, renderer, subkey, histkeys } } }` (no geometry field — layout is CSS flow).
  - `mkeys.js` — key-tree cache (reloaded once a minute, see `MetricsRouter` constructor).
  - `monitor.js`, `tag-type.js`, `channel/` — alerting (currently disabled per `daemon/README.md`), tag categories, and SSE channels.
- HTTP read API surface is documented in `web/README.md`. Treat that as authoritative for the API contract.

### Web client (`web/client/`)

- Bootstraps from `client/js/index.js` which constructs a `Layout` from `ui/index.js` driven by `PlotSettings` parsed off the URL querystring. URL state is the source of truth for what's being viewed; there's a custom router-ish setup in `client/js/models/router.js` and `history.js`.
- Models in `client/js/models/` are plain JS objects that fetch from the API and emit events; views in `client/js/ui/` render with d3 v3 (pinned to `~3.5.11`) — **do not assume v4+ APIs**.
- Charts: `client/js/models/chart/set.js` defines the layout constants (e.g. `LAYOUT_DASHBOARD`); `client/js/ui/chart-view-set.js` maps those to CSS classes (`layoutToClass`); `client/js/ui/chart2/` holds the actual rendering primitives.
- Dashboards specifically:
  - Server model: `web/app/models/dashboard.js`, routes under `/api/dashboards/*` in `web/app/routes.js`.
  - Client model: `web/client/js/models/dashboard.js` and `dashboard-tree.js`.
  - Client UI: `web/client/js/ui/dashboard-tree-view.js`, `dashboard-chart-view.js` (note the `WIZARD` constant — editing flow is one-chart-at-a-time), and views in `client/js/ui/views/dashboard-*.js`.
  - Styles: `web/client/stylus/views/dashboard-*.styl`.
  - Time range is **global** (URL-driven), not stored per dashboard. There is no per-panel geometry in the schema today — layout is pure CSS flow.

### Conventions in this codebase

- ES5 throughout — `var`, `function` declarations, `inherits(...)` from `util` for prototype chains, leading-comma multi-`var` declarations. Match the surrounding style; do not reach for ES2015+ syntax (classes, `const`, arrow fns, destructuring) unless a file already uses it.
- Node-style `(err, result)` callbacks; promises and `async/await` are not used.
- Packages target `node >= 18` (see `web/package.json` `engines`), but the dependency versions are old and pinned (`d3` 3.5, `tap` 0.4, `stylus` 0.27).

### Admin CLI

`web/bin/admin.js` is a CLI that hits the HTTP API for tag-type and dashboard management. Exposed as the `zag-admin` bin when `web` is installed.
