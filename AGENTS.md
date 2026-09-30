# AGENTS.md

dsh-usage-dashboard — DSH (DeepSeek Harness) usage statistics dashboard plugin.

## Project layout

- `src/core/rollup.js` — **Pure aggregation engine** (no ctx, no IO): `foldSession(events)` materializes one compact per-session rollup (sparse hourly buckets with per-model token/cost detail + message counts + durations); `foldAppend(rollup, event)` applies ONE new event incrementally (byte-identical to a full refold — bench `[3]` asserts this); `queryUsage` / `queryDetail` / `queryCalendar` answer any window/filter in memory. `priceFor` lives here; `PRICES`/`VENDORS` are imported from `./pricing.js`.
- `src/core/pricing.js` — **Generated** price + vendor table from `pricing/vibe-usage-model-pricing-extended.csv` (280 models, prices already in ¥/M tokens — no currency conversion). `scripts/regenerate.cjs` prefers the extended CSV and only falls back to the legacy `pricing/vibe-usage-model-pricing.csv` (USD, × 7 → CNY) when the extended file is missing. Never edit by hand — change the CSV and run `npm run build`; it regenerates both `src/core/pricing.js` and `lib/core/pricing.js`.
- `src/host.js` — Glue layer: **event-driven rollups** — init() loads each session ONCE (live sessions from the in-memory Session object, others via `persistence.readFrom`); `ctx.on('session/event')` streams every new event into the matching rollup via `foldAppend` (no disk reads while DSH runs); a 60s reconcile timer loads new sessions and drops removed ones; request-level cache (30s TTL aligned with the client poll, single-flight per key, **stale-while-revalidate on version mismatch** — streamed events bump the version but never clear entries); the settled rollup list is snapshotted for 5s so background revalidates don't re-list every session; pre-warm right after startup. Registers `/dash-api/usage|detail|calendar`.
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
- **Constants in `src/host.js` must live INSIDE `apply()` — module scope never reaches the bundle.** The build extracts only the body of `export function apply(...)` into `lib/index.js`, so anything declared above it is silently dropped while its usages survive: the result passes `node --check` but throws `ReferenceError` at DSH boot. `scripts/regenerate.cjs` now hard-fails the build when an UPPER_SNAKE_CASE identifier is used but never declared (catches both dropped declarations and typos such as `CACHE_MAX_FAIL` vs `CACHE_MAX_FAILURES`), run against `src/host.js` and the generated `lib/index.js`.
- **`apply()` must never bail out early.** `/dash-api/*` routes are registered unconditionally; an optional service (e.g. the `timer` plugin) only degrades its own branch (reconcile + pre-warm). Guarded by `scripts/smoke-host.mjs` — "routes survive no timer".
- **`invalidate()` must never clear the cache.** A streamed metric event only bumps `dataVersion`; `cached()` then serves the last good value immediately and revalidates in the background (single-flight). Clearing entries on every event — or deleting entries whose version drifted — makes every dashboard request pay a full cold recompute (~0.5s for 150+ sessions), which is what made range switching feel slow. The settled result is written unconditionally because single-flight guarantees at most one live compute per key. Guarded by the SWR block in `scripts/smoke-host.mjs`.
- Cost figures are estimates from the generated `PRICES` table: the extended CSV is already priced in ¥/M tokens (no USD × 7 step); only the legacy `vibe-usage-model-pricing.csv` fallback needs the × 7 conversion. New/changed prices belong in the CSV, never in code. DeepSeek V4 flash/pro 自 2026-08-17 00:00（北京时间）起按峰谷定价（rollup.js priceForAt(model, t)）：高峰 周一至周五 9:00-12:00、14:00-18:00（UTC+8），空闲为高峰一半（元/M tokens）；生效前及非 DeepSeek 模型按 CSV 静态价。新峰谷价改动在 rollup.js 的 DS_PEAK，勿改 CSV。
- All aggregation is local; never send session data anywhere.

## Tripwires（每条 = 曾被改坏或极易改坏的约束 + 指向守卫）

- **`invalidate()` 只 bump 版本，绝不清缓存** → smoke SWR block。
- **host.js 常量必须在 `apply()` 体内**（模块作用域被构建剥离且不报错）→ regenerate.cjs 的 undeclared-constants guard。注意该 guard 连字符串字面量里的 UPPER_SNAKE_CASE（如 `CNY`）也会误报——字符串里避免大写常量形标识符。
- **CACHE_FORMAT_VERSION 必须在任何取价/折叠语义变化时 bump**（成本已固化进磁盘缓存 rollup；v12 = 2026-09-30 xAI 补录 grok-4-fast-reasoning / grok-4-fast-non-reasoning / grok-4.20 + kimi-k3 缓存命中价修正；v11 = 2026-09-30 官方全表复核：恢复 gpt-6-sol + 修正 gpt-5.6-terra 变体价；v10 = 2026-09-30 Claude/GPT/MiMo 新模型与 gpt-5.6-sol 促销价修正；v9 = fork-seed 切断 + usage 去重 + 日期后缀取价）→ 人工纪律，PR 描述检查。
- **foldAppend 与 foldSession 必须字节级一致**（含 seed 切断与去重状态）→ bench `[3]`。seed 状态（`_seedCut`/`_seedPending`/`_seenUsage`）必须随 `serializeRollup` 持久化、`deserializeRollup` 恢复，否则 disk-cache 命中后的流式追加会与全量 refold 分叉。
- **fork-seed 语义**：`isSeeded` 头 + 最后一个 `session/end-seed {inherited:true}` 标记 = 精确 seq 切断（last-marker-wins）；无标记 → 全量折叠 + `seededWithoutMarker` 置位（宿主可见，疑似双计）。→ bench `[5]`。
- **usage 去重签名** = 消息 id（或 seq）+ time + 路由 + 六元 token；持久层重放已 flush 记录时签名相同 → bench `[5]` D/E。
- **`durGap`（≤10min 使用口径）是唯一的间隙时长指标**；`presentGap` / `presentMs` 已在 v0.3.13 移除（与 totalMs 高度重复）。
- **`pruneRollup` 只清 ≥3 的 evts 类型**（工具/step/generation 明细），type 0/1/2 保留；cutoff 之前桶的 activeMs 归零是 documented 近似 → bench `[7]`。
- **磁盘缓存孤儿清理**依赖 `cacheIndex`/`states` 一致；改动会话删除路径时确认 sweep 仍能匹配（`<id>.json` 命名 + 跳过 `.` 前缀临时文件）。
- **导出 CSV 公式注入防护**在 `csvCell`：`=+-@` 开头加前导单引号；改动导出格式时不得绕过。

## v0.3.14 变更摘要（2026-09-30）

1. **定价表扩充 246 → 280**：补录 Claude（opus-5-5 / sonnet-5-5 / mythos-5-1 / fable-5-1 连字符官方 id + 点号别名 + opus-5-5-fast）、GPT（gpt-6-sol / gpt-6.1-sol / gpt-6-luna 及 batch/fast/flex 变体、gpt-6-astra 各模式、chat-latest）、MiMo（v2.6-pro / v2.6-flash / v2.6-pro-ultraspeed 及 batch，官方人民币价）。修正 gpt-5.6-sol 促销价 35/210/3.5 → 28/140/2.8 与 gpt-5.6-terra batch/flex/fast 过期价。全部行以官方 pricing 全表（URL 加 `.md` 拿未折叠完整表）+ `/api/docs/models/<id>` 详情页逐一核验；注意旗舰表默认只展开三行，目录槽位省略 ≠ 模型不存在（gpt-6-sol 曾被据此误删，已恢复并改用其官方 10% cache-hit 价 ¥1.4）。另补录 xAI `grok-4-fast-reasoning` / `grok-4-fast-non-reasoning` / `grok-4.20`，修正 `kimi-k3` 缓存命中 5 → 2（官方 ¥2.00/M）。详见 CHANGELOG。
2. **CACHE_FORMAT_VERSION 9 → 12**（v10 = 新模型与促销价修正；v11 = 恢复 gpt-6-sol + gpt-5.6-terra 变体修正；v12 = xAI grok 补录 + kimi-k3 缓存命中价修正，取价变化，旧缓存作废重算）。

## v0.3.13 变更摘要（2026-09-29）

1. **fork-seed 切断**（正确性）：fork 子会话日志的父前缀不再重复计费。
2. **usage 重放去重**（正确性）：持久层重放已 flush 的 assistant 消息不再双计 token/成本。
3. **presentMs 在场时长**（v0.3.12 新增，v0.3.13 移除）：与 totalMs 高度重复，已删除。
4. **pruneRollup + flushCache 集成**（内存/磁盘）：90 天前的桶丢弃工具/step/generation 明细。
5. **磁盘缓存孤儿清理**：reconcile 周期清理已删除会话与旧版本残留的 `.json`。
6. **日期后缀取价兜底**：`gemini-3-pro-002` / `Qwen3.8-Flash-20260101` 等 2-8 位纯数字后缀剥离后命中基础型号；命中不了仍是未匹配（绝不猜测）。
7. **未匹配模型提醒**：coverage < 100% 时过滤栏下方琥珀色徽标，列出未匹配模型。
8. **CSV 导出**：`/dash-api/export` 全量分页导出（含公式注入防护），详细记录卡「导出 CSV」按钮下载。
9. **prepublishOnly → npm run test**：发版前置门禁（build + bench + smoke）。
10. **DSH 0.2.0-rc.1 适配**（元数据级）：API 全部逐符号验证零变化（见 COMPAT.md）；`dsh.client.inject` 增补 `dsh-client-modules`（0.2.0 中 `dsh-client-runtime` 已退役，两个名字并存兼容新旧）、peer 范围改 `>=0.1.0-rc.6 <0.3.0`；`slots.register({` 同行书写（super-injector 预检正则要求）。

## Performance architecture (v0.3)

1. **Materialized per-session rollups** — each session is folded into hourly buckets (per-model `[in,out,cache,costIn,costOut,costCache,calls,durUA]`, message counts, gap durations, active time). All queries are pure memory aggregation.
2. **Event-driven freshness** — `ctx.on('session/event')` streams every new event into the matching rollup via `foldAppend` (µs/event). No `listSnapshots` revision scans and no full-log re-parses on refresh — DSH's JSONL backend expands packed-chunk rows, so a full `readFrom` of a busy session costs seconds; the stream avoids it entirely. Cold load happens once per DSH start (live sessions read from the in-memory Session object; persisted sessions via `readFrom`), pre-warmed ~500ms after boot, reconciled every 60s.
3. **Window edge exactness** — windows rarely align with the hour (e.g. 7d starts at `now-7d`); edge buckets keep lightweight per-event detail (`evts`) and are accumulated exactly, including the cross-bucket gap bridge into the next bucket.
4. **Heatmaps are derived, not stored** — 7×24 heat arrays are up-rolled from hourly buckets per query so window filtering stays correct with zero extra storage.
5. **Requests are stale-while-revalidate, never cold on a warm cache** — each `(endpoint, range, filters)` tuple is one cache key with a 30s TTL and single-flight recompute. Streamed events bump `dataVersion` only, so a key whose data moved underneath it still answers in milliseconds and refreshes in the background; the settled rollup list is additionally snapshotted for 5s so a revalidate does not re-`listSessions()` over 150+ sessions. Measured on a 155-session install: warm requests 2–8 ms, first hit per key ~50–800 ms (one-time), versus ~400–800 ms for **every** request before the fix. Only the one-time cold load (full `readFrom` of every persisted session) is slow — 100s-class for a large install — and it is pre-warmed ~500 ms after boot.

## Smoke checks

- `node --check lib/client.js`, `node --check` (as .mjs) on `lib/index.js` and `lib/core/rollup.js`.
- `npm run bench` → "all checks passed ✔" (correctness + performance).
- The plugin is a **bundle**: `package.json` declares `dsh.bundle.patch: ./cordis.patch.yml` (self-insert row), so `dsh plugin --profile web add @skkjkk/dsh-usage-dashboard` installs it AND auto-appends it to the profile's `dsh.profile.bundles` (reconcilePlugins). The boot process applies each bundle's own patch — no manual cordis.yml/cordis.patch.yml editing. Verify with `scripts/verify-pack.mjs` after packing.
