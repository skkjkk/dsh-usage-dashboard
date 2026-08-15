# AGENTS.md

dsh-usage-dashboard — DSH (DeepSeek Harness) usage statistics dashboard plugin.

## Project layout

- `src/core/rollup.js` — **Pure aggregation engine** (no ctx, no IO): `foldSession(events)` materializes one compact per-session rollup (sparse hourly buckets with per-model token/cost detail + message counts + durations); `queryUsage` / `queryDetail` / `queryCalendar` answer any window/filter in memory. `PRICES` price table and `priceFor` live here.
- `src/host.js` — Glue layer: `getRollups()` lists sessions via `persistence.listSnapshots()` (cheap stat-derived **revision per session**) and re-reads + re-folds ONLY changed/new sessions (8-way concurrency, LRU cap ~500); request-level cache (5 min TTL + stale-while-revalidate, single-flight per key); pre-warm on startup. Registers `/dash-api/usage|detail|calendar`.
- `src/client.js` — Client-half source: registers `settings.section` (id `dashboard`, order 30, label "数据看板"); plain React + DOM charts (KPIs, trend, heatmap, calendar, records, distributions).
- `lib/` — Build output (what DSH actually loads): `index.js` (host bundle), `core/rollup.js` (copied verbatim), `client.js` (UMD client bundle).
- `scripts/regenerate.cjs` — Build script: adapts `src/` into `lib/` (host body extraction, `ctx.interval` → `setInterval`, `styles.insert` → injected `<style>` tag, UMD wrapper, `host.call` → GET `/dash-api/*`).
- `scripts/bench.js` — Correctness + performance harness: synthesized sessions, field-level comparison of the v0.2 engine against a faithful v0.1 full-scan port, plus timings.

## Rules

- **Edit `src/`, never `lib/` directly.** After changing `src/`, run `npm run build` (node scripts/regenerate.cjs) to regenerate `lib/` and commit both.
- **Keep the engine pure**: aggregation logic belongs in `src/core/rollup.js`; host.js only does I/O, caching and routing.
- Run `npm run bench` after touching the engine — it must stay field-level identical to the legacy algorithm (documented exceptions: `totalMs` KPI is fixed from always-zero; `activeMs` is approximate inside window edge hours; both asserted with explicit tolerances).
- The client bundle runs in the browser without bundler/TSX: plain JS + `React.createElement` only.
- The host bundle is ESM (`.js` under `"type": "module"`); the build script itself is CommonJS (`.cjs`).
- Cost figures are estimates: USD price × 7 → CNY, from the `PRICES` table. New models belong in `src/core/rollup.js`.
- All aggregation is local; never send session data anywhere.

## Performance architecture (v0.2)

1. **Materialized per-session rollups** — each session is folded exactly once per revision into hourly buckets (per-model `[in,out,cache,costIn,costOut,costCache,calls,durUA]`, message counts, gap durations, active time). All subsequent queries are pure memory aggregation.
2. **Revision-delta loading** — `listSnapshots()` returns a `dev:ino:size:mtimeNs:ctimeNs` token per session; only changed/new sessions are re-read from disk (JSONL). Queries never touch disk after the first fold.
3. **Window edge exactness** — windows rarely align with the hour (e.g. 7d starts at `now-7d`); edge buckets keep lightweight per-event detail (`evts`) and are accumulated exactly, including the cross-bucket gap bridge into the next bucket.
4. **Heatmaps are derived, not stored** — 7×24 heat arrays are up-rolled from hourly buckets per query so window filtering stays correct with zero extra storage.

## Smoke checks

- `node --check lib/client.js`, `node --check` (as .mjs) on `lib/index.js` and `lib/core/rollup.js`.
- `npm run bench` → "all checks passed ✔" (correctness + performance).
- The plugin mounts via `cordis.patch.yml` (`- insert: { id: usage-dashboard, name: '@skkjkk/dsh-usage-dashboard' }`).
