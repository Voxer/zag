# Future Metrics Work

## Status

- **Approved at meeting on 2026-05-18.** All workstreams greenlit.
- **Sequencing locked:** Phase 1 + Phase 2 (foundation) first; Workstreams A/B/C in parallel after; Workstream D (proactive alerting) **last**.
- **Thresholds stay in Chef** — git-tracked, code-reviewable. The *format* expands and *evaluation* moves into zag, but *storage* remains in Chef → JSON file → zag reads.
- **Ring/topology source of truth = Chef** (consistent with the threshold decision).
- **Phase 1 ✅ IMPLEMENTED on branch `jsheehy/zag-changes-1`** (2026-05-18). 244 metrics assertions pass; per-minute responses byte-identical to pre-change; wider-delta histogram values now correct vs previously averaged-and-wrong.
- **Phase 2 ✅ IMPLEMENTED on branch `jsheehy/zag-changes-1`** (2026-05-18). Server-side function-key evaluator with six operators; 348 metrics assertions pass total. Old `{js-expression}` client-side syntax dropped (verified unused).
- **Alerting is untouched.** Nagios → `/api/metrics/<rawkey>` path bypasses the function-key dispatch; in-zag monitor remains disabled. The only behavioral difference: any Nagios threshold tuned against a wrong wider-delta percentile now compares against a correct one.

## Use cases driving the work

- **(a)** Better traditional alerting; **(a-1, LAST)** proactive / anomaly alerting.
- **(b)** Faster investigation from support tickets.

---

## Phase 1 — Honest aggregation (FOUNDATION) ✅ IMPLEMENTED

> **Status (2026-05-18):** Done on `jsheehy/zag-changes-1`. Daemon emits `m2`,
> backend-pg schema has the column, web downsampler uses Chan's pooled variance,
> loader sources percentiles from the `@llq` companion at `delta > minLevel`.
> One correction to the math below: `M2 = variance × (count − 1)` (sample
> variance / Bessel's correction in the `metrics` 0.1.6 library), not
> `variance × count`. Implementation uses sample-variance convention end-to-end.

### What's broken

`web/app/metrics/downsample/histogram.js:26-46` collapses per-minute histogram stats into wider deltas by **summing every field then dividing by bucket count** (except `max`, which is `Math.max`). For:

- **`count`, `max`** — correct (sum and max are valid).
- **`mean`** — biased; correct only when bucket sample counts are equal.
- **`std_dev`** — meaningless (true within-window variance needs *pooled* variance: within-bucket + between-bucket terms).
- **`median`, `p10`, `p75`, `p95`, `p99`** — meaningless (no math op recovers a true percentile from per-bucket percentiles).

So every histogram view past 1-minute delta has been silently wrong for years.

### The fix — two parts

**(a) Pooled variance for `std_dev`.** Store `M2` (sum of squared deviations from the mean) per bucket instead of (or alongside) `std_dev`. The `metrics` npm library exposes `variance()` already — `M2 = variance × count`. Combine across buckets with Chan's parallel-variance algorithm:

```
combined_count = Σ count_i
combined_mean  = Σ (count_i * mean_i) / combined_count
combined_M2    = Σ M2_i + Σ count_i * (mean_i - combined_mean)²
combined_var   = combined_M2 / combined_count
combined_stddev = √combined_var
```

Exact and additive at any zoom.

**(b) LLQ-derived percentiles.** Drop scalar percentiles from the downsample entirely. For any delta > 1 minute, source percentiles from the **LLQ frequency tables** (already stored as the `@llq` companion of every histogram — `metrics_data_llq` table). Sum the per-minute frequency tables componentwise, walk the sorted buckets to the desired quantile. True p95 at any window.

### Files to touch

- `daemon/lib/aggregator/metrics/histogram.js` — emit `M2` (use `this.hist.variance() * count`) alongside or replacing `std_dev`.
- `backend-pg/index.js` — schema: add an `m2` column to the histogram table. (Keep `std_dev` initially for backward compatibility.)
- `web/app/metrics/downsample/histogram.js` — rewrite `combine` / `average` for pooled variance over `{count, mean, M2, max}`. **Remove percentile fields from this downsampler entirely.**
- `web/app/metrics/index.js` — when `type === "histogram"` and `delta > minLevel`, merge LLQ-derived percentiles into the response. Either transparently in the loader or via a query param.
- `web/app/metrics/downsample/llquantize.js` — already correct (sums frequencies); reuse.
- UI (no change strictly required) — `plot-type-popup/histogram.js` keeps its percentile checkboxes; the data sourcing changes underneath them.

### Migration

Existing data has `std_dev`, not `M2`. **Recommended: dual-write, read-with-fallback.** New writes populate both fields. Reads prefer `M2`; fall back to the old downsampler on rows that only have `std_dev`. Avoids a backfill. Eventually a one-shot job can backfill `M2 ≈ std_dev² × count` for historical rows if desired (close enough for most purposes).

---

## Phase 2 — Derived-series layer (FOUNDATION) ✅ IMPLEMENTED

> **Status (2026-05-18):** Done on `jsheehy/zag-changes-1`. Key design pivots
> from the original draft (decided during implementation):
>
> - **Server-side evaluation, not client-side.** The pre-existing
>   `MetricsFunction` stub turned out to be a `new Function`-based JS-expression
>   evaluator running in the browser — and unable to express windowed ops
>   anyway. Dropped it entirely (verified no production consumers) and built
>   the evaluator server-side at `web/app/metrics/function/`. Side benefit:
>   closes a URL → `new Function` XSS hole in the old code.
> - **Surface syntax: `{op(args)}`**, not `{js-expression}`. The `{...}`
>   wrapper is kept (it's how `isFunction` already signals function-keys, and
>   it avoids the `(` `)` ambiguity with chars allowed in storage keys).
>   Inside the braces is now clean named-operator syntax.
> - **Six operators shipped:** `rate`, `delta`, `rolling_mean`,
>   `rolling_stddev`, `zscore`, `ratio`. Each takes `delta` as a trailing arg.
> - **Over-fetch by total lookback in the AST.** Evaluator computes
>   `ops.lookback(ast, delta)` (sum of nested windowed ops), loads raw deps
>   over `[start − lookback, end]`, slices output back to `[start, end]`.
> - **No caching of derived series.** Underlying raw series cached as before;
>   operator math is cheap; cross-key invalidation deferred per design call.
> - **Output type = `counter`**, shape `{ts, count}` — chart pipeline didn't
>   need to learn a new type.
> - **Window-not-filled ⇒ empty point** (Prometheus convention; explicit
>   over biased). Stddev = 0 in zscore ⇒ empty (not 0, not Infinity).
>
> Workstream B (alerting) note: when it starts, the operator implementations
> are reusable as-is, but the **input plumbing diverges by caller** — alerts
> need a streaming in-memory buffer per rule, not the over-fetch path
> (over-fetching on every alert tick would re-read the full window every
> minute). Documented here so the next session doesn't accidentally try to
> share the read path too.

### Goal

A read-time transformation layer that operates on **series of points** — independent of how they were stored. Powers both the chart UI (overlays, bands, anomaly views) and the in-zag alert predicates (Workstream B) from the same code.

### Initial operator set

- `rate(series)` — pointwise `(value[i] - value[i-1]) / Δt`. For counters.
- `delta(series, window)` — pointwise `value[i] - value[i - window]`.
- `rolling_mean(series, window)` — pointwise mean of last N points.
- `rolling_stddev(series, window)` — pointwise stddev of last N points. (For per-minute p95 series, reduces to simple stddev; for cross-bucket histogram stats, uses Phase 1's pooled formula.)
- `zscore(series, window)` — `(value - rolling_mean) / rolling_stddev`.
- `ratio(seriesA, seriesB)` — pointwise `A / (A + B)` with safe divide-by-zero.

These six cover all the §1 sample wins (band overlays, anomaly detection, deploy-broke-something rate alerts, error-rate ratios).

### Architectural seat

There's already a stub at `web/app/metrics/MetricsFunction` and a parser branch (`parseMKey.isFunction`) for function-shaped keys. Extend that: a key like `rate(notifications>gcm>sent_type)` or `zscore(latency@p95, 1h)` parses to `{fn, args}` and routes through a function evaluator that:

1. Loads the underlying series via `MetricsLoader`.
2. Applies the operator.
3. Returns derived points in the same `{ts, ...}` shape, so the rest of the chart pipeline doesn't care.

The existing client-side `PointLoader.loadFunction` already has scaffolding for this (`web/client/js/models/point-loader.js:68-86`) — currently TODO.

### API surface

Function-as-key is the most consistent with existing code; no new endpoint needed. `/api/metrics/<encoded-function-key>` Just Works. If we later want a richer expression language, the function-key is a stepping stone.

### UI integration

Chart editor (post-foundation): a "+" button to add a derived series; form for picking function + parameters; the resulting `mkey` is a function-key string. Bands rendered as a fill between `rolling_mean ± N × rolling_stddev` — same primitives, different render style.

---

## Workstream A — UI / visualization (AFTER Phase 1+2, parallel)

- **±Nσ bands**, z-score overlays, derived-series in the chart editor.
- **"What changed at time T?" correlation view** — scan keys for co-movement (high `|zscore|`) around a timestamp.
- **Timeline annotations** — deploys, incidents, alert firings.
- **Dashboard modernization** — see [`DASHBOARD_MODERNIZATION.md`](./DASHBOARD_MODERNIZATION.md).

## Workstream B — Alerting (AFTER Phase 1+2, parallel)

- **Resurrect the in-zag monitor** — reuse `daemon/lib/monitor/RuleTester` + `/api/monitor` plumbing (built, tested, never the failure). Uncomment `mm.test(points)` at `daemon.js:69`. Do **NOT** use `RuleBuilder` auto-baselining — that's what killed the monitor in 2014.
- **Rule storage stays in Chef.** Chef writes a JSON rule file (e.g., `/etc/zag/rules.json`) onto each daemon — mirrors how `check_metrics_threshold` reads `metrics_rules.json` today. zag's daemon loads on start and re-reads on file change. **No new UI; no rules-as-data in zag.** Git-tracked thresholds preserved.
- **Rule format expands** beyond `{subkey: 4-tuple}` to express predicates over the Phase 2 layer: rate, z-score, ratio, **sustained-deviation gates** ("N of the last M samples violated"). The sustained-deviation gate is the explicit cure for 2014's false-positive storm.
- **Warning flow:** monitor `warn` event → `http.setWarnings()` → `/api/monitor` per daemon → `/api/warnings` aggregated in web tier → UI subscribes → matching panels pulse red. End-to-end plumbing already exists; the input is what needs reconnecting.
- **Advisory-first rollout.** Panel pulse before any paging. Once trusted, optionally emit **passive Nagios check results** from the same warnings so Nagios still owns the actual notification routing/escalation.
- **Pre-existing bug in `check_metrics_threshold` to fix on the way through.** The Nagios plugin at `chef-repo/cookbooks/nagios/files/default/nagios-plugins/check_metrics_threshold:90,98` reads `point[subkey]` per minute and then `sum(data[subkey])` across the window. For `subkey: count` this is correct (sum of per-minute counts = total events). For `subkey: p95` / `subkey: median` it's dimensionally meaningless — sum of per-minute percentiles isn't a quantity. Two rules today use this path (`riak_cluster_timeline>riak_kv_vnodeq_total` p95 and `LB_Pool>timing>auth_to_em|/2/he/send_email` median); their thresholds are tuned against the wrong-math value, so the alerts are *stable* but not measuring what the rule author thought. Honest replacements: either query LLQ directly and compute the true window p95 (Phase 1's path), or migrate those two rules to Phase 2 derived-series predicates like `{rolling_mean(latency@p95, 300000)}` evaluated at delta=1m. Not Phase 1/2 scope; flagged here so the Workstream B migration doesn't quietly preserve the bug by re-implementing the same sum.

## Workstream C — System health / ring observability (AFTER Phase 1+2, parallel)

- **`check_ring_consensus` Nagios plugin** — small custom plugin in `chef-repo/cookbooks/nagios/files/default/nagios-plugins/`, modelled on `check_metrics_threshold`. Polls `/checksum` on every zag daemon; alerts CRITICAL on unreachable members or disagreeing hashes. Sub-minute split-brain detection.
- **Member list from a Chef attribute** (consistent with the topology-from-Chef decision) — the source of truth for "who *should* be in the ring."
- **Read-only `/members` endpoints added** (alongside `/checksum`) so the check can diff live gossip membership against the static Poolee config (`hs_ring.json` etc.) — the gossip-vs-static phantom detector. Revises the earlier checksum-only / "no zag changes" assumption.
  - **Classic ring — DONE & up for review.** `Voxer/server` branch `jsheehy/ring-members` (`ring/ring.js` + `precious/basic_ring.js`), **PR [#4136](https://github.com/Voxer/server/pull/4136)** against `release`. Verified on gcp2-stage-00 across all classic ring nodes (hs1/bs1/business1/ds1/nmn1/nr1): `GET <ring-port>/members` returns the ring JSON and `md5(/members) == /checksum` exactly. Note the ring filters serve on each service's **ring port** (e.g. HS `:7172`), not its API/`listen` port.
  - **zag daemon ring — still TODO.** `daemon/lib/ring/index.js` (zag repo) / deployed as `node_modules/zag-daemon/lib/server/ring.js` has no `/members` yet, so `ms`/`mw` 404 on it by design.
- **Catches both failure modes in one check:** unreachable node (the `0049` SSH-timeout pattern) and reachable-but-disagreeing nodes (the `0064` split-brain that caused the GCM incident).
- **Follow-up (later):** per-daemon `ingest-rate` metric, emitted from each zag daemon — would have screamed instantly when `ms16` owned 6% of keyspace and ingested zero.

## Workstream D — Proactive alerting (LAST)

- Built on Phase 1+2 + Workstream B. Do not start before the rest is steady.
- **Do NOT** default to 2014's `RuleBuilder` auto-baselining — git history shows 5+ enable/disable toggles and a tuning spiral that ended in permanent shutdown.
- Approach: **seasonality-aware z-score** baselines (hour-of-week mean and stddev per metric), plus **sustained-deviation gates**.
- **Advisory-first**: anomalies surface in the panel-pulse UI only; no paging until the false-positive rate is demonstrably tolerable. The display-only path is also the safest *staging ground* for resurrecting the monitor in general.

---

## Current artifacts

- **Branch `jsheehy/zag-changes-1`** — small client-side `clampDelta` UI bugfix (`web/client/js/models/point-loader.js`). Currently uncommitted. Independent of the main work; ship whenever.
- **[`DASHBOARD_MODERNIZATION.md`](./DASHBOARD_MODERNIZATION.md)** — sibling task brief for the dashboard portion of Workstream A. A different session is handling that.
- **`Voxer/server` branches** — `jsheehy/ring-members` (the `/members` endpoints above) and `jsheehy/fix-node-idle-flag` (drops an obsolete `--nouse-idle-notification` flag that crash-loops services on modern Node / FreeBSD 14; gcp2 stage pinned to Node 8 meanwhile). Both pushed.
- **Project memory** at `/Users/john/.claude/projects/-Users-john-code-voxer-zag/memory/` — captures the broader plan, the 2014 monitor-failure finding, and collaboration notes.

---

## For the next session (Phase 1 + Phase 2)

**Start here:**

1. Read the four packages at a glance: `agent/`, `daemon/`, `backend-pg/`, `web/`. Top-level `README.md` is the overview. The data flow is agent → daemon → Postgres → web.
2. Read the broken downsampler: `web/app/metrics/downsample/histogram.js` (it's tiny — under 50 lines). Then `web/app/metrics/index.js` for how it's called.
3. Read the LLQ companion path: `daemon/lib/aggregator/metrics/llq.js`, `web/app/metrics/downsample/llquantize.js`, and where `@llq` keys get auto-created (`daemon/lib/aggregator/index.js:60`).
4. Read the existing function-shaped key seam: `web/lib/mkey.js`, the `MetricsFunction` references in `web/app/metrics/`, and `web/client/js/models/point-loader.js:68-86`. That's where Phase 2 lands.

**Phase 1 first** — it's narrower and unblocks Phase 2's `rolling_stddev` / `zscore` for histogram series. Phase 2 can begin against counter metrics in parallel if useful (counters don't have the std_dev problem).

**Two design decisions worth resolving early:**

- Schema: add `m2` alongside `std_dev`, or fully replace? Recommend keep both initially, deprecate later.
- Percentile sourcing: transparent in the loader (preferred — UI doesn't change) vs. explicit query parameter (more flexible but ripples into callers).

**Do not:**

- Touch the dormant `RuleBuilder` (`daemon/lib/monitor/rule-builder.js`). That's the 2014 failure. Workstream B uses `RuleTester` only.
- Build a rules UI. Thresholds stay in Chef per the meeting decision.
- Move work on the dashboard UI — that's `DASHBOARD_MODERNIZATION.md`, handled separately.

---

## Staging deployment & verification (gcp2-stage-00)

The box runs voxer_server (incl. the `mw`/`ms` zag services) under **Node 8**. Getting a clean install to run surfaced a few real gotchas — capture for next time:

**What went wrong (Node 8 throughout):**

- A fresh `npm install` pulls a **modern `xml-crypto`** that uses ES2020 syntax (`?.`, `??`) which Node 8 can't parse → services crash with `SyntaxError: Unexpected token .`. Fix: run `cookbooks/server/files/default/patch-xml-crypto.sh /voxer/deploy/server` after install (it rewrites the ES2020 syntax out). This is the main trap.
- Native addons (`sse4_crc32`, `bcrypt`, `heapdump`) must compile under Node 8. Run the install as **`voxer`** with `HOME=/voxer/deploy/server` (running as root mis-de-escalates child processes and hits cache-permission errors). A stale npm cache can make `npm install` skip the native build entirely — `npm cache clean --force` first, or `npm rebuild`, so they build in dependency order. (Toolchain on the box is fine: Node 8 + `python2.7` set via `npm config python`.)
- chef's `npm install` is **clone-gated** (`action :nothing`, only notified by the git clone, which has `not_if dir exists`). So updating an *existing* `/voxer/deploy/server` checkout does NOT reinstall — you must `npm install` + patch manually.
- `mw` binds the **internal IP** (`192.168.255.54:10400`, from its `listen` config), not localhost — test against the internal IP / `gcp2-stage-00-internal.voxer.com`, not `127.0.0.1`.
- **`ms`/`mw` crash-loop on a Postgres auth failure** (pre-existing, unrelated to the ring work). Uncaught exception `password authentication failed for user "postgres"` from `zag-backend-pg` kills the process → daemontools restarts → loop (saw ~50 restarts/min on the deploy restart; 77k boots across rotated logs). The metrics PG (`metrics_postgres` in `/voxer/etc/config.json` → `10.18.161.24/metrics`) is reachable, so it's an **auth/credential** problem, not network. Suspect the `tcp://` URL scheme (vs `postgres://`) causing node-postgres to fall back to the default user `postgres`. They happen to be stable now (a boot got past the PG path), but **any ms/mw restart risks re-entering the loop** until the creds/URL are fixed. Not the ring branch's fault — running commit confirmed `b0de31f58`.

**Recommendations for future installs:**

1. Commit an **`npm-shrinkwrap.json`** to voxer_server pinning Node-8-compatible versions — stops `npm install` drifting forward into ES2020 land and re-breaking on every deploy.
2. **Wire `patch-xml-crypto.sh` into the chef server recipe** (it's currently a manual-only helper nothing invokes), plus an `npm cache clean --force` (or `npm rebuild`) step — so a fresh clone produces a working tree without hand-holding.

---

## Next session (server repo)

Picking up in the voxer_server repo:

1. **`/members` endpoint** — classic ring DONE: verified on staging + PR [#4136](https://github.com/Voxer/server/pull/4136). Remaining: implement `/members` in the **zag daemon ring** (`daemon/lib/ring/index.js`), and (for the monitoring use case) the `check_ring_consensus` Nagios plugin that consumes these endpoints.
2. **Verify Phase 2 zag on staging** — exercise the derived-series function-keys (`{rate(...)}`, `{zscore(...)}`) against a real backend. Note: staging currently runs **stock `zag@0.1.1`**, not the Phase 1/2 changes (committed on `jsheehy/zag-changes-1`, green on 348 tests). To test them, link the three zag packages into voxer_server **as `voxer` under Node 8** (the `web/package.json` name is `@patrick.kokou/zag`, so the global symlink for the unscoped `zag` name has to be created manually).
