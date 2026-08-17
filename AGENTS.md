# AGENTS.md

dsh-usage-dashboard — DSH (DeepSeek Harness) usage statistics dashboard plugin.

## Project layout

- `src/core/rollup.js` — **Pure aggregation engine** (no ctx, no IO): `foldSession(events)` materializes one compact per-session rollup (sparse hourly buckets with per-model token/cost detail + message counts + durations); `foldAppend(rollup, event)` applies ONE new event incrementally (byte-identical to a full refold — bench `[3]` asserts this); `queryUsage` / `queryDetail` / `queryCalendar` answer any window/filter in memory. `priceFor` lives here; `PRICES`/`VENDORS` are imported from `./pricing.js`.
- `src/core/pricing.js` — **Generated** price + vendor table (USD × 7 → CNY ¥/M tokens) from `pricing/vibe-usage-model-pricing.csv` (203 models). Never edit by hand — change the CSV and run `npm run build`; `scripts/regenerate.cjs` regenerates both `src/core/pricing.js` and `lib/core/pricing.js`.
- `src/host.js` — Glue layer: **event-driven rollups** — init() loads each session ONCE (live sessions from the in-memory Session object, others via `persistence.readFrom`); `ctx.on('session/event')` streams every new event into the matching rollup via `foldAppend` (no disk reads while DSH runs); a 60s reconcile timer loads new sessions and drops removed ones; request-level cache (30s TTL aligned with the client poll + stale-while-revalidate, single-flight per key; cleared when the cold-start background batch finishes); pre-warm right after startup. Registers `/dash-api/usage|detail|calendar`.
- `src/client.js` — Client-half source: registers `settings.section` (id `dashboard`, order 30, label "数据看板"); plain React + DOM charts (KPIs, trend, heatmap, calendar, records, distributions).
- `lib/` — Build output (what DSH actually loads): `index.js` (host bundle), `core/rollup.js` (copied verbatim), `client.js` (UMD client bundle).
- `scripts/regenerate.cjs` — Build script: adapts `src/` into `lib/` (host body extraction, `ctx.interval` → `setInterval`, `styles.insert` → injected `<style>` tag, UMD wrapper, `host.call` → GET `/dash-api/*`).
- `scripts/bench.js` — Correctness + performance harness: synthesized sessions, field-level comparison of the v0.2 engine against a faithful v0.1 full-scan port, plus timings.

## Rules

- **Edit `src/`, never `lib/` directly.** After changing `src/`, run `npm run build` (node scripts/regenerate.cjs) to regenerate `lib/` and commit both.
- **Keep the engine pure**: aggregation logic belongs in `src/core/rollup.js`; host.js only does I/O, caching and routing.
- Run `npm run bench` after touching the engine — it must stay field-level identical to the legacy algorithm (documented exceptions: `totalMs` KPI is fixed from always-zero and uses **union semantics** — overlapping/parallel session spans are merged so the window total never exceeds the window length; activeMs inside window edge hours is exact via evts backfill, with only the rare step-crossing-`hi` case approximated; both asserted with explicit tolerances). Bench section `[0]` asserts the union rules (overlap dedupe, cross-day clipping, step/start never extending the span).
- `totalMs` per window = union of per-session `[max(first,lo), min(last,hi)]` intervals (foldSession's `first`/`last` are message events only — user/assistant/tool-call/tool-result; `step/start` is not a message and never extends the span). Trend bucket `totalMs` uses the same per-gran-key union. `scripts/debug-total.js` reads real session files for file-backed analysis (note: live sessions served by `persist.readFrom` may expose fuller in-memory logs than the compacted JSONL mirrors).
- `queryDetail` rows are grouped by **(time bucket, model, project)** — the same hour used by two models yields two rows, each showing its project name. `rollup.projectTitle` is set by the host glue at fold time.
- The client bundle runs in the browser without bundler/TSX: plain JS + `React.createElement` only.
- The host bundle is ESM (`.js` under `"type": "module"`); the build script itself is CommonJS (`.cjs`).
- Cost figures are estimates: USD price × 7 → CNY, from the generated `PRICES` table (`pricing/vibe-usage-model-pricing.csv`). New/changed prices belong in the CSV, never in code. DeepSeek V4 flash/pro 自 2026-08-17 00:00（北京时间）起按峰谷定价（rollup.js priceForAt(model, t)）：高峰 9:00-12:00、14:00-18:00（UTC+8），空闲为高峰一半（元/M tokens）；生效前及非 DeepSeek 模型按 CSV 静态价。新峰谷价改动在 rollup.js 的 DS_PEAK，勿改 CSV。
- All aggregation is local; never send session data anywhere.

## Performance architecture (v0.3)

1. **Materialized per-session rollups** — each session is folded into hourly buckets (per-model `[in,out,cache,costIn,costOut,costCache,calls,durUA]`, message counts, gap durations, active time). All queries are pure memory aggregation.
2. **Event-driven freshness** — `ctx.on('session/event')` streams every new event into the matching rollup via `foldAppend` (µs/event). No `listSnapshots` revision scans and no full-log re-parses on refresh — DSH's JSONL backend expands packed-chunk rows, so a full `readFrom` of a busy session costs seconds; the stream avoids it entirely. Cold load happens once per DSH start (live sessions read from the in-memory Session object; persisted sessions via `readFrom`), pre-warmed ~500ms after boot, reconciled every 60s.
3. **Window edge exactness** — windows rarely align with the hour (e.g. 7d starts at `now-7d`); edge buckets keep lightweight per-event detail (`evts`) and are accumulated exactly, including the cross-bucket gap bridge into the next bucket.
4. **Heatmaps are derived, not stored** — 7×24 heat arrays are up-rolled from hourly buckets per query so window filtering stays correct with zero extra storage.

## Smoke checks

- `node --check lib/client.js`, `node --check` (as .mjs) on `lib/index.js` and `lib/core/rollup.js`.
- `npm run bench` → "all checks passed ✔" (correctness + performance).
- The plugin is a **bundle**: `package.json` declares `dsh.bundle.patch: ./cordis.patch.yml` (self-insert row), so `dsh plugin --profile web add @skkjkk/dsh-usage-dashboard` installs it AND auto-appends it to the profile's `dsh.profile.bundles` (reconcilePlugins). The boot process applies each bundle's own patch — no manual cordis.yml/cordis.patch.yml editing. Verify with `scripts/verify-pack.mjs` after packing.
