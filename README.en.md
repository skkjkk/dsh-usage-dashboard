# dsh-usage-dashboard

> A local usage dashboard for the DSH (DeepSeek Harness) Web GUI.

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`dsh-usage-dashboard` is a DSH bundle plugin. It reads local DSH session data and adds a **Settings → 数据看板** view for Token, cost, duration, session and detail statistics. All aggregation stays on the local machine; session content is never uploaded.

## Features

- **KPI overview**: estimated cost, total / input / output / cached Tokens, active duration, total duration, session count and message count.
- **Ranges and filters**: today, 24H, 7D, 30D, 90D and custom dates; filter by model or project.
- **Trend chart**: hourly, daily or weekly Token, cost and duration views; Token mode can toggle input, output and cache segments, with click-to-highlight columns.
- **Hourly activity heatmap**: a 7×24 grid for Token, cost and active duration with exact hover values.
- **Activity calendar**: the latest 40 weeks in a `7 rows × 40 columns` grid, with fixed square rounded cells and viewport-clamped edge tooltips.
- **Token color scale**: daily bands are `0 / ≥1M / ≥10M / ≥30M / ≥60M / ≥100M / ≥200M / ≥250M`; hover a legend swatch to see its threshold.
- **Model and project distributions**: donut charts for Token or cost share; project totals conserve total Token and cost.
- **Detail records**: rows grouped by `time bucket × model × project`, 20 rows per page.
- **Typography**: `Century Gothic` is preferred for Latin letters and numbers, with system CJK fallbacks for comfortable long-session reading.

## Data semantics

- **Tokens** = input + output + cache Tokens.
- **Active duration** counts only actual AI generation time, from the first `assistant/chunk` event until the turn completes. Queueing, TTFT, idle thinking gaps and tool waits are excluded. Parallel sessions are summed independently, so active duration can exceed 24 hours.
- **Total duration** is the span from the first message to the last message per session. Overlapping session spans are merged before summing and clipped to the selected window, so parallel work is not double-counted.
- **Cost** is an estimate from [`pricing/vibe-usage-model-pricing.csv`](pricing/vibe-usage-model-pricing.csv), using USD × 7 for CNY. Unmatched models are not billed. DeepSeek V4 uses Beijing-time peak / off-peak pricing after its configured effective date.
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
npm run build
npm run bench
node scripts/smoke-host.mjs
npm test
```

`npm test` runs the build, engine correctness and benchmark suite, and host route smoke tests. It covers full vs incremental folding, active and total duration semantics, calendar and window boundaries, model / project conservation, and the `/dash-api/usage`, `/dash-api/detail` and `/dash-api/calendar` routes.

Before publishing, inspect the packed artifact:

```bash
npm pack
# Extract the tgz to <package-dir>, then run:
node scripts/verify-pack.mjs <package-dir>
```

The verifier checks that host, core and client bundles load, pricing and bundle files are present, `package.files` is complete, and no personal data is included in the package.

## Freshness and performance

At startup the plugin materializes one in-memory rollup per session. Subsequent `session/event` events update the matching rollup incrementally, queries run in memory, and request caches are invalidated when new events arrive. A 60-second reconcile discovers new or removed sessions and provides recovery for exceptional cases.

## Privacy

All aggregation is local. The npm package contains only `lib/`, the pricing CSV and the bundle patch; it does not include local logs or session files. Cost values are estimates, not billing statements.

## Version

Current release: `0.3.5`

## License

Apache-2.0
