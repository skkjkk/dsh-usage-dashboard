# AGENTS.md

dsh-usage-dashboard — DSH (DeepSeek Harness) usage statistics dashboard plugin.

## Project layout

- `src/core/rollup.js` — **Pure aggregation engine** (no ctx, no IO): `foldSession(events)` materializes one compact per-session rollup (sparse hourly buckets with per-model token/cost detail + message counts + durations); `foldAppend(rollup, event)` applies ONE new event incrementally (byte-identical to a full refold — bench `[3]` asserts this); `queryUsage` / `queryDetail` / `queryCalendar` answer any window/filter in memory. `priceFor` lives here; `PRICES`/`VENDORS` are imported from `./pricing.js`.
- `src/core/pricing.js` — **Generated** price + vendor table from `pricing/vibe-usage-model-pricing-extended.csv` (295 models, prices already in ¥/M tokens — no currency conversion)，另导出 `CACHE_PRICE_UNKNOWN`（CSV 第 5 列为空的模型集合）。`scripts/regenerate.cjs` prefers the extended CSV and only falls back to the legacy `pricing/vibe-usage-model-pricing.csv` (USD, × 7 → CNY) when the extended file is missing. Never edit by hand — change the CSV and run `npm run build`; it regenerates both `src/core/pricing.js` and `lib/core/pricing.js`.
- `src/core/{csv,query-params,session-files,cache-perms,errors}.js` — **host 侧纯逻辑**，靠 import 进 bundle（构建复制**全部** `src/core/*.js`）：`csvCell`/`buildCsv`（CSV 字段合法性 + 公式注入防护）、`parseListParam`/`parseQueryArgs`/`isLoopbackAddress` 与四个端点的 `normalize*Args`/`cacheKey`、`pickLogFile`、`tightenJsonFileModes`（旧缓存文件权限收紧，注入 fsp 才能单测），以及 `BusinessException`。它们此前藏在 `apply()` 体内或构建模板里，只能靠 smoke 端到端测（剩余任务 D2）；`cache-perms.js` 是剩余任务 F3。
- `src/host.js` — Glue layer: **event-driven rollups** — init() loads each session ONCE (live sessions from the in-memory Session object, others via `persistence.readFrom`); `ctx.on('session/event')` streams every new event into the matching rollup via `foldAppend` (no disk reads while DSH runs); a 60s reconcile timer loads new sessions and drops removed ones; request-level cache (30s TTL aligned with the client poll, single-flight per key, **stale-while-revalidate on version mismatch** — streamed events bump the version but never clear entries); the settled rollup list is snapshotted for 5s so background revalidates don't re-list every session; pre-warm right after startup. Registers `/dash-api/usage|detail|calendar|export` (loopback-only by default).
- `src/client/` — Client-half source: **real ESM modules** (valid JS, explicit imports, no implicit globals) that register `settings.section` (id `dashboard`, order 30, label "数据看板"); plain React + DOM charts. Layout: `index.js` (entry: `inject` + `apply(ctx)`), `react.js` (React/`h`), `host.js` (`/dash-api/*` bridge), `plugin.js` (package id + CSS tag id), `css.js` (stylesheet + idempotent injector), `theme.js`, `icons.js`, `format.js` (pure formatters), `chart-math.js` (pure heat/radar math), `hooks.js`, `primitives.js` (Segmented/Dropdown/ModelSelect/FilterBar/Popup/StatCard), `prefs.js`, `nav-icon.js`, `dashboard.js` (KPI rows + card grid), `cards/{trend,heat,radar,cache,calendar,records}.js`.
- `lib/` — Build output (what DSH actually loads): `index.js` (host bundle), `core/*.js` (**every** `src/core/*.js` copied verbatim, incl. `errors.js`), `client.js` (esbuild bundle of `src/client/` wrapped in the `__ModuleLoader__` shell).
- `test/` — `node:test` suites (`npm run test:unit`, also part of `npm test` + CI): engine contracts, client pure modules, the extracted core helpers (CSV / query-params / session-files / cache-perms), `lib`↔`src` build-artifact parity, peer-range semver semantics (`test/peer-range.test.js`), and SSR render snapshots in `test/snapshots/` (refresh deliberately with `UPDATE_SNAPSHOTS=1 npm run test:unit`).
- `scripts/oneoff/` — 手工/一次性脚本（不进 CI）：`measure-seen-usage.mjs`（量 `_seenUsage` 的真实体量，F5 的决策依据）、`verify-client-live.mjs`（G2：把真实 `lib/client.js` 按运行实例的加载契约装进 Chromium，同源代理到活宿主，断言槽注册/样式注入/渲染/导出 CSV；截图落系统临时目录，含真实项目名**不得提交**）。
- `scripts/regenerate.cjs` — Build script: adapts `src/` into `lib/` (host body extraction, **esbuild bundling for the client**, generated pricing table).
- `scripts/client-check.mjs` — Client-half gate: per-module `node --check`, pure-module unit assertions, real React SSR rendering of every card with an engine-produced payload, and the built-bundle loader/slot contract.
- `scripts/bench.js` — Correctness + performance harness: synthesized sessions, field-level comparison of the v0.2 engine against a faithful v0.1 full-scan port, plus timings.

## Rules

- **Edit `src/`, never `lib/` directly.** After changing `src/`, run `npm run build` (node scripts/regenerate.cjs) to regenerate `lib/` and commit both.
- **Keep the engine pure**: aggregation logic belongs in `src/core/rollup.js`; host.js only does I/O, caching and routing.
- Run `npm run bench` after touching the engine — it must stay field-level identical to the legacy algorithm (documented exceptions: `totalMs` KPI is fixed from always-zero and uses **union semantics** — overlapping/parallel session spans are merged so the window total never exceeds the window length; activeMs inside window edge hours is exact via evts backfill, with only the rare step-crossing-`hi` case approximated; both asserted with explicit tolerances). Bench section `[0]` asserts the union rules (overlap dedupe, cross-day clipping, step/start never extending the span).
- **纯逻辑必须能被单测**：新增/修改 `src/core/**` 或 `src/client/**` 的纯函数时，在 `test/*.test.js` 里补一条会失败的断言（`npm run test:unit`），不要只加 smoke 的端到端用例；组件渲染结构变化要显式刷新 `test/snapshots/`（`UPDATE_SNAPSHOTS=1 npm run test:unit`）并在同一提交里 review 差异。
- `totalMs` per window = union of per-session `[max(first,lo), min(last,hi)]` intervals (foldSession's `first`/`last` are message events only — user/assistant/tool-call/tool-result; `step/start` is not a message and never extends the span). Trend bucket `totalMs` uses the same per-gran-key union. `scripts/debug-total.js` reads real session files for file-backed analysis; it picks the log with the **same** `pickLogFile` rule as the host (现行 `session.v<N>.jsonl[.zstd]`）并读会话头的真实 `cwd`（note: live sessions served by `persist.readFrom` may expose fuller in-memory logs than the compacted JSONL mirrors）。
- `queryDetail` rows are grouped by **(time bucket, model, project)** — the same hour used by two models yields two rows, each showing its project name. `rollup.projectTitle` is set by the host glue at fold time.
- The client **source** is a plain-ESM module tree under `src/client/` (no TSX, no framework: `React.createElement` only). `npm run build` bundles it with **esbuild** into `lib/client.js`; the browser runtime needs no bundler. Never reintroduce implicit globals (`React`/`host` are imports) or build-time string rewriting of client source — the module split exists precisely because that was unlintable and untestable (审计 F16).
- The host bundle is ESM (`.js` under `"type": "module"`); the build script itself is CommonJS (`.cjs`).
- **Constants in `src/host.js` must live INSIDE `apply()` — module scope never reaches the bundle.** The build extracts only the body of `export function apply(...)` into `lib/index.js`, so anything declared above it is silently dropped while its usages survive: the result passes `node --check` but throws `ReferenceError` at DSH boot. `scripts/regenerate.cjs` now hard-fails the build when an UPPER_SNAKE_CASE identifier is used but never declared (catches both dropped declarations and typos such as `CACHE_MAX_FAIL` vs `CACHE_MAX_FAILURES`), run against `src/host.js` and the generated `lib/index.js`.
- **`apply()` must never bail out early.** `/dash-api/*` routes are registered unconditionally; an optional service (e.g. the `timer` plugin) only degrades its own branch (reconcile + pre-warm). Guarded by `scripts/smoke-host.mjs` — "routes survive no timer".
- **`invalidate()` must never clear the cache.** A streamed metric event only bumps `dataVersion`; `cached()` then serves the last good value immediately and revalidates in the background (single-flight). Clearing entries on every event — or deleting entries whose version drifted — makes every dashboard request pay a full cold recompute (~0.5s for 150+ sessions), which is what made range switching feel slow. The settled result is written whenever it is not older than the entry already there (`prev.version <= version`); it is stamped with the version the compute **started** from, never with the settle-time version. Guarded by the SWR block and "single-flight version stamp" in `scripts/smoke-host.mjs`.
- Cost figures are estimates from the generated `PRICES` table: the extended CSV is already priced in ¥/M tokens (no USD × 7 step); only the legacy `vibe-usage-model-pricing.csv` fallback needs the × 7 conversion. New/changed prices belong in the CSV, never in code. **CSV 第 5 列（缓存读取价）留空 = 未核到官方价**：`PRICES` 里仍是 0 参与计费，但会进 `CACHE_PRICE_UNKNOWN`，`meta.pricing.cacheUnknownUsed/cacheUnknownTokens` 只统计「本窗口确有缓存 token」的模型，前端据此弹「费用可能低估」徽标；官方确认无缓存计费的写显式 `0`（= 已知为 ¥0），两者语义不同，别为了让徽标消失而乱填 0。DeepSeek V4 flash/pro 自 2026-08-17 00:00（北京时间）起按峰谷定价（rollup.js priceForAt(model, t)）：高峰 周一至周五 9:00-12:00、14:00-18:00（UTC+8），空闲为高峰一半（元/M tokens）；生效前及非 DeepSeek 模型按 CSV 静态价。新峰谷价改动在 rollup.js 的 DS_PEAK，勿改 CSV。
- All aggregation is local; never send session data anywhere.

## Tripwires（每条 = 曾被改坏或极易改坏的约束 + 指向守卫）

- **`invalidate()` 只 bump 版本，绝不清缓存** → smoke SWR block。
- **host.js 常量必须在 `apply()` 体内**（模块作用域被构建剥离且不报错）→ regenerate.cjs 的 `assertNoUndeclaredConstants`（UPPER_SNAKE_CASE 用而未声明；注意它连字符串字面量里的 `CNY` 也会误报——字符串里避免大写常量形标识符）**以及 `assertNoDroppedModuleDeclarations`**（不看命名风格：只要在 `apply()` 之前声明、又在 `apply()` 体内被引用就构建失败，覆盖 camelCase 声明）。
- **host 的纯逻辑必须住在 `src/core/`**：`apply()` 体内或构建模板里写实现只能靠 smoke 端到端测，而且模板会与 core 漂移。`csvCell`/`buildCsv`、`parseListParam`/`parseQueryArgs`/`isLoopbackAddress`、四个端点的 `normalize*Args`/`cacheKey`、`pickLogFile` 都在 `src/core/*.js`，宿主只 import；构建逐名交叉校验导入是否存在 → `test/build-artifacts.test.js`（断言 `lib/index.js` 里没有这些函数的副本）+ `test/core-*.test.js`。
- **`lib/core/` 必须是 `src/core/` 的完整副本**：构建从 `readdirSync(src/core)` 取清单并校验每个相对 import 都落地。旧版只复制 `rollup.js`，于是 `rm -rf lib && npm run build` 产出的 `lib/core/rollup.js` import 悬空（`./errors.js` 仅因历史上被提交才存在）——`node --check` 过、CI 的 drift 检查也过，只有用户 import 时才炸。→ 构建期硬失败（反证：把复制改回单文件立即抛 `lib/core/rollup.js imports ./errors.js but that file was not written to lib/core/`）+ `test/build-artifacts.test.js` + `verify-pack` 的 dangling-import 扫描。
- **解析外部输入的循环必须有边界**：损坏/截断的日志不能把诊断脚本挂死。`scripts/oneoff/diag-step-fields.mjs` 的 `firstFrame` 旧实现用 `for (;;)` 扫 zstd 块头，块头读数恒为 0 时 `v & 1` 永不成立、`p` 越界后 `buf[p]` 仍是 undefined → 死循环（审计 F26）。现在有 magic 校验 + 块头/载荷越界 + 块头上限，且 `firstFrame` 已导出给 `test/oneoff-diag.test.js` 断言「全 0 帧/截断帧立即抛错」。
- **缓存读取价「未知」不能当成「已知为 ¥0」**：CSV 第 5 列为空 → 生成表里是 0 但会进 `CACHE_PRICE_UNKNOWN`，`queryUsage` 只把「本窗口确有缓存 token」的未知模型放进 `meta.pricing.cacheUnknownUsed/cacheUnknownTokens`，客户端另弹一枚琥珀徽标「缓存读取价未知，费用可能低估」（弹层表格里显示「未知」而不是 ¥0）。反过来，官方确认没有缓存计费的行写**显式 0**（`gpt-4` / `phi-4` / 免费模型），不算未知——**别为了让徽标消失把未知行填 0**，那就是审计 F23 的原始 bug。→ `test/pricing-cache-unknown.test.js`（含 `qoder-cn` 必须保持未匹配：它是 provider 名漏进 model 字段）。
- **CACHE_FORMAT_VERSION 必须在任何取价/折叠语义变化时 bump**（成本已固化进磁盘缓存 rollup；**v20 = 2026-10-15 剩余任务 C3 的三处取价修正（ernie-4.5-turbo 0.56/2.24 → 0.8/3.2、gemini-1.5-pro 24.5/73.5 → 8.75/35（≤128k 基础档）、agnes-3.0-flash list 价 → 官方当前价 0/0/0）**；v19 = 2026-10-14 定价表补齐 30 行缓存读取价 + 修正 agnes-2.5-pro（0.03 → 0.315）+ 补录 spark-x2.5 / Qwen3.6-35B-A3B / Qwen3.8-27B**；v18 = 2026-10-14 seed cut 可跨启动续算（`seedCut`/`seedSkip`/`seededWithoutMarker` 入缓存），旧缓存缺这些字段且可能已计入继承前缀；v17 = 2026-10-13 `space-bunny` 基座由 0 改为收费价；v16 = 2026-10-13 补录 sakana-namazu；v15 = 2026-10-13 定价表补录 11 行（280 → 291）；v14 = 2026-10-13 取价归一新增 provider 作用域与市场后缀剥离；v13 = 2026-10-13 折叠状态 `_openSteps`/`_lastClosed`/`_lastMsgT`/`_lastUserT` 纳入往返；v12 = 2026-09-30 xAI 补录 grok-4-fast-reasoning / grok-4-fast-non-reasoning / grok-4.20 + kimi-k3 缓存命中价修正；v11 = 2026-09-30 官方全表复核：恢复 gpt-6-sol + 修正 gpt-5.6-terra 变体价；v10 = 2026-09-30 Claude/GPT/MiMo 新模型与 gpt-5.6-sol 促销价修正；v9 = fork-seed 切断 + usage 去重 + 日期后缀取价）→ 人工纪律，PR 描述检查。
- **模型 id 归一必须在「剥出的名字精确命中」时才计价**（`modelIdCandidates`：原样 → 剥 provider 作用域 `provider:model` / `provider/model` → 剥市场后缀白名单 `-sg/-cn/-us/...`）。**市场后缀白名单绝不能扩大成通用剥后缀**：`-pro`/`-lite`/`-plus`/`-luna` 是模型名本身，通用剥会让 `gpt-5-pro` 被错按 `gpt-5` 计价。`-free` 的语义是「剥掉后按**基座**计价」——基座是收费的（`space-bunny` ¥1.05/4.2/0.21）还是免费的（`ling-3.1-flash` 0,0,0）都走同一条规则，**因此表里登记的是基座，不是 `-free` 名**；两种情形 bench `[0l]` 都有断言。→ bench `[0l]`（含反向断言）。
- **`serializeRollup` / `deserializeRollup` 住在引擎**（`src/core/rollup.js`，纯数据变换），host 只读写文件。`_openSteps` 的 `generation.bucketEvts` 是指向桶 evts 数组的**活引用**：序列化只存 `(t, hk, evtIdx)`，反序列化必须重新绑回重建后的桶数组，否则 `closeStep` 失配 → 静默丢 activeMs。→ bench `[7]` 往返断言。
- **`/dash-api/*` 默认只服务 loopback**（`isLoopbackAddress`：IPv4 / IPv6 / IPv4-mapped / 127.0.0.0/8）——宿主 webserver 自身无鉴权，不能假设绑定。逃生阀 `config.allowNonLoopback`。`dsh-mobile` 从 `127.0.0.1` 反代，不受影响。→ smoke "loopback guard"。
- **请求缓存 key 必须带路由前缀**（`'usage|' + …`）：三个端点的 normalized 参数可以构造出逐字节相同的 JSON，无前缀即互相命中并返回错误结构。→ smoke "cache key namespace"。
- **foldAppend 与 foldSession 必须字节级一致**（含 seed 切断与去重状态）→ bench `[3]`。seed 状态（`_seedCut`/`_seedSkip`/`_seenUsage`/`seededWithoutMarker`）必须随 `serializeRollup` 持久化、`deserializeRollup` 恢复，否则 disk-cache 命中后的流式追加会与全量 refold 分叉。`_seedCut.kind === 'pending'` 是**可续算**状态：晚到的 `inherited` 标记会**重置**上一个 cut 之后的投机折叠（保留 id/cwd/title 元数据），因此 `foldSession` 就是「逐条 `foldAppend`」，不再有独立的 park/flush 路径 → bench `[5]` 的**所有截断点**（含 legacy count 头、第二个标记）必须与整段折叠一致。
- **fork-seed 语义**：`isSeeded` 头 + 最后一个 `session/end-seed {inherited:true}` 标记 = 精确 seq 切断（last-marker-wins）；无标记 → 全量折叠 + `seededWithoutMarker` 置位（宿主可见，疑似双计）。→ bench `[5]`。
- **usage 去重签名** = 消息 id（或 seq）+ time + 路由 + 六元 token；持久层重放已 flush 记录时签名相同 → bench `[5]` D/E。
- **`durGap`（≤10min 使用口径）是唯一的间隙时长指标**；`presentGap` / `presentMs` 已在 v0.3.13 移除（与 totalMs 高度重复）。
- **`pruneRollup` 只清 ≥3 的 evts 类型**（工具/step/generation 明细），type 0/1/2 保留；cutoff 之前桶的 activeMs 归零是 documented 近似 → bench `[7]`。
- **磁盘缓存孤儿清理**依赖 `cacheIndex`/`states` 一致；改动会话删除路径时确认 sweep 仍能匹配（`<id>.json` 命名 + 跳过 `.` 前缀临时文件）。
- **导出 CSV 公式注入防护**在 `csvCell`：`=+-@` 开头先加前导单引号，**再**整体加 CSV 引号（顺序不能反：引号在字段外时，含逗号的值会被解析成多列，后续列可再以 `=` 起始）→ smoke "export formula field"。改动导出格式时不得绕过。
- **列表查询参数（`models` / `projects`）的线上编码是 JSON 数组**，两端必须同编码：垫片写 `JSON.stringify(v)`，服务端 `parseListParam` 先 JSON 解析、失败再退回逗号（兼容旧书签）。**不能退回 `join(",")`**——`projects` 的值是 cwd，Windows 路径可以含逗号，逗号拼接会把一个项目静默拆成两个不存在的项目、筛选变空且无提示。→ smoke "list-param comma encoding"（同时断言 `lib/client.js` 的数组分支与三条服务端行为，两半必须一致）。
- **请求缓存条目的版本戳必须是「本次计算启动时」的 `dataVersion`**，且只在 `prev.version <= version` 时落盘：并发结算下先启动的旧计算不得覆盖后启动的新结果，更不得盖成写入时刻的版本（那会让快速路径误判「新鲜」并在整个 TTL 内既不重算也不 SWR）。→ smoke "single-flight version stamp"（第二个独立 host 实例复现冷启动挂起窗口）。
- **`num()` 契约**：正有限数原样返回；0 / 负数 / NaN / ±Infinity / 字符串 / null / undefined / 对象一律 0。负数归 0 是刻意的（损坏日志不能污染总量与成本），**不要**「修」成放行负值 → bench `[0m]`。`num()` 同时用于 usage 去重签名，缺失字段与显式 0 折叠为同一签名是有意为之（F11 的两条子建议已拒绝）。
- **`bucketSeries` 超桶上限抛 `RangeError`**，路由据此回 **400 `bad_request`**（不是 500）：超宽 custom 窗口是可由 URL 触发的**输入**错误。改动 `registerJsonRoute` 的 catch 时不要把它并回 500。→ smoke "bad-request 400 contract" + bench `[0m]`。
- **长上下文阶梯计价未实现**（`LONG_CONTEXT_MODELS` 已作为死代码删除）：事件带不出 prompt 长度分布，价格一律取 CSV 基础档。要接入必须先在折叠阶段记录 usage 级长度分档，别只在取价层加正则。
- **`Date.UTC(year, …)` 把 0–99 年映射成 1900+年**：`bjDayStart` / `mondayOf` / `hourOf` 一律经 `utcKey(y,m,d,h)`（`src/core/rollup.js`）构造桶键——年份 ≥ 100 走 `Date.UTC` 快路径（`hourOf` 是折叠热路径，不能每次多付一次对象分配），更早/负数年份用 `setUTCFullYear` 显式构造。**不要在引擎里改回裸 `Date.UTC`**：极端早的 `from`（如公元 1 年）会被静默截到 1901 年、桶键全错却不报错；现在这种窗口会真的超出 `MAX_SERIES_BUCKETS` 而抛 `RangeError` → 路由 400。`src/client/format.js` 的 `bjMidnight` 仍用 `Date.UTC`，但它的年份都取自当前日期（≥1970），不要在那里引入 year<100 的输入；构造测试窗口时同样避开 year<100（用「N 年前」的相对毫秒数，或用 `setUTCFullYear`）。→ `test/engine-contracts.test.js` 的 F1 用例 + smoke `year<100 custom window`。
- **导出必须分片让出事件循环，且有行数上限**：`createDetailAggregator` 的两阶段聚合（`addRange`/`finish`）是「交互分页」与「全量导出」共用的唯一实现，宿主每 25 个会话 `await` 让出一次；任何分批都必须与一次取全逐字段一致。`EXPORT_MAX_ROWS`（100000）+ `assertExportRows` 超限抛 `RangeError` → 400，**不要改成静默截断**（导出丢行比报错更糟）。→ 单测「1/2/3/7/整批切分 == 一次取全」+「恰好在上限不抛、超一行抛」。
- **旧缓存文件权限必须读到即收紧**：`mkdir`/`writeFile` 的 mode 只作用于新建对象，旧版本写下的 `<id>.json` 会一直保持 0644。`initStore` 经 `src/core/cache-perms.js` 的 `tightenJsonFileModes(fsp, …)` 按 0600 统一收紧（失败忽略，绝不因此丢缓存）。Windows 的 chmod 只切只读位，**所以不能只靠 smoke 的 mode 断言**（Windows 上会跳过）：必须有 core 单测 + 宿主 bundle 接线断言。→ `test/core-cache-perms.test.js` + smoke `legacy cache mode 0600`。
- **peerDependencies 的预发布语义**：现行范围 `>=0.1.0-rc.6 <0.3.0 || ^0.1.7-rc.1 || ^0.2.0-rc.1`。semver 只在「同 `[major,minor,patch]` 元组且带 prerelease 的比较符」存在时才匹配预发布版本——**只写稳定带（如 `>=0.1.0-rc.6 <0.3.0` 单独用）就会连 npm latest 与桌面端正在跑的 0.2.x-rc 都不匹配**；新的 DSH 预发布线出现时加一条 `^<版本>-rc.x`。**下限不要抬到「验证过的最老版本」`0.1.3-alpha.2`**：lockfile 里解析到的是 `@deepseek-ai/dsh-client-*@0.1.0-rc.8`，抬下限会让 CI 第一步 `npm ci` 直接 ERESOLVE（0.3.20 真实踩过，本地 `npm install` 因 node_modules 已存在而不复现）→ `test/peer-range.test.js` 的**读 lockfile 断言**（锁文件版本必须满足 peer 范围）+「未来补丁号预发布不可表达」反证。
- **客户端轮询在标签页隐藏时暂停**：`src/client/dashboard.js` 的 30s 轮询 + 三个卡片请求（`usage`/`calendar`/`records`）用 `hooks.js` 的纯函数 `isPollingPaused(document)` 判定，隐藏时跳过、重新可见时立即补一次刷新；**不要**退回「`refreshSeq` 只在筛选变化时自增」——那会让看着看板时数据不再自动更新。→ `test/client-pure.test.js`（含产物里必须有 `visibilitychange` listener 的接线断言）。
- **客户端是模块树，不是被改写的片段**：`src/client/**` 必须保持合法 ESM（显式 `import`、无隐式全局、无 `ctx.interval(` / `styles.insert(`）。构建只允许用 esbuild 打包，**不得**恢复任何对客户端源码的正则/字符串改写。`plugin.js` 的 `PLUGIN_ID` 必须等于 `package.json` 的 `name`（构建期断言）。→ `scripts/client-check.mjs`（逐模块 `node --check` + 纯模块单测 + 真实 React SSR 渲染 + 产物 loader/slot 契约）。
- **README 截图必须先匿名化**：`picture/*.png` 是公开发布的，而 fixture 带真实项目名（title）与 cwd 路径（id）。`scripts/capture-screenshots.mjs` 默认在渲染前把 44 个 id/title/label 重写成 `project-a…`（`detail.rows[].project` 存的是 title，按 id↔title 同映射），渲染后断言页面画不出真实标识（全部文本节点含 SVG `<text>` + `title`/`aria-label`/`placeholder`/`alt`，另有"盘符路径"兜底），失败则一张图都不写。`--raw` 仅供本地调试，**其产物不得提交**；`picture/` 只保留 README 引用的 6 张（脚本尾部自动 prune，`--keep-all` 退出）。→ 脚本内 leak 断言（反证：把匿名化改 no-op 即抛 `anonymization leak`）。

## v0.3.22 变更摘要（2026-10-15）

**CI 修复**：0.3.20 把 peer 下限抬到 `>=0.1.3-alpha.2` 之后，CI 第一步 `npm ci` 连续两次 ERESOLVE
（lockfile 里解析到的是 `@deepseek-ai/dsh-client-*@0.1.0-rc.8`，被新下限排除；本地 `npm install` 因
node_modules 已存在而不复现）。本版把下限恢复为 `>=0.1.0-rc.6`，范围 = `>=0.1.0-rc.6 <0.3.0 ||
^0.1.7-rc.1 || ^0.2.0-rc.1`，并补两条护栏：`test/peer-range.test.js` 新增**读 package-lock.json 的断言**
（锁文件里的 DSH 包版本必须满足 peer 范围，抬下限前先失败）；`test/render-snapshot.test.js` 读快照时把
CRLF 归一成 LF（Windows 的 `core.autocrlf=true` 会让干净 worktree 里的快照比较恒假，CI 的 Ubuntu 不受影响）。
**未改任何取价/折叠语义**（`CACHE_FORMAT_VERSION` 仍为 20）。

## v0.3.21 变更摘要（2026-10-15）

剩余任务 C3 的三处取价修正（**CACHE_FORMAT_VERSION 19 → 20**）：`ernie-4.5-turbo` 0.56/2.24 → **0.8/3.2**
（千帆官方在线推理价；原值是整行 7 折促销，原缓存价 0.2 本来就等于官方输入价的 25%）、`gemini-1.5-pro`
24.5/73.5/6.125 → **8.75/35/2.1875**（Google 归档官方页 ≤128k 档；>128k 阶梯不落表，见阶梯计价 tripwire）、
`agnes-3.0-flash` list 价 → 官方**当前价** **0/0/0**（显式 0 = 已知免费，不进 `CACHE_PRICE_UNKNOWN`）。
**未改** Bedrock Nova 的输入价：AWS 官方页把 Nova 分成 Global 跨区与 in-region 两张价表，本仓库 §2.8 的读法与
C3 复核的读法互相矛盾、且官方表格与价格清单 JSON 都取不到可映射的型号，故不动（探针记录与理由见
`pricing/PRICING_VERIFICATION_REPORT.md` §4.5）。守卫：`test/pricing-cache-unknown.test.js` 三条断言 +
bench `[0l]` 的 agnes 断言同步更新。

## v0.3.20 变更摘要（2026-10-15）

低优先代码项 F1–F5 与兼容性核验 G1/G2（本版同时收纳 0.3.19 之后累积的 B/C/D/E 工作）。**未 bump `CACHE_FORMAT_VERSION`（保持 v19）**。

1. **F1**：引擎桶键改走 `utcKey()`（≥100 年走 `Date.UTC` 快路径、更早/负数年份用 `setUTCFullYear`），公元 1 年的 custom 窗口不再被静默截到 1901 年，而是因超出桶上限回 **400**。
2. **F2**：聚合主体下沉为 `createDetailAggregator`（`addRange`/`finish`），宿主导出每 25 个会话让出事件循环；新增 `EXPORT_MAX_ROWS`/`assertExportRows` 行数安全阀（超限 400，不静默截断）。
3. **F3**：新增 `src/core/cache-perms.js`，`initStore` 读到旧缓存文件先按 0600 收紧。
4. **F4**：三路轮询保留，但 `document.visibilityState === 'hidden'` 时暂停、重新可见立即补刷（`isPollingPaused`）。
5. **F5**：维持拒绝「按时间窗淘汰 / 区分缺失与显式 0」，新增 `scripts/oneoff/measure-seen-usage.mjs` 把体量量出来（385 会话：38,103 条 / 3.6 MB ≈ evts 的 35%）。
6. **G1**：peer 范围重写为 `>=0.1.3-alpha.2 <0.3.0 || ^0.1.7-rc.1 || ^0.2.0-rc.1`（旧范围只匹配稳定版）；semver 预发布规则与「未来补丁号预发布不可表达」由 `test/peer-range.test.js` 钉住。
7. **G2**：在**运行中的 0.2.0-rc.2** 上做真实回归——四条 `/dash-api/*` 通过（含 `year<100 → 400`），客户端半边由新的 `scripts/oneoff/verify-client-live.mjs` 在真实 Chromium 里 23 条断言全绿；未能在带 token 的桌面窗口内自动断言「设置壳画 section」这一步，已如实记入 COMPAT.md。

## v0.3.19 变更摘要（2026-10-14）

审计 F16：客户端半边是 1907 行单文件 + 隐式全局 + 构建期字符串替换，**源码不是合法 JS**（`node --check src/client.js` 报 `Illegal return statement`），无法 lint、无法单测。本版拆成 ESM 模块树并用 esbuild 打包。**未 bump `CACHE_FORMAT_VERSION`**（没碰取数/折叠语义）。

1. **`src/client.js` → `src/client/` 模块树**：`index.js`（入口）/`react.js`/`host.js`/`plugin.js`/`css.js`/`theme.js`/`icons.js`/`format.js`/`chart-math.js`/`hooks.js`/`primitives.js`/`prefs.js`/`nav-icon.js`/`dashboard.js` + `cards/{trend,heat,radar,cache,calendar,records}.js`。`React`/`host` 改为显式 import；`styles.insert(CSS)` 与 `ctx.interval(...)` 变成 `injectStyles()` 与真实 `setInterval`。
2. **构建改 esbuild**：`regenerate.cjs` 不再做任何客户端正则/字符串改写，只 `buildSync({ bundle: true, format: 'cjs', external: ['react'] })` 再套 `__ModuleLoader__` 外壳；新增 `PLUGIN_ID === package.json name` 构建期断言。
3. **新增 `scripts/client-check.mjs`（109 断言，进 `npm test` 与 CI）**：逐模块 `node --check`；纯模块单测；host 桥数组编码单测（F14 客户端半边）；用引擎真实 payload 做 React SSR 渲染全部卡片；产物 loader/slot 契约。
4. **其他**：8 处 `'text-anchor'`/`'dominant-baseline'` 引号属性改 React camelCase（渲染结果不变、无警告）；新增 devDeps `esbuild` + `react-dom`（仅测试用，发布包仍只有 `lib/` 与 patch）。

## v0.3.18 变更摘要（2026-10-14）

承接 0.3.17 之后一轮独立复审（对 0.3.17 工作树只读复核 + 合成数据复现），处理其中**已复现的确定缺陷**，每条都补上会真正失败的守卫。**`CACHE_FORMAT_VERSION` 17 → 18**。

1. **导出 CSV 字段合法性**：`csvCell` 把前导单引号放在 CSV 引号之外，含逗号的公式型值被解析成多列（项目名 `=1,=2` → 9 列）。改为「先加引号、再整体加 CSV 引号」；smoke 用合成导出断言每个字段解析后恰好 8 列且以字面单引号开头。
2. **fork-seed 可续算**（v18）：`pending` cut 在标记到达时**重置**其后的投机折叠，`foldSession` 即「逐条 `foldAppend`」；`seedCut`/`seedSkip`/`seededWithoutMarker` 入缓存往返。bench `[5]` 对三个夹具**枚举全部截断点**。
3. **DeepSeek 前缀误计价**：`resolveDSModel` 改为「归一 + 剥日期后缀后必须精确命中别名集合」，`deepseek-flash-bogus` / `deepseek-v4-prototype` 不再被计价；bench `[4]` 三处一致性地反向断言。
4. **窗口下边界活跃时长**：`computeRollupActiveMs` 多回看一个桶，跨窗口下界的生成区间不再整条丢失；bench `[0n]`。
5. **边缘幽灵模型行**：无 usage 的 `assistant/message` 型号位写 `null`（此前 `fill(0)` + `!== null` 判空 → `id=0` 行）；bench `[0n]`。
6. **空列表清理 state**：`refreshCorpus` 区分「权威地空」（继续走删除循环）与「列不出来」（仍提前返回）；smoke 独立 host 实例断言清空后 `sessions === 0`。
7. **读取失败预算按连续计**：成功读取重置 `failCount`/`lastError`；smoke 用真实临时会话库跑 `fail→ok→fail→ok→fail`，断言 `retryPending === 1`（反向验证过：去掉重置即失败）。
8. **usage 缓存 key 白名单**：只由 `queryUsage` 真正读取的参数构成，未知 URL 参数不再制造无界条目；smoke 断言 bundle 内无 `...input`（原有靠未知参数「换 key」的用例改为变化真实 `to`）。
9. **构建：legacy USD 回退漏乘 7**：`parsePricingCsv(text, multiplier)` + 构建期自检；**空缓存价行**改为构建期统计打印（审计 F23 的可见化，不失败）。
10. **其他**：`export` 聚合前也让出一次事件循环；旧缓存目录/临时文件权限显式收紧；README/README.en 版本号对齐到 0.3.18。
11. **未改**：F11（继续拒绝）、F14 的三路轮询（服务端 SWR 下成本极低，且有意保持卡片新鲜）、F16/F21/F23 逐行核价/F26/F32、`Date.UTC` 0–99 年。

## v0.3.17 变更摘要（2026-10-13）

承接 0.3.16 的「已知遗留」，处理审计报告里仍未修复的**代码级**发现（F14 / F7 / F25 / F29）。**未 bump `CACHE_FORMAT_VERSION`**（保持 v17）：本版没碰取价与折叠语义，磁盘缓存里的 rollup 与成本数值不受影响。

1. **项目筛选逗号协议（F14）**：`projects` 的值是会话 cwd，Windows 路径可含逗号，而垫片用 `join(",")`、服务端用 `split(",")` → 单个项目被静默拆成两个不存在的项目，筛选变空且无提示。改为 JSON 数组编码 + 服务端先 JSON 后逗号（旧书签仍可用）；客户端淡入 key 的同类碰撞一并修掉。
2. **single-flight 版本戳（F7）**：缓存条目此前盖「写入时刻」的 `dataVersion`，乱序结算时旧计算会覆盖新结果却标记为当前版本 → 快速路径误判新鲜、整个 TTL 内既不重算也不 SWR。改为盖**启动版本**且仅在 `prev.version <= version` 时落盘；SWR 的性能修复保持不变。
3. **`num()` / `bucketSeries` 契约（F29）**：`num()` 行为不变但契约写入注释并由 bench `[0m]` 的 12 个用例钉住；`bucketSeries` 超桶上限的 `RangeError` 由 500 改判 **400 `bad_request`**（超宽 custom 窗口是可由 URL 触发的输入错误）。
4. **死代码（F25）**：删除从未被引用的 `LONG_CONTEXT_MODELS`，阶梯计价「未实现」的说明改写成散文。
5. **仍未修**：F11（继续拒绝其两条子建议）、F16、F21、F23、F26/F32 的部分项；另新发现 `Date.UTC` 把 0–99 年映射成 1900+年导致极端早的 `from` 被静默截断（已记入 tripwire，未改代码）。

## v0.3.15 变更摘要（2026-10-13）

1. **隐私**：`unreadable-sessions-report.md`（321 个真实会话 UUID + 本机项目路径）从**全部 git 历史**移除（`git filter-repo` + 强制推送 main 与 v0.3.11~v0.3.13 tag）；重写前后 `HEAD^{tree}` 逐字节一致。产生机制一并堵住（脚本输出移到 `~/.dsh/usage-dashboard-reports/`、`.gitignore` 补模式、CI 加护栏）。详见 CHANGELOG。
2. **`/dash-api/*` 默认只服务 loopback**（F1）：宿主 webserver 无鉴权，不能假设绑定；逃生阀 `config.allowNonLoopback`。`dsh-mobile` 从 127.0.0.1 反代，手机访问不受影响。
3. **缓存 key 加路由前缀**（F6）：`usage`/`detail`/`calendar` 的 normalized 参数可构造出相同 JSON，无前缀即互相命中。
4. **`export` 一次聚合取全**（F2）：新增引擎纯函数 `queryDetailAll`；导出侧加跨 key 串行闸 + 让出事件循环；坏时间戳跳过并计数（F9）；`csvCell` 先剥前导空白（F28）。
5. **CACHE_FORMAT_VERSION 12 → 13**（F5）：折叠状态纳入磁盘缓存往返，修掉「崩溃截断 + 跨启动 resume」静默丢 activeMs 与延迟样本；`serializeRollup`/`deserializeRollup` 下沉到引擎，bench `[7]` 补真实往返断言。
6. **会话读取失败可见化 + 退避复活**（F8）：`meta.sessionHealth`（dead / retryPending / lastError），reconcile 按 2^n 退避复活，上限 3 次。
7. **前端**：busy 不再永久卡住（F12）、错误不再静默且热力图有失败态+重试（F13）、未匹配徽标真正打开定价弹层（F15）、`inject` 去掉未使用的 `timer`（F17）、分页收敛与键盘语义（F30）。
8. **工程**：新增 CI（含「生成物漂移」检查）、`package-lock` 换官方 registry 且 `npm ci` 可复现、`prepublishOnly` 增补 verify-pack、`exports` 去掉误导性子路径、构建守卫改语义检查（F18/F19）、bench 热力图容差按序列收紧、8 个一次性脚本移入 `scripts/oneoff/`。
9. **未采纳**：F11 的两条子建议（按时间窗淘汰签名 / 签名区分字段缺失与显式 0）会破坏重放去重、直接损伤成本准确性，故拒绝；F16（client.js 拆模块 + 标准打包器）与 F21（截图匿名化重拍）属独立任务。详见 CHANGELOG。

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
2. **Event-driven freshness** — `ctx.on('session/event')` streams every new event into the matching rollup via `foldAppend` (µs/event). No `listSnapshots` revision scans and no full-log re-parses on refresh — DSH's JSONL backend expands packed-chunk rows, so a full `readFrom` of a busy session costs seconds; the stream avoids it entirely. Cold load happens once per DSH start (live sessions read from the in-memory Session object; persisted sessions via `readFrom`), pre-warmed ~150ms after boot, reconciled every 60s.
3. **Window edge exactness** — windows rarely align with the hour (e.g. 7d starts at `now-7d`); edge buckets keep lightweight per-event detail (`evts`) and are accumulated exactly, including the cross-bucket gap bridge into the next bucket.
4. **Heatmaps are derived, not stored** — 7×24 heat arrays are up-rolled from hourly buckets per query so window filtering stays correct with zero extra storage.
5. **Requests are stale-while-revalidate, never cold on a warm cache** — each `(endpoint, range, filters)` tuple is one cache key with a 30s TTL and single-flight recompute. Streamed events bump `dataVersion` only, so a key whose data moved underneath it still answers in milliseconds and refreshes in the background; the settled rollup list is additionally snapshotted for 5s so a revalidate does not re-`listSessions()` over 150+ sessions. Measured on a 155-session install: warm requests 2–8 ms, first hit per key ~50–800 ms (one-time), versus ~400–800 ms for **every** request before the fix. Only the one-time cold load (full `readFrom` of every persisted session) is slow — 100s-class for a large install — and it is pre-warmed ~150 ms after boot.

## Smoke checks

- `node --check lib/client.js`, `node --check` (as .mjs) on `lib/index.js` and `lib/core/rollup.js`.
- `npm run test:unit` → `node --test` 单元套件（58 条）：引擎契约（num / bucketSeries / **F1 年 <100 桶键** / 取价与峰谷 / 序列化往返 / **F2 分批聚合与导出行上限**）、客户端纯模块（format / chart-math / host 桥 / CSS 注入器 / **F4 轮询暂停**）、`src/core/{csv,query-params,session-files,cache-perms}`、`lib`↔`src` 构建产物一致性与相对 import 可解析、**G1 peer 范围 semver 矩阵**（`test/peer-range.test.js`）、定价缓存价「未知 vs 显式 0」与 `qoder-cn` 必须保持未匹配（`test/pricing-cache-unknown.test.js`）、SSR 渲染快照（`test/snapshots/`，`UPDATE_SNAPSHOTS=1` 刷新）、以及一次性脚本的边界（`scripts/oneoff/diag-step-fields.mjs` 的 `firstFrame` 对截断帧必须抛错）。
- `npm run bench` → "all checks passed ✔"（correctness + performance；`[7]` 含 serialize/deserialize 往返断言，`[0m]` 含 `num()` / `bucketSeries` 输入契约）。
- `node scripts/smoke-host.mjs` → 十四条断言：cache/event regressions、routes survive no timer、**loopback guard**、**cache key namespace**、**export one-pass path**（含公式字段整体引用与列数校验）、client contract check（含 `lib/client.js` 数组参数必须是 JSON 编码）、**list-param comma encoding**、**bad-request 400 contract**、**year<100 custom window**（F1）、**legacy cache mode 0600**（F3，POSIX 段 + 与平台无关的接线断言）、**single-flight version stamp**、**empty corpus prunes state**、**session retry budget resets**、**usage cache key whitelist**。
- `node scripts/oneoff/verify-client-live.mjs --range 7d` → G2：把真实 `lib/client.js` 装进 Chromium（同源代理到活宿主的 `/dash-api/*`），23 条断言覆盖 loader/槽注册/样式注入/渲染/导出 CSV。需要该实例已装此插件；截图写系统临时目录（含真实项目名，不得提交）。
- `node scripts/oneoff/measure-seen-usage.mjs` → F5：量真实缓存里 `_seenUsage` 的条目数/字节数并对比 `evts`（当前 385 会话：38,103 条 / 3.6 MB ≈ evts 的 35%）。
- `node scripts/client-check.mjs` → 客户端半边门禁：`src/client/**` 逐模块 `node --check`、纯模块单测（格式化/图表数学/主题/host 数组编码/CSS 注入器）、用引擎真实 payload 做 React SSR 渲染、以及构建产物的 loader/slot 契约（109 条断言）。
- `node scripts/capture-screenshots.mjs [--range 30d] [--dark]` → README 截图重拍：**默认匿名化**（`project-a…`）并在渲染后断言页面里 0 个真实标识、0 条盘符路径；`--raw` 才逐字渲染（产物禁止提交）。图片可再用系统 OCR 复核（旧图做阳性对照）。
- `node scripts/verify-pack.mjs`（无参 = 校验仓库根目录；跳过 `node_modules`/`.git`/`.audit`/`picture`）。
- The plugin is a **bundle**: `package.json` declares `dsh.bundle.patch: ./cordis.patch.yml` (self-insert row), so `dsh plugin --profile web add @skkjkk/dsh-usage-dashboard` installs it AND auto-appends it to the profile's `dsh.profile.bundles` (reconcilePlugins). The boot process applies each bundle's own patch — no manual cordis.yml/cordis.patch.yml editing. Verify with `scripts/verify-pack.mjs` after packing.
