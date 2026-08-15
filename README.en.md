# dsh-usage-dashboard

> DSH (DeepSeek Harness) usage statistics dashboard — token / cost / duration / session aggregation with trend, heatmap and calendar views.

A plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-harness) Web GUI. It aggregates local session usage data and renders a **usage dashboard** ("数据看板") inside the settings panel: KPIs, trends, weekly heatmap, calendar and per-day records.

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

## Features

- **KPI overview** — estimated cost, total / input / output / cached tokens, active & total duration, session count, message count
- **Trend chart** — Token / cost / duration modes, stacked input / output / cache segments, toggleable legend
- **Weekly heatmap** — 7×24 hours grid for tokens / cost / duration
- **Calendar view** — daily usage per month with adaptive month labels
- **Detail records** — per-day aggregated session table (sessions, models, messages, tokens, cost) with pagination
- **Distributions** — donut charts by model and by project
- **Time ranges** — today / 24H / 7D / 30D / 90D / custom date range
- **Filters** — multi-select by model / project, one-click clear
- **Cost estimation** — built-in price table for 200+ models (RMB estimates, USD × 7); unmatched models are not billed; CNY/USD and zh/intl unit toggles
- **Performance** — materialized per-session rollups + revision-delta loading; millisecond queries (see "Performance (v0.2)")

## Architecture

```
Browser (Client)                          DSH host process (Host)
┌─────────────────────┐                 ┌──────────────────────────────┐
│ Settings: dashboard │  GET /dash-api/ │  /dash-api/usage   overview   │
│  React + plain DOM  │ ───────────────► │  /dash-api/detail  records   │
│  settings.section   │    JSON bridge   │  /dash-api/calendar calendar │
└─────────────────────┘                 │         │                    │
                                        │         ▼                    │
                                        │  src/core/rollup.js          │
                                        │  pure aggregation engine     │
                                        │  foldSession → session       │
                                        │  rollups; queryUsage/Detail/ │
                                        │  Calendar (no IO)            │
                                        │         │                    │
                                        │         ▼                    │
                                        │  getRollups() (delta load)   │
                                        │  listSnapshots() revision    │
                                        │  → re-read only changed      │
                                        └──────────────────────────────┘
```

- **Host half** (`src/host.js`): registers the three JSON GET routes; uses `persistence.listSnapshots()` (cheap stat-derived **revision per session**) to re-read and re-fold only changed/new sessions; request cache (5 min TTL + stale-while-revalidate, single-flight); pre-warm on startup.
- **Aggregation engine** (`src/core/rollup.js`): pure, testable functions. `foldSession` materializes each session into compact hourly buckets (per-model tokens/cost/duration); `queryUsage` / `queryDetail` / `queryCalendar` answer any window, granularity and filter from memory — **no disk access after the first fold**. Window edges (e.g. 7d starts at `now-7d`, off the hour) are handled exactly via per-bucket event detail.
- **Client half** (`src/client.js`): registers `settings.section` (id `dashboard`, order 30, label "数据看板") rendered with plain React + DOM.

## Performance (v0.2)

| Operation | v0.1 full scan | v0.2 materialized rollups |
|---|---|---|
| Query (7D, in-memory) | ~62 ms (full 40k+ events × 2 windows) | **~1.3 ms** (≈47× faster) |
| Disk reads | re-read all 300 session JSONLs per cache expiry | **only changed sessions** (revision diff) |
| Session change (10 sessions) | rescan everything | fold 10 changed only (~2.4 ms) |
| Cold start (one-time) | — | first full fold ~154 ms, incremental after |

`npm run bench` runs a 300-session / 41k-event synthetic benchmark with **field-level equivalence checks against the v0.1 algorithm** (two intentional deviations: the "total duration" KPI bug (always 0 in v0.1) is fixed; "active duration" inside window edge hours is a bounded approximation).

## Install

Prerequisite: a local [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-harness) with the Web GUI.

### Local source mount (recommended for development)

```powershell
# 1. Build (generates lib/)
npm run build

# 2. Junction-link into the DSH profile's node_modules
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\@skkjkk\dsh-usage-dashboard" `
  -Target "D:\path\to\dsh-usage-dashboard"

# 3. Register the plugin row in the profile's cordis.patch.yml (see cordis.patch.yml)
#    - insert:
#        - id: usage-dashboard
#          name: '@skkjkk/dsh-usage-dashboard'

# 4. Restart DSH, open Settings → 数据看板
```

> When installed through the `@linxin666/dsh-web-ui-all` aggregation package, `cordis.patch.yml` is applied automatically.

### npm package (when published)

```powershell
npm install -g @skkjkk/dsh-usage-dashboard
```

## Usage

1. Open the DSH Web GUI → Settings (top-right) → "数据看板"
2. Pick a time range (today / 24H / 7D / 30D / 90D / custom)
3. Filter by model / project; click KPI cards to toggle CNY/USD and zh/intl units
4. Hover trend bars / heatmap cells / calendar cells for details

## Data & privacy

- All aggregation happens **locally** from the DSH session store; no data is sent anywhere.
- Costs are **estimates**: built-in price table (USD × 7 → CNY) × per-session token usage. They may differ from real bills.
- The price table lives in the `PRICES` constant of `src/core/rollup.js`; PRs adding new models are welcome.

## Development

```powershell
npm run build   # regenerate lib/ from src/ (scripts/regenerate.cjs)
```

```
dsh-usage-dashboard/
├── src/                  # source (edit here)
│   ├── core/rollup.js    #   pure aggregation engine: rollups + queries (price table here)
│   ├── host.js           #   host glue: delta loading, caching, routes
│   └── client.js         #   client half: React UI + chart rendering
├── lib/                  # build output (loaded by the plugin)
│   ├── index.js          #   host half bundle
│   ├── core/rollup.js    #   engine (copied verbatim)
│   └── client.js         #   client half bundle (UMD)
├── scripts/
│   ├── regenerate.cjs    # build script: src → lib adaptation
│   └── bench.js          # correctness + performance harness (npm run bench)
├── cordis.patch.yml      # DSH bundle plugin registration patch
└── package.json
```

## License

[Apache License 2.0](./LICENSE)

## Disclaimer

This project is an independently maintained open-source plugin and is not affiliated with DeepSeek. Cost estimates are for reference only.
