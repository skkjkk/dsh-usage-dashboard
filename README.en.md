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
- **Performance** — 5-minute server cache with stale-while-revalidate

## Architecture

```
Browser (Client)                          DSH host process (Host)
┌─────────────────────┐                 ┌──────────────────────────────┐
│ Settings: dashboard │  GET /dash-api/ │  /dash-api/usage   overview   │
│  React + plain DOM  │ ───────────────► │  /dash-api/detail  records   │
│  settings.section   │    JSON bridge   │  /dash-api/calendar calendar │
└─────────────────────┘                 │  sessionQuery / workspace    │
                                        │  registry / sessionPersistence│
                                        └──────────────────────────────┘
```

- **Host half** (`lib/index.js`): registers three JSON GET routes on `webServer`, aggregating from the local session store (`sessionQuery` / `workspaceRegistry` / `sessionPersistence`), with a built-in price table and a 5-minute cache.
- **Client half** (`lib/client.js`): registers a `settings.section` (id `dashboard`, order 30, label "数据看板") rendered with plain React + DOM (no UI library).

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
- The price table lives in the `PRICES` constant of `src/host.js`; PRs adding new models are welcome.

## Development

```powershell
npm run build   # regenerate lib/ from src/ (scripts/regenerate.cjs)
```

```
dsh-usage-dashboard/
├── src/                  # source (edit here)
│   ├── host.js           #   host half: aggregation + price table + cache
│   └── client.js         #   client half: React UI + chart rendering
├── lib/                  # build output (loaded by the plugin)
│   ├── index.js          #   host half bundle
│   └── client.js         #   client half bundle (UMD)
├── scripts/
│   └── regenerate.cjs    # build script: src → lib adaptation
├── cordis.patch.yml      # DSH bundle plugin registration patch
└── package.json
```

## License

[Apache License 2.0](./LICENSE)

## Disclaimer

This project is an independently maintained open-source plugin and is not affiliated with DeepSeek. Cost estimates are for reference only.
