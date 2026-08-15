# AGENTS.md

dsh-usage-dashboard — DSH (DeepSeek Harness) usage statistics dashboard plugin.

## Project layout

- `src/host.js` — Host-half source: aggregation logic (`/dash-api/usage|detail|calendar`), model price table (`PRICES`), 5-minute cache with stale-while-revalidate. Depends on `webServer`, `sessionQuery`, `sessionPersistence`, `workspaceRegistry`, `timer`.
- `src/client.js` — Client-half source: registers `settings.section` (id `dashboard`, order 30, label "数据看板"); plain React + DOM charts (KPIs, trend, heatmap, calendar, records, distributions).
- `lib/` — Build output (what DSH actually loads): `index.js` (host bundle) + `client.js` (UMD client bundle).
- `scripts/regenerate.cjs` — Build script: adapts `src/` into `lib/` (replaces `ctx.interval` → `setInterval`, `styles.insert` → injected `<style>` tag, wraps client in `window.__ModuleLoader__.load` UMD factory, bridges `host.call` → GET `/dash-api/*`).

## Rules

- **Edit `src/`, never `lib/` directly.** After changing `src/`, run `npm run build` (node scripts/regenerate.cjs) to regenerate `lib/` and commit both.
- The client bundle runs in the browser without bundler/TSX: plain JS + `React.createElement` only.
- The host bundle is ESM (`.js` under `"type": "module"`); the build script itself is CommonJS (`.cjs`).
- Cost figures are estimates: USD price × 7 → CNY, from the `PRICES` table. New models belong in `src/host.js`.
- All aggregation is local; never send session data anywhere.

## Smoke checks

- `node --check lib/client.js` and `node --check` (as .mjs) on `lib/index.js`.
- The plugin mounts via `cordis.patch.yml` (`- insert: { id: usage-dashboard, name: '@skkjkk/dsh-usage-dashboard' }`).
