# Changelog

All notable changes to `@skkjkk/dsh-usage-dashboard` are documented here.

## [Unreleased]

### 新增

- 新增「模型效能雷达」卡片：在筛选窗口内展示调用量前 **4** 个模型的六维雷达对比，六轴为响应效率（输出 Token / 平均响应 ms）、响应速度（1 / p50 ms）、一致性（1 / (1 + p95/p50)，分位数来自对数直方图）、成本效率（输出 Token / 费用）、缓存命中（%）与 Token 产出（输出 / 计费输入 `billedInput` × 100%）；各轴在窗口内 Max 归一化为 0–100。右侧列表点击或雷达点 hover 高亮对应模型、其余变淡。
- 新增「缓存命中率趋势」卡片：按所选时间范围的每桶绘制缓存命中率折线 + 散点，Y 轴固定 0–100%；展示当前窗口命中率、加权平均命中率（以各桶 `cacheObserved` 加权）与环比百分点变化。断点仅在非相邻桶间出现。

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
