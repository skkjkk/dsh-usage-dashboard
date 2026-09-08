# Changelog

All notable changes to `@skkjkk/dsh-usage-dashboard` are documented here.

## [Unreleased]

### 新增

- 新增「模型效能雷达」卡片：在筛选窗口内展示调用量前 **4** 个模型的六维雷达对比，六轴为响应效率（输出 Token / 平均响应 ms）、响应速度（1 / p50 ms）、一致性（1 / (1 + p95/p50)，分位数来自对数直方图）、成本效率（输出 Token / 费用）、缓存命中（%）与 Token 产出（输出 / 计费输入 `billedInput` × 100%）；各轴在窗口内 Max 归一化为 0–100。右侧列表点击或雷达点 hover 高亮对应模型、其余变淡。
- 新增「缓存命中率趋势」卡片：按所选时间范围的每桶绘制缓存命中率折线 + 散点，Y 轴固定 0–100%；展示当前窗口命中率、加权平均命中率（以各桶 `cacheObserved` 加权）与环比百分点变化。断点仅在非相邻桶间出现。

### 修复

- 修复构建产物 `lib/index.js` 无法启动的致命回归：5 个调优常量（`CACHE_TTL_MS`、`RECONCILE_INTERVAL_MS`、`CACHE_MAX_FAILURES`、`CACHE_STALE_MULTIPLIER`、`PREWARM_DELAY_MS`）曾声明在 `src/host.js` 的模块作用域，而构建只抽取 `export function apply(...)` 的函数体，常量被丢弃、引用全部保留——`node --check` 通过，但 DSH 启动即 `ReferenceError`。常量现已移入 `apply()` 内部。
- 新增构建期守卫：`scripts/regenerate.cjs` 对 `src/host.js` 与 `lib/index.js` 双向扫描 UPPER_SNAKE_CASE 标识符，「使用但未声明」即硬失败（同时覆盖常量被丢弃与拼写不一致两类），并给出明确修复提示。
- 修正缓存失败计数字段名 `CACHE_MAX_FAIL` → `CACHE_MAX_FAILURES`：原代码引用的常量名从未声明，失败计数淘汰分支实际不可达。
- `apply()` 不再因缺少可选 `timer` 服务而提前 `return`：`/dash-api/*` 路由无条件注册，仅定时 reconcile 与启动预热降级。`scripts/smoke-host.mjs` 补齐 timer stub 并新增「routes survive no timer」断言，`npm test` 恢复全绿。
- `playwright` 从 `dependencies` 移至 `devDependencies`：运行期看板不依赖浏览器驱动，下游安装不再拉取该重依赖。
- 清理 3 个从未使用的死常量（`FAST_FILE_THRESHOLD_BYTES`、`PARALLEL_WORKERS`、`EVENT_LISTENERS_KEY`）与过期的 "5 min CACHE_TTL_MS" 注释（实际 30s）。

### 性能

- 修复切换时间范围/筛选时请求始终 ~400–800 ms 的问题。根因：每条流式事件都让 `invalidate()` 清空整个请求缓存，同时 `cached()` 又会丢弃版本漂移的条目——两条路径叠加使 stale-while-revalidate 变成死代码，**每个请求都退化为全量冷重算**（155 个会话实测 0.42–0.83 s，缓存 0 命中）。现在 `invalidate()` 只递增 `dataVersion`，旧版本条目继续即时返回并在后台单飞重算；settled 结果无条件写回（单飞保证每个 key 至多一个在途计算，因此不存在旧结果覆盖新数据）。
- 新增 rollup 列表快照（`ROLLUP_SNAPSHOT_MS` = 5s）：后台重算不再每次重新 `listSessions()` 遍历全部会话。
- 155 个会话实测：热请求 2–8 ms，新 key 首次 50–800 ms（一次性），重复切换 2–3 ms。唯一仍慢的是一次性冷加载（对每个持久化会话做完整 `readFrom`），已由启动后 ~500 ms 的预热覆盖。
- 注意：本项有意反转了 0.3.9 的「旧版本 in-flight 结果不写回缓存」决策。原守卫在缓存随事件清空的前提下是必要的；缓存不再被清空后，该守卫会把后台重算结果全部丢弃，导致条目永久停留在过期版本。0.3.9 的失败计数失效问题由新的无条件写回 + 独立 `failCount` 累加解决。`scripts/smoke-host.mjs` 新增 SWR 断言锁定该契约。

### 数据口径

- 汇总与分桶口径沿用 disjoint bucket 约定：**缓存命中率** = `cacheRead / cacheObserved × 100%`，其中 `cacheRead` 来自 provider 的 `usage.cacheReadTokens`；**`cacheObserved`** = 有显式 cache 遥测的行（provider 报告了 `cacheReadTokens` 或 `cacheWriteTokens`）的 `inputTokens + cacheRead + cacheWrite` 之和，即带 telemetry 的计费输入，未报告的行排除出分母。**`billedInput`** = 全窗口 `inputTokens + cacheTokens` 之和（含未知 telemetry 行），作为覆盖率分母；**覆盖率** = `cacheObserved / billedInput × 100%`，全未知时显示「—」。成本效率轴对未计费模型作 omission 处理（不参与归一化，显示「—」），不映射到 100。
- `src/core/rollup.js` 新增 `totals.cacheRead/cacheWrite/billedInput/cacheObserved/cacheHitRate/cacheCoverage/cacheHitRateDeltaPp` 字段与分桶同名字段；模型聚合额外导出 `avgResponseMs/p50ResponseMs/p95ResponseMs`（对数分桶直方图）以支撑雷达得分计算。
- `src/client.js` 新增 `RadarCard` / `CacheTrendCard` 组件及相关 `.dd-radar-*` / `.dd-cache-*` CSS。

## [0.3.9] - 2026-08-30

### 修复

- 修复时长趋势图将“总时长”和“活跃时长”错误相加堆叠的问题；活跃时长现在作为总时长的底部叠覆层显示。
- 修复滚动窗口下界落在小时中间时的边缘桶遗漏，补齐边缘热力图、Token、费用、缓存读取量和消息计数。
- 修复无 `usage` 的 `assistant/message` 在边缘桶中被遗漏的问题；此类消息只计消息与跨度，不虚构 Token 或费用。
- 修复上一周期只有消息、工具事件或无 usage 消息时环比基线缺失的问题。
- 修复只有孤立消息的趋势桶会话数为零的问题，并为超长趋势范围增加显式桶数上限，拒绝静默截断。
- 统一服务端聚合、热力图、日历、趋势和客户端日期显示到 UTC+8；修复北京时间日期边界和工作日峰谷计价显示错位。
- 自定义日期改为点击“应用”后才提交查询，避免编辑日期时产生连续无效请求。
- 修复 host 请求缓存的旧版本 in-flight 结果覆盖新数据，以及 stale-while-revalidate 失败计数失效的问题。
- 修复事件流创建的新 session、以及已列出 session 遇到滞后 `listSessions()` 快照时被错误清理的问题。

### 安全与隐私

- 移除 `webhook_test.py` 中的任意代码执行路径，改为严格 JSON 对象解析。
- webhook 测试口令改为从 `WEBHOOK_PASSWORD` 环境变量注入，未配置时明确失败。
- 发布包扫描改用通用 token / email 检测，并支持可信发布环境追加 `DASH_PERSONAL_SCAN_PATTERN`；无效自定义正则会回退到默认检查。
- 保持所有用量聚合在本机完成，npm 包不包含原始 pricing CSV、会话日志或本机数据。

### 数据与构建

- 将 `pricing/vibe-usage-model-pricing.csv` 纳入版本控制，重新生成包含 204 个模型的 `src/core/pricing.js` 和 `lib/core/pricing.js`。
- 增强 host 函数抽取器对字符串、模板、注释、正则字面量和正则字符类的词法处理，并加入构建期回归样例。
- 完善 host smoke 与引擎 bench，覆盖边缘桶、缓存竞态、session 列表滞后、UTC+8、原型键和超长趋势等场景。

### 验证

- `npm test`：build、bench、host smoke 全部通过。
- `npm pack` + `scripts/verify-pack.mjs`：发布包内容、host/core/client 加载、bundle patch 和隐私扫描全部通过。
- `python -m py_compile webhook_test.py`：通过；恶意表达式被拒绝且不会执行。

[0.3.9]: https://github.com/skkjkk/dsh-usage-dashboard/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/skkjkk/dsh-usage-dashboard/releases/tag/v0.3.8
