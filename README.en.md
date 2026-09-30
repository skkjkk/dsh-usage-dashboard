# dsh-usage-dashboard

> A local usage dashboard for the DSH (DeepSeek Harness) Web GUI — Token, cost, duration and session details, all aggregated on your machine. No session content is ever uploaded.

🌐 Language: **[中文](README.md)** · English

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE) [![Changelog](https://img.shields.io/badge/changelog-CHANGELOG.md-blue.svg)](CHANGELOG.md)

`dsh-usage-dashboard` is a DSH **bundle plugin**. It reads local DSH session data and adds a **Settings → 数据看板** view for usage statistics. All aggregation stays on the local machine; **session content is never sent to any external service**.

The interaction model is inspired by VibeCafe.ai's Vibe Usage, offering metric toggles, distribution hover and detail browsing. All rollups and aggregation happen locally.

![Filter bar and KPI overview](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/dashboard-overview.png)

## Features

### Filters and time range

The top filter bar switches the time range among `today / 24H / 7D / 30D / 90D / custom` (custom opens from/to date pickers). **Model filtering is multi-select grouped by vendor** — expand a vendor to pick specific models; once selected, the button shows "N项". A project dropdown selects a single project, and active filters can be cleared in one click. The chosen range, filters and display preferences are stored locally (`localStorage`) and restored after reopening settings or reloading the plugin. A "统计中" indicator shows while data refreshes.

### KPI overview

**9** metric cards: estimated cost, total / input / output / cached Tokens, active duration, total duration, session count, total message count and user message count. Each card shows a **percentage change versus the previous period** (hidden when the baseline is zero).

- Clicking the **cost card** toggles ¥ / $; clicking the **total Token or cached Token card** toggles international units (K/M/B) and Chinese units (万 / 亿). All four Token cards share one unit.
- **When a model filter is active, the duration and session cards collapse, leaving only the cost and Token cards.**
- The ⓘ icon next to the **estimated cost**, **active duration** and **total duration** titles opens an explanatory popup (pricing coverage and peak/off-peak rules; the two duration definitions).

### Trend chart

Granularity adapts to the selected range: **hourly for today / 24H, daily for 7D / 30D, weekly for 90D** (a custom range picks hourly at ≤48h, daily at ≤62d, weekly beyond that). It switches among three modes:

- **Token** — output / input / cache stack as segments with independently toggleable legend items;
- **Cost** — estimated cost aggregated per bucket;
- **Duration** — separates active from total duration, also independently toggleable.

Click any bar to highlight it (others dim); click empty space to clear. Hover shows details. X-axis labels use a fixed step (every 3 hours for today, every 4–5 days for 30D, every 2 weeks for 90D).

![Daily trend and hourly activity heatmap](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/trend-heatmap.png)

### Hourly activity heatmap

A `7 rows (weekday) × 24 columns (hour)` grid switchable among **Token / cost / duration**; hovering any cell shows the exact value and time, with a `少 → 多` (low → high) legend. (This is the lower half of the screenshot above.)

### Model and project distributions

Two **donut charts** break usage down by Token (or cost) share: **model distribution** by model, **project distribution** by project (canonical `cwd`, with DSH workspace membership as fallback). Toggle Token / cost; the top **6** slices each get a fixed color and the rest aggregate into "其他" / Other, with totals conserved. Hovering a legend item or slice dims the rest and switches the donut center to that item's Token and cost summary.

![Model and project distributions](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/distributions.png)

### Activity heatmap (calendar)

The latest **40 weeks** in a `7 rows × 40 columns` calendar grid with fixed square rounded cells, colored by **8** daily Token bands (`none / ≥1M / ≥10M / ≥30M / ≥60M / ≥100M / ≥200M / ≥250M`). Edge-date floating tooltips are clamped to the viewport.

### Detailed records

A table grouped by `time bucket × model × project` with columns `time / project / model / tool / input / output / cache / cost` (tool is fixed to `dsh`); when one hour uses multiple models, each appears as a separate row. Paginated at **20 rows per page**, showing "showing x–y of z" with prev/next paging.

![Activity heatmap and detailed records](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/calendar-records.png)

### Model performance radar

A **six-axis radar** comparing the top **4** models by call volume in the selected window. Each axis is normalized to 0–1 against a fixed outer-ring reference, so different time windows are directly comparable. Direction is consistent: **further out is better**.

| Axis | Meaning | Outer ring | Center |
| --- | --- | --- | --- |
| Response speed | How long a request typically takes (P50) | 1 s | 120 s |
| Output speed | Tokens emitted per second | 166 t/s | 1 t/s |
| Avg output | Tokens written per reply | 1,645 tok | 50 tok |
| Avg input | Billed input tokens read per call | 294k tok | 5,000 tok |
| Stability | How much slower the slowest 5% are (P95/P50) | ≤8.3× slower | 125× slower |
| Effective price | Actual cost per million tokens (inverted) | ¥0.10/M | ¥2/M |

All axes use a **two-sided logarithmic band** `log(v / floor) / log(ceil / floor)`. Vertices are labelled with **measured values** (e.g. `8.0s`, `¥0.09/M`); the right column holds the legend (with call counts) and **ruler rows** — one thin track per axis with all four models' scores plotted as dots, the focused model enlarged and highlighted. When a model has no price row, the "effective price" axis is left blank and annotated.

Clicking a vertex or legend item highlights that model (others dim): legend hover keeps the highlight, clicking locks and clicking again releases. The ⓘ popup explains each axis and its outer-ring reference.

### Cache insight

A time series plus a ranking table for cache efficiency across every time bucket in the window.

- **KPI strip**: window hit rate (with ▲/▼ pp delta), telemetry coverage, and **estimated savings** (= cache-read tokens × (input price − cache price), following the ¥/$ toggle).
- **Two views**: **hit rate** (monotone-cubic smoothed curve, Y axis auto-zoomed to the data band, amber dashed coverage line, mean reference line, end-value capsule, pale bands for no-telemetry spans) and **volume** (cache reads vs. missed billed input, stacked bars).
- **Model cache ranking**: sorted by read volume — bar length = reads, amber tick = coverage, with hit rate and per-model savings on the right (unmatched models show "—", free models show ¥0). **Clicking a row filters the whole dashboard by that model**; click again to release. Expandable with internal scrolling.
- The ⓘ popup explains hit rate / coverage / savings / ranking bar.

View switches are animated (line draws in, bars rise from the baseline in a staggered sweep, KPIs and legend fade in).

![Model performance radar and cache insight](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/radar-cache.png)

### Dark mode

The dashboard follows the DSH light/dark theme: colors are driven by a CSS variable table (scoped to `body[data-ds-dark-theme]`), and chart elements use dedicated graphic color variables so they keep sufficient contrast in both themes.

![Full dashboard in dark mode](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/dashboard-dark.png)

## Data semantics

- **Tokens** = input + output + cache Tokens.
- **Active duration** counts only actual AI generation time, from request dispatch until that step's reply completes. Queueing, TTFT, idle thinking gaps and tool waits are excluded; for older logs with output chunks it starts at the first chunk. Parallel sessions are summed independently, so active duration can exceed 24 hours.
- **Total duration** is the span from the first to the last message per session. Overlapping session spans are merged (counted once) and clipped to the selected window before summing.
- **Cost** is an estimate from this repo's pricing table `pricing/vibe-usage-model-pricing-extended.csv` (**277** models; built into `lib/core/pricing.js` by the build script). Unit prices are already in CNY per million tokens, so no currency conversion is applied. **Unmatched models are not billed** (they show ¥0 in the table; see the ⓘ popup for coverage). Model id matching is **case-insensitive**, so provider-catalog spellings such as `Qwen3.8-Flash` are billed at the canonical rate.
- **DeepSeek peak/off-peak billing**: the two current models (`deepseek-flash`, `deepseek-v4-pro`) are billed in Beijing time — weekday peak 9:00–12:00 and 14:00–18:00; weekends and all other hours are off-peak at half price. The V4.1 Flash price took effect at 2026-09-10 12:00, and V4 Pro routes to Flash pricing from 2026-09-14 12:00; retired names and third-party reseller variants are billed as Flash, while historical events before the peak/off-peak regime keep their original static price.
- **Projects** use the canonical `cwd` from the session header when available, with DSH workspace membership as a fallback. Separators, case and trailing slashes are normalized before grouping.
- **Scope**: normal sessions only. Subagent sessions (header `delegationDepth > 0` or a `parentSession`) and legacy bare-`<uuid>` directories are not counted, so the session count is lower than the number of directories under `~/.dsh/sessions`. Logs that cannot be read (failed format migration, corruption) are skipped.
- **Cache hit rate** = `cacheRead / cacheObserved × 100%`:
  - **`cacheRead`** = sum of provider-reported `usage.cacheReadTokens`.
  - **`cacheObserved`** = sum of `inputTokens + cacheRead + cacheWrite` over rows that reported `cacheReadTokens` or `cacheWriteTokens` (the telemetry-visible billed input). Rows without telemetry are excluded from this denominator.
  - **`billedInput`** = `inputTokens + cacheTokens` summed across **all** rows, including those without cache telemetry.
  - **Cache-data coverage** = `cacheObserved / billedInput × 100%`; with no telemetry, coverage is 0% and the rate displays "—".
- When the comparison baseline is zero, the UI hides that percentage.

## Requirements

| Item | Requirement |
| --- | --- |
| DSH | `0.1.3-alpha.2` or newer (verified up to `0.1.7-rc.2`) |
| Node.js | `>=18` (declared in `package.json` `engines`) |
| Runtime | DSH Web / Desktop GUI (the client half registers a `settings.section`) |

The plugin adapts across DSH versions through capability probing: when `sessionPersistence` is available it reads individual session logs directly (fast path), otherwise it falls back to `sessionQuery.listSessions`; when the `timer` service is missing only periodic reconcile and pre-warm degrade, and the HTTP routes are unaffected. See [COMPAT.md](COMPAT.md) for the full capability matrix, rc.1 → rc.2 differences and the upgrade checklist.

## Install

### Option 1: DSH Settings UI (Recommended)

Open DSH Settings, find the plugin management entry, click **Add Plugin**, and enter one of the following in the input box:

| Source | Enter | Example |
| --- | --- | --- |
| Package name | npm package name | `@skkjkk/dsh-usage-dashboard` |
| GitHub repository | Repository URL | `https://github.com/skkjkk/dsh-usage-dashboard` |
| Local directory | Absolute path | `D:\path\to\dsh-usage-dashboard` |

The **Install Source** dropdown (top-right) lets you choose the npm registry (default / China mirror). After installation, restart DSH and open **Settings → 数据看板**.

### Option 2: DSH CLI

```bash
# From npm
dsh plugin --profile web add @skkjkk/dsh-usage-dashboard

# From GitHub (dev version)
dsh plugin --profile web add "github:skkjkk/dsh-usage-dashboard#main"

# From local directory (development)
dsh plugin --profile web add link:/path/to/dsh-usage-dashboard
```

### Option 3: Manual install

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

### Uninstall

```bash
dsh plugin --profile web remove @skkjkk/dsh-usage-dashboard
```

### Inspect plugin

```bash
# Show dependency tree
dsh plugin --profile web why @skkjkk/dsh-usage-dashboard
```

## HTTP API

The host half registers three read-only JSON GET routes on DSH's web server (returning local aggregation results, never raw session content):

| Route | Returns | Main params |
| --- | --- | --- |
| `GET /dash-api/usage` | KPI totals + trend buckets + heatmap + model/project distributions + pricing coverage | `range`, `from`, `to`, `models`, `projects` |
| `GET /dash-api/detail` | Detail rows (grouped by time bucket × model × project) | same as above + `offset`, `limit` (max **200**, default 100) |
| `GET /dash-api/calendar` | Per-day Token for the calendar heatmap | `models`, `projects`, `now` |

`range` accepts `today / 24h / 7d / 30d / 90d / custom` (default `today`); `custom` needs `from` / `to` in epoch milliseconds. `models` / `projects` are comma-separated multi-value params. Response shape:

```jsonc
// /dash-api/usage
{ "totals": { "cost": 0, "totalTokens": 0, "sessions": 0, "cacheHitRate": null, ... },
  "buckets": [{ "label": "9/26", "input": 0, "output": 0, "cache": 0, "costIn": 0, ... }],
  "granularity": "day",
  "heat": { "token": [], "cost": [], "dur": [], "active": [] },
  "meta": { "models": [], "projects": [], "vendors": {}, "pricing": {}, "dist": {} } }
```

Requests are cached for 30s with stale-while-revalidate and single-flight, so repeated calls return in milliseconds. These routes are not behind the DSH GUI session auth and can be accessed directly (use the port your DSH instance listens on):

```bash
curl -s "http://127.0.0.1:<port>/dash-api/usage?range=7d" | head -c 200
```

## Configuration

The optional `debugCache` switch diagnoses the disk rollup cache, printing `[dash-cache]` / `[dash-pending]` / `[dash-load]` / `[dash-event]` diagnostic lines to stderr. Add `config` in the profile's `cordis.patch.yml` using the **id-targeted override** form (it overrides an existing row and needs no `insert:` wrapper):

```yaml
- id: usage-dashboard
  name: "@skkjkk/dsh-usage-dashboard"
  config:
    debugCache: true
```

> A duplicate `id` in the same file makes DSH fail to start (`duplicate loader entry id`).

Off by default.

## Development and verification

Sources live in `src/`; the artifacts loaded by DSH live in `lib/`. After editing `src/`, rebuild — do not edit `lib/` directly:

```bash
npm install
npm run build      # node scripts/regenerate.cjs: adapts src/ into lib/
npm run bench      # engine correctness + performance benchmarks
npm run smoke      # build + host smoke test
npm test           # build + bench + host smoke
```

`npm test` covers:

- Token / cost / message / calendar aggregation consistency, and `foldAppend` vs. full `foldSession` **incremental equivalence** (byte-identical);
- active/total duration union and window-boundary semantics, plus `totalMs` overlap deduplication for parallel sessions;
- model / project conservation and conservation of the cache-hit-ratio fields (`cacheRead` / `cacheObserved` / `billedInput`);
- pricing lookups: DeepSeek peak/off-peak boundaries and effective dates, variant-name resolution, case-insensitive model ids, prototype-key handling;
- the `/dash-api/usage`, `/dash-api/detail` and `/dash-api/calendar` host routes, plus the client bundle's **slot registration contract**.

Before publishing, inspect the packed artifact:

```bash
npm pack
# Extract the tgz to <package-dir>, then run:
node scripts/verify-pack.mjs <package-dir>
```

The verifier checks that host / core / client bundles load, the bundle patch and `package.files` are complete, and no personal data is included in the package.

`scripts/capture-screenshots.mjs` generates the README screenshots: it renders the real `lib/client.js` with `/dash-api/*` data in headless Chromium and crops per card.

## Freshness and performance

- **Pure aggregation engine** `src/core/rollup.js`: `foldSession` folds a session into a compact per-hour rollup, `foldAppend` updates it incrementally per event (byte-identical to a full refold), and `queryUsage / queryDetail / queryCalendar` answer any window / filter in memory.
- **Event-driven refresh**: each session materializes one in-memory rollup at startup (live sessions read from the in-memory Session object, persisted sessions via `persistence.readFrom` once); thereafter `session/event` events are folded in via `foldAppend`, so a refresh never re-parses full logs. A 60-second reconcile discovers new or removed sessions.
- **Disk rollup cache** (`~/.dsh/usage-dashboard-cache/<sessionId>.json`, invalidated by log file `mtime + size`): after a DSH restart, unchanged sessions are adopted from cache without re-decoding. The cache format is versioned, so a pricing or semantics change invalidates everything and recomputes.
- **Request cache**: 30s TTL with stale-while-revalidate and single-flight; streamed events only bump the data version and never clear the cache. Pre-warmed ~150ms after boot, so every view returns in milliseconds thereafter. The client polls every 30 seconds.

## Privacy

- All aggregation is local; no session data is sent to external services.
- The npm package contains only `lib/` and the bundle patch; pricing is built into `lib/core/pricing.js`, and the source `pricing/` directory is not shipped. No local logs or session files are included.
- Cost values are estimates, not billing statements.

## Known limitations

- **Normal sessions only**: subagent sessions (`delegationDepth > 0` / `parentSession`) and legacy bare-`<uuid>` directories are not counted, so the session count is lower than the directory count under `~/.dsh/sessions`.
- **Cost is an estimate**: prices come from the local table, and unmatched models are not billed (they show ¥0), so dashboard cost is typically below the upstream bill. Cache "estimated savings" is likewise an estimate from table prices.
- **First cold start takes time**: the initial full-corpus fold runs in the background (~150ms after boot). With a warm disk cache a restart is seconds; if the cache is missing or invalidated by a pricing/semantics change, every session is re-folded (minutes on a large install).
- **Unreadable logs are skipped**: logs that fail migration or are corrupt are not retried, so a few historical sessions may not appear.
- **Active duration accumulates generation intervals**, summed independently across parallel sessions, so it can exceed 24 hours. It measures model generation occupancy, not wall-clock time.
- **`totalMs` is a union of intervals**: overlapping parallel sessions count once, window edges are clipped exactly per event, and step-crossing-boundary cases are approximated.

## Version

Current release: `0.3.13` (see [CHANGELOG.md](CHANGELOG.md))

## Extending & customizing

This project encourages you to use AI-assisted development to add or remove features as needed. Whether it's removing KPI cards you don't care about, adding new chart dimensions, or plugging in your own pricing table — just tell an AI what you want and let it modify the code, run tests, and produce the build artifacts.

Common directions:

- **Remove cards**: delete the corresponding entry from the `cards2` array in `src/client.js`
- **Add charts**: append a section in `src/client.js` that consumes the existing `/dash-api/usage` data
- **Custom pricing**: edit `pricing/vibe-usage-model-pricing-extended.csv` then run `npm run build`
- **Other data sources**: the host half `src/core/rollup.js` is a pure aggregation engine — fork it and swap the event source

The source layout is clean (`src/core/rollup.js` aggregation, `src/host.js` routes, `src/client.js` UI), and `npm test` covers the core logic, making it easy for AI to jump in and modify. PRs sharing your customizations are welcome.

## License

Apache-2.0