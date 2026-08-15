# dsh-usage-dashboard

> DSH (DeepSeek Harness) usage statistics dashboard — token / cost / duration / session aggregation with trend, heatmap and calendar views.

A plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-harness) Web GUI. It aggregates local session usage data and renders a **usage dashboard** ("数据看板") inside the settings panel: KPIs, trends, heatmaps, calendar and per-day records.

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

## Features

- **KPI overview** — estimated cost, total / input / output / cached tokens, active & total duration, session & message counts; each with a period-over-period percentage for every time range (today / 24H / 7D / 30D / 90D / custom)
- **Trend chart** — Token / cost / duration modes, stacked input / output / cache segments, toggleable legend, click-to-highlight columns
- **Weekly heatmap** — 7×24 hours grid for tokens / cost / duration with hover tooltips
- **Activity heatmap** — 53-week × 7-day GitHub-style grid, 8-level color scale, hover shows "x年x月x日：xxx tokens"
- **Distributions** — model / project donut charts with hover-linked highlighting (hovered segment stays bright, others dim)
- **Detail records** — rows grouped by (time bucket × model × project), 20 rows per page with pagination
- **Time ranges** — today / 24H / 7D / 30D / 90D / custom date range
- **Filters** — filter by model / project, one-click clear
- **Cost estimation** — priced from `pricing/vibe-usage-model-pricing.csv` (203 mainstream models, USD × 7 → CNY); unmatched models are not billed; CNY/USD and zh/intl unit toggles
- **Total-duration semantics** — union of per-session "first message → last message" spans; overlapping (parallel) sessions count once, so today / 24H never exceed 24 hours
- **Performance** — materialized per-session rollups + revision-delta loading; millisecond queries, no disk access after the first fold

## Install

```bash
npm install @skkjkk/dsh-usage-dashboard
```

Register the plugin row in your DSH profile's `cordis.yml` (or `cordis.patch.yml`):

```yaml
- insert:
    - id: usage-dashboard
      name: '@skkjkk/dsh-usage-dashboard'
```

Restart DSH and open **Settings → 数据看板**.

## Privacy

All aggregation runs locally — no session data ever leaves your machine. Costs are estimates from the bundled pricing CSV. Total duration depends on DSH's session logs: live sessions expose fuller in-memory logs than the compacted JSONL mirrors, so values may differ across restarts — that is DSH's own data model.

## License

Apache-2.0
