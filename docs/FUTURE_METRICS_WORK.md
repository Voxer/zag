# Future Metrics Work

## Status

- **Approved at meeting on 2026-05-18.** All workstreams greenlit.
- **Sequencing:** Phase 1 + Phase 2 (foundation) done; Workstreams A/B/C in parallel next; Workstream D (proactive alerting) **last**.
- **Thresholds stay in Chef** — git-tracked, code-reviewable. The *format* expands and *evaluation* moves into zag, but *storage* remains in Chef → JSON file → zag reads.
- **Ring/topology source of truth = Chef** (consistent with the threshold decision).
- **Phase 1 ✅ IMPLEMENTED on branch `jsheehy/zag-changes-1`.** 244 metrics assertions pass; per-minute responses byte-identical to pre-change; wider-delta histogram values now correct vs previously averaged-and-wrong.
- **Phase 2 ✅ IMPLEMENTED on branch `jsheehy/zag-changes-1`.** Server-side function-key evaluator with six operators; 348 metrics assertions pass total. Old `{js-expression}` client-side syntax dropped (verified unused).
- **Alerting is untouched.** Nagios → `/api/metrics/<rawkey>` path bypasses the function-key dispatch; in-zag monitor remains disabled. The only behavioral difference: any Nagios threshold tuned against a wrong wider-delta percentile now compares against a correct one.

## Use cases driving the work

- **(a)** Better traditional alerting; **(a-1, LAST)** proactive / anomaly alerting.
- **(b)** Faster investigation from support tickets.

---

## Phase 1 — Honest aggregation (FOUNDATION) ✅ IMPLEMENTED

> Done on `jsheehy/zag-changes-1`. Daemon emits `m2`, backend-pg schema has the
> column, web downsampler uses Chan's pooled variance, loader sources
> percentiles from the `@llq` companion at `delta > minLevel`.
> `M2 = variance × (count − 1)` (sample variance / Bessel's correction from
> the `metrics` 0.1.6 library) end-to-end.

### What's broken (pre-change)

`web/app/metrics/downsample/histogram.js:26-46` collapses per-minute histogram stats into wider deltas by **summing every field then dividing by bucket count** (except `max`, which is `Math.max`). For:

- **`count`, `max`** — correct (sum and max are valid).
- **`mean`** — biased; correct only when bucket sample counts are equal.
- **`std_dev`** — meaningless (true within-window variance needs *pooled* variance: within-bucket + between-bucket terms).
- **`median`, `p10`, `p75`, `p95`, `p99`** — meaningless (no math op recovers a true percentile from per-bucket percentiles).

So every histogram view past 1-minute delta was silently wrong for years.

### The fix — two parts

**(a) Pooled variance for `std_dev`.** Store `M2` (sum of squared deviations from the mean) per bucket alongside `std_dev`. `M2 = variance × (count − 1)` (Bessel/sample-variance convention). Combine across buckets with Chan's parallel-variance algorithm:

```
combined_count = Σ count_i
combined_mean  = Σ (count_i * mean_i) / combined_count
combined_M2    = Σ M2_i + Σ count_i * (mean_i - combined_mean)²
combined_var   = combined_M2 / (combined_count - 1)
combined_stddev = √combined_var
```

Exact and additive at any zoom.

**(b) LLQ-derived percentiles.** Drop scalar percentiles from the downsample entirely. For any delta > 1 minute, source percentiles from the **LLQ frequency tables** (already stored as the `@llq` companion of every histogram — `metrics_data_llq` table). Sum the per-minute frequency tables componentwise, walk the sorted buckets to the desired quantile. True p95 at any window.

### Files touched

- `daemon/lib/aggregator/metrics/histogram.js` — emits `M2` alongside `std_dev`.
- `backend-pg/index.js` — schema: added an `m2` column to the histogram table (idempotent ALTER). `std_dev` retained for backward compatibility.
- `web/app/metrics/downsample/histogram.js` — `combine` / `average` rewritten for pooled variance over `{count, mean, M2, max}`. Percentile fields removed.
- `web/app/metrics/index.js` — when `type === "histogram"` and `delta > minLevel`, merges LLQ-derived percentiles into the response transparently in the loader.
- `web/app/metrics/downsample/llquantize.js` — already correct (sums frequencies); reused.
- UI (no change strictly required) — `plot-type-popup/histogram.js` keeps its percentile checkboxes; the data sourcing changed underneath them.

### Migration

Existing data has `std_dev`, not `M2`. **Dual-write, read-with-fallback.** New writes populate both fields. Reads prefer `M2`; fall back to the old downsampler on rows that only have `std_dev`. No backfill needed. Optional one-shot backfill for historical rows: `M2 ≈ std_dev² × (count − 1)`.

---

## Phase 2 — Derived-series layer (FOUNDATION) ✅ IMPLEMENTED

> Done on `jsheehy/zag-changes-1`. Key design decisions:
>
> - **Server-side evaluation, not client-side.** The pre-existing
>   `MetricsFunction` stub was a `new Function`-based JS-expression evaluator
>   running in the browser — and unable to express windowed ops anyway.
>   Dropped it entirely (verified no production consumers) and built the
>   evaluator server-side at `web/app/metrics/function/`. Side benefit:
>   closes a URL → `new Function` XSS hole in the old code.
> - **Surface syntax: `{op(args)}`**, not `{js-expression}`. The `{...}`
>   wrapper is kept (it's how `isFunction` already signals function-keys, and
>   it avoids the `(` `)` ambiguity with chars allowed in storage keys).
>   Inside the braces is clean named-operator syntax.
> - **Six operators shipped:** `rate`, `delta`, `rolling_mean`,
>   `rolling_stddev`, `zscore`, `ratio`. Each takes `delta` (per-point
>   spacing, ms) as a trailing arg injected by the evaluator.
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
> **Note for Workstream B (alerting):** operator implementations are reusable
> as-is, but the **input plumbing diverges by caller** — alerts need a
> streaming in-memory buffer per rule, not the over-fetch path (over-fetching
> on every alert tick would re-read the full window every minute). Don't try
> to share the read path.

### Goal

A read-time transformation layer that operates on **series of points** — independent of how they were stored. Powers both the chart UI (overlays, bands, anomaly views) and the in-zag alert predicates (Workstream B) from the same code.

### Operator set

- `rate(series)` — pointwise `(value[i] - value[i-1]) / Δt`. For counters.
- `delta(series, windowMs)` — pointwise `value[i] - value[i - N]`.
- `rolling_mean(series, windowMs)` — pointwise mean of last N points.
- `rolling_stddev(series, windowMs)` — pointwise stddev of last N points. (For per-minute p95 series, reduces to simple stddev; for cross-bucket histogram stats, uses Phase 1's pooled formula.)
- `zscore(series, windowMs)` — `(value - rolling_mean) / rolling_stddev`.
- `ratio(seriesA, seriesB)` — pointwise `A / (A + B)` with safe divide-by-zero.

These six cover the sample wins: band overlays, anomaly detection, deploy-broke-something rate alerts, error-rate ratios.

### Architectural seat

Function-shaped keys parse to `{fn, args}` via `parseMKey.isFunction` in `web/lib/mkey.js`, then route through `web/app/metrics/function/index.js` (evaluator) → `parser.js` (AST) → `operators.js` (implementations). The evaluator:

1. Loads the underlying series via `MetricsLoader`.
2. Applies the operator.
3. Returns derived points in the `{ts, ...}` shape, so the rest of the chart pipeline doesn't care.

### API surface

`/api/metrics/<encoded-function-key>?start=&end=&delta=` — same endpoint as raw keys. Windows in function args are **numeric milliseconds** (e.g., `3600000` for 1h). Output shape: `[{ts, count}]` with type `counter`; window-not-filled points come back `{ts, empty:true}`.

### UI integration (Workstream A)

Chart editor: a "+" button to add a derived series; form for picking function + parameters; the resulting `mkey` is a function-key string. Bands rendered as a fill between `rolling_mean ± N × rolling_stddev` — same primitives, different render style.

---

## Workstream A — UI / visualization (parallel with B/C)

- **±Nσ bands**, z-score overlays, derived-series in the chart editor.
- **"What changed at time T?" correlation view** — scan keys for co-movement (high `|zscore|`) around a timestamp.
- **Timeline annotations** — deploys, incidents, alert firings.
- **Dashboard modernization** — see [`DASHBOARD_MODERNIZATION.md`](./DASHBOARD_MODERNIZATION.md).

## Workstream B — Alerting (parallel with A/C)

- **Resurrect the in-zag monitor** — reuse `daemon/lib/monitor/RuleTester` + `/api/monitor` plumbing (built, tested, never the failure). Uncomment `mm.test(points)` at `daemon.js:69`. Do **NOT** use `RuleBuilder` auto-baselining — that's what killed the monitor in 2014.
- **Rule storage stays in Chef.** Chef writes a JSON rule file (e.g., `/etc/zag/rules.json`) onto each daemon — mirrors how `check_metrics_threshold` reads `metrics_rules.json` today. zag's daemon loads on start and re-reads on file change. **No new UI; no rules-as-data in zag.** Git-tracked thresholds preserved.
- **Rule format expands** beyond `{subkey: 4-tuple}` to express predicates over the Phase 2 layer: rate, z-score, ratio, **sustained-deviation gates** ("N of the last M samples violated"). The sustained-deviation gate is the explicit cure for 2014's false-positive storm.
- **Warning flow:** monitor `warn` event → `http.setWarnings()` → `/api/monitor` per daemon → `/api/warnings` aggregated in web tier → UI subscribes → matching panels pulse red. End-to-end plumbing already exists; the input is what needs reconnecting.
- **Advisory-first rollout.** Panel pulse before any paging. Once trusted, optionally emit **passive Nagios check results** from the same warnings so Nagios still owns the actual notification routing/escalation.
- **Pre-existing bug in `check_metrics_threshold` to fix on the way through.** The Nagios plugin at `chef-repo/cookbooks/nagios/files/default/nagios-plugins/check_metrics_threshold:90,98` reads `point[subkey]` per minute and then `sum(data[subkey])` across the window. For `subkey: count` this is correct (sum of per-minute counts = total events). For `subkey: p95` / `subkey: median` it's dimensionally meaningless — sum of per-minute percentiles isn't a quantity. Two rules today use this path (`riak_cluster_timeline>riak_kv_vnodeq_total` p95 and `LB_Pool>timing>auth_to_em|/2/he/send_email` median); their thresholds are tuned against the wrong-math value, so the alerts are *stable* but not measuring what the rule author thought. Honest replacements: either query LLQ directly and compute the true window p95 (Phase 1's path), or migrate those two rules to Phase 2 derived-series predicates like `{rolling_mean(latency@p95, 300000)}` evaluated at delta=1m. Flagged so the Workstream B migration doesn't quietly preserve the bug by re-implementing the same sum.

## Workstream C — System health / ring observability (parallel with A/B)

- **`check_ring_consensus` Nagios plugin** — small custom plugin in `chef-repo/cookbooks/nagios/files/default/nagios-plugins/`, modelled on `check_metrics_threshold`. Polls `/checksum` on every zag daemon; alerts CRITICAL on unreachable members or disagreeing hashes. Sub-minute split-brain detection.
- **Member list from a Chef attribute** (consistent with the topology-from-Chef decision) — the source of truth for "who *should* be in the ring."
- **Read-only `/members` endpoints added** (alongside `/checksum`) so the check can diff live gossip membership against the static Poolee config (`hs_ring.json` etc.) — the gossip-vs-static phantom detector.
  - **Classic ring — DONE & MERGED.** `Voxer/server` branch `jsheehy/ring-members` (`ring/ring.js` + `precious/basic_ring.js`), **PR [#4136](https://github.com/Voxer/server/pull/4136)** merged to `release`. Verified on gcp2-stage across all classic ring nodes (hs1/bs1/business1/ds1/nmn1/nr1): `GET <ring-port>/members` returns the ring JSON and `md5(/members) == /checksum` exactly. Note the ring filters serve on each service's **ring port** (e.g. HS `:7172`), not its API/`listen` port.
  - **zag daemon ring — TODO.** `daemon/lib/ring/index.js` (zag repo) / deployed as `node_modules/zag-daemon/lib/server/ring.js` has no `/members` yet, so `ms`/`mw` 404 on it by design. Note different style — zag uses a route-map (`"GET /checksum": fn`), not a filters array; add a `"GET /members"` entry returning `ring_json`.
- **Catches both failure modes in one check:** unreachable node and reachable-but-disagreeing nodes (the split-brain that caused the GCM incident).
- **Follow-up (later):** per-daemon `ingest-rate` metric, emitted from each zag daemon — would surface a keyspace-owner ingesting zero.

## Workstream D — Proactive alerting (LAST)

- Built on Phase 1+2 + Workstream B. Do not start before the rest is steady.
- **Do NOT** default to 2014's `RuleBuilder` auto-baselining — git history shows 5+ enable/disable toggles and a tuning spiral that ended in permanent shutdown.
- Approach: **seasonality-aware z-score** baselines (hour-of-week mean and stddev per metric), plus **sustained-deviation gates**.
- **Advisory-first**: anomalies surface in the panel-pulse UI only; no paging until the false-positive rate is demonstrably tolerable. The display-only path is also the safest *staging ground* for resurrecting the monitor in general.

---

## Current artifacts

- **Branch `jsheehy/zag-changes-1`** (zag repo) — Phase 1 + Phase 2 + `clampDelta` UI bugfix committed. Awaiting rebase onto `origin/master`, then merge. Conflict scope: `backend-pg/index.js` only (master brought `backend-pg` to **v2.0.2** / **pg@8** / **Node ≥18** via PR #22; Phase 1's `m2` column addition rebases cleanly on top).
- **`Voxer/server` PR #4136** — classic ring `/members` merged to `release`.
- **[`DASHBOARD_MODERNIZATION.md`](./DASHBOARD_MODERNIZATION.md)** — sibling task brief for the dashboard portion of Workstream A.
- **Project memory** at `/Users/john/.claude/projects/-Users-john-code-voxer-zag/memory/`.

---

## Next steps

1. **Rebase & merge Phase 1/2** — `jsheehy/zag-changes-1` onto `origin/master`, resolve the `backend-pg/index.js` conflict (m2 additions on top of master's v2.0.2 rewrite), merge.
2. **Verify Phase 1/2 on staging** (gcp2-stage-00, Node 24 / FreeBSD 14) — deploy the merged zag packages into `/voxer/deploy/server/node_modules` (symlink `zag`, `zag-daemon`, `zag-backend-pg` from the checkout). Exercise the derived-series function-keys (`{rate(...)}`, `{zscore(...)}`) against real data and confirm `m2` populates on new histogram rows.
3. **Workstream C completion** — implement `/members` in the zag daemon ring (`daemon/lib/ring/index.js`), then build the `check_ring_consensus` Nagios plugin in `chef-repo/cookbooks/nagios/files/default/nagios-plugins/`.
4. **Workstreams A and B** — start in parallel once the foundation is deployed.
5. **Workstream D** — last, on top of B.
