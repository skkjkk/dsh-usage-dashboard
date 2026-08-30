# dsh-usage-dashboard

> A local usage dashboard for the DSH (DeepSeek Harness) Web GUI — Token, cost, duration and session details, all aggregated on your machine. No session content is ever uploaded.

🌐 Language: **[中文](README.md)** · English

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE) · [Changelog](CHANGELOG.md)

`dsh-usage-dashboard` is a DSH **bundle plugin**. It reads local DSH session data and adds a **Settings → 数据看板** view for usage statistics. All aggregation stays on the local machine; **session content is never sent to any external service**.

The interaction model is inspired by VibeCafe.ai's Vibe Usage: this is a local DSH usage dashboard with a similar metric-toggle, distribution-hover and detail-browsing flow. All rollups and aggregation are completed locally; no session content or derived usage data is uploaded.

## Features

### Filters and time range

A filter bar sits at the top: the time range switches among `today / 24H / 7D / 30D / 90D / custom` (custom opens from/to date pickers); **model filtering is multi-select grouped by vendor** (expand a vendor to pick specific models; once selected, the button shows "模型 N 项" / "N models" without listing names); a project dropdown selects a single project; active filters can be cleared in one click. The chosen range, filters and display preferences are **cached locally** (localStorage) and restored after reopening settings or reloading the plugin. A "统计中" / "loading" indicator shows while data refreshes.

### KPI overview

A row of metric cards covering: estimated cost, total / input / output / cached Tokens, active duration, total duration, session count, total message count and user message count. Each card shows a **percentage change versus the previous period** (a zero baseline is hidden rather than showing a fabricated `+100%`), with a smooth tween animation on value changes. Clicking the **cost card** toggles ¥ / $; clicking a **Token card** toggles international units (K/M/B) and Chinese units (万 / 亿). **When a model filter is active, the duration and session cards collapse, leaving only the cost and Token cards** for a more focused comparison.

![KPI overview and hourly trend](picture/Snipaste_2026-08-19_21-28-02.png)

### Trend chart

Granularity adapts to the selected range — **hourly / daily / weekly** (today and 24H use hourly, 7D/30D/90D use daily, longer ranges use weekly). It switches among **Token / cost / duration** modes; in Token mode output / input / cache stack as segments with independently toggleable legend items; in duration mode it separates active from total duration. Click any bar to highlight it (others dim); hover for details.

![Daily trend and hourly activity heatmap](picture/Snipaste_2026-08-19_21-28-49.png)

### Hourly activity heatmap

A `7 rows (weekday) × 24 columns (hour)` grid where color intensity encodes magnitude, switchable among **Token / cost / active duration** metrics; hovering any cell shows the exact value, with a `少 → 多` (low → high) legend. (The right side of the screenshot above is this chart.)

### Model and project distributions

Two **donut charts** break usage down by Token (or cost) share: **model distribution** by model, **project distribution** by project (using the canonical `cwd` with DSH workspace membership as fallback). Toggle Token / cost; the top 6 slices each get a fixed color and the rest aggregate into "其他" / "Other" (names hidden), with totals conserved. Hovering a model / project, including the aggregated Other item, or its matching slice dims the rest and switches the donut center to that item's Token and cost summary: Token mode shows only the hovered item’s Token value in K/M/B form, while cost mode shows only the hovered item’s CNY cost; the legend still shows exact Token / cost values and share.

![Model and project distributions](picture/Snipaste_2026-08-19_21-29-29.png)

### Activity heatmap (calendar)

The latest **40 weeks** in a `7 rows × 40 columns` calendar grid, with fixed square rounded cells; colored by daily Token bands (`0 / ≥1M / ≥10M / ≥30M / ≥60M / ≥100M / ≥200M / ≥250M`), and edge-date floating tooltips clamped to the viewport.

![Activity heatmap and detailed records](picture/Snipaste_2026-08-19_21-29-53.png)

### Detailed records

A table grouped by `time bucket × model × project`, with columns `time / project / model / tool / input / output / cache / cost` (tool is fixed to `dsh`); when one hour uses multiple models, each appears as a separate row. Paginated at **20 rows per page**, showing "显示 x–y 条，共 z 条" / "showing x–y of z", with prev/next paging. (The table below the screenshot above is this view.)

## Data semantics

- **Tokens** = input + output + cache Tokens.
- **Active duration** counts only actual AI generation time, from the first `assistant/chunk` event until the turn completes. Queueing, TTFT, idle thinking gaps and tool waits are excluded. Parallel sessions are summed independently, so active duration can exceed 24 hours.
- **Total duration** is the span from the first message to the last message per session. Overlapping session spans are merged before summing and clipped to the selected window, so parallel work is not double-counted.
- **Cost** is an estimate from this repo's pricing table `pricing/vibe-usage-model-pricing.csv` (204 models; built into `lib/core/pricing.js` by the build script), using USD × 7 for CNY. Unmatched models are not billed. DeepSeek V4 uses Beijing-time peak / off-peak pricing from 2026-08-17 (peak 9:00–12:00, 14:00–18:00; off-peak is half of peak).
- **Projects** use the canonical `cwd` from the session header when available, with DSH workspace membership as a fallback. Separators, case and trailing slashes are normalized before grouping.
- A zero comparison baseline has no finite percentage; the UI hides that percentage instead of showing a fabricated `+100%`.

## Install

Use the DSH CLI (recommended). It installs the package and automatically registers the plugin in the profile bundle list from the package's `dsh.bundle.patch` declaration:

```bash
dsh plugin --profile web add @skkjkk/dsh-usage-dashboard
```

Restart DSH and open **Settings → 数据看板**.

Without the `dsh` CLI:

```bash
pnpm --dir ~/.dsh/profiles/web add @skkjkk/dsh-usage-dashboard
```

Then make sure the package appears in `dsh.profile.bundles` in the profile `package.json`:

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@skkjkk/dsh-usage-dashboard"]
    }
  }
}
```

Uninstall:

```bash
dsh plugin --profile web remove @skkjkk/dsh-usage-dashboard
```

## Development and verification

Sources live in `src/`; `lib/` contains the artifacts loaded by DSH. Edit `src/` and regenerate `lib/` with:

```bash
npm install
npm run build      # node scripts/regenerate.cjs: adapts src/ into lib/
npm run bench      # engine correctness + performance benchmarks
node scripts/smoke-host.mjs
npm test           # runs build + bench + host smoke test in sequence
```

`npm test` covers: Token / cost / message / calendar aggregation consistency, `foldAppend` vs full `foldSession` incremental equivalence, active and total duration union / window boundaries, model / project conservation, and the `/dash-api/usage`, `/dash-api/detail` and `/dash-api/calendar` host routes. Targeted regressions also cover edge buckets, message-only events, cache races, lagging session lists, UTC+8 boundaries, prototype keys and long trend ranges.

Before publishing, inspect the packed artifact:

```bash
npm pack
# Extract the tgz to <package-dir>, then run:
node scripts/verify-pack.mjs <package-dir>
```

The verifier checks that host / core / client bundles load, the bundle patch and `package.files` are complete, and no personal data is included in the package.

## Freshness and performance

- **Pure aggregation engine** `src/core/rollup.js`: `foldSession` folds a session into a compact per-hour rollup, `foldAppend` updates it incrementally per event (byte-identical to a full refold), and `queryUsage / queryDetail / queryCalendar` answer any window / filter in memory.
- **Event-driven refresh**: each session materializes one in-memory rollup at startup (live sessions read from the in-memory Session object, persisted sessions via `persistence.readFrom` once); thereafter `session/event` events are folded in via `foldAppend`, so a refresh never re-parses full logs. A 60-second reconcile discovers new or removed sessions.
- **Request cache**: 30s TTL with stale-while-revalidate and single-flight; invalidated as soon as new events arrive. Pre-warmed ~500ms after boot, so every view returns in milliseconds thereafter.

## Privacy

- All aggregation is local; no session data is sent to external services.
- The npm package contains only `lib/` and the bundle patch; pricing is built into `lib/core/pricing.js`, and the source `pricing/` directory is not shipped. No local logs or session files are included.
- Cost values are estimates, not billing statements.

## Version

Current release: `0.3.9`

## License

Apache-2.0
