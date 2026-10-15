# Changelog

All notable changes to `@skkjkk/dsh-usage-dashboard` are documented here.

## [0.3.21] - 2026-10-15

### 定价修正（剩余任务 C3）· `CACHE_FORMAT_VERSION` 19 → 20

> 三处都以**官方页原文**核实后修改（不是第三方目录）。历史成本随之变化，因此磁盘缓存里的
> rollup 必须作废重算——这就是 bump 版本号的原因。逐行出处见
> [pricing/PRICING_VERIFICATION_REPORT.md](pricing/PRICING_VERIFICATION_REPORT.md) §4.5。

- **`ernie-4.5-turbo` 输入/输出：0.56 / 2.24 → 0.8 / 3.2**（缓存读取 0.2 不变）。千帆官方价格页
  （2026-07-09 更新）的在线推理价是输入 `0.0008 元/千tokens`、输出 `0.0032`、命中缓存 `0.0002`
  → ¥0.8 / ¥3.2 / ¥0.2。原值是整行的**7 折**（0.8×0.7、3.2×0.7），即已过期的促销档；原缓存价
  0.2 恰好等于官方输入价的 25%，本身就在反证输入价应为 0.8。
- **`gemini-1.5-pro`：24.5 / 73.5 / 6.125 → 8.75 / 35 / 2.1875**。Google 官方归档价格页的
  Pay-as-you-go「prompts up to 128k」档是 input $1.25 / output $5.00 / context caching $0.3125
  （×7）。原值 24.5/73.5 是**发布期档位**（$3.50/$10.50）。>128k 档（$2.50/$10.00）不落表：
  插件拿不到 prompt 长度分布、阶梯计价未实现（见 AGENTS tripwire），取基础档并在报告记明。
- **`agnes-3.0-flash`：0.35 / 1 / 0.035 → 0 / 0 / 0**。Sapiens 官方 wiki 的 `agnes-3.0-flash`
  三列 **Current price** 全为 `$0 / M`（list price 已划掉），并写明「cached input / input / output
  are currently free for agnes-2.5-flash and agnes-3.0-flash」——与同表 `agnes-2.0-flash` /
  `agnes-2.5-flash`（0/0/0）口径一致。**这是显式 0（已知免费）**，不进 `CACHE_PRICE_UNKNOWN`，
  不会误报「费用可能低估」。
- **未改：Bedrock Nova 的输入价**（理由与探针记录见报告 §4.5）。AWS 官方页把 Nova 分成 Global
  跨区与 in-region 两张价表，而本仓库 §2.8 的「官方」读法与 C3 复核的读法互相矛盾；官方价格清单
  JSON 的 key 是哈希、`sets` 为空，无法映射型号。在拿到可核对的档位前不动——现有五行 Nova 内部
  自洽（缓存 = 输入 × 25%），只有 nova-pro / nova-premier 在两种读法下都一致。
- **守卫**：`test/pricing-cache-unknown.test.js` 的三条断言改为新值（含「免费是已知的 0、不算未知」），
  bench `[0l]` 的 `scopedPos.agnes3` 同步改为 0 并加了一条输入价断言。`npm test` 全绿
  （58 条单测 / bench 全对拍 / smoke 14 条 / client-check 110 条），`verify-pack` 通过。

## [0.3.20] - 2026-10-15

> 本版 = 0.3.19 之后累积的全部未发布内容（B1/B2 隐私与截图、C1/C2 定价、D1–D3 测试基建、
> E1–E4 脚本债、F1–F5 低优先项、G1/G2 兼容性核验）。同步补打 `v0.3.14` ~ `v0.3.20` 的 tag，
> 并把 0.3.14 之后的版本首次发布到 npm（此前 npm `latest` 停在 0.3.13）。

### 遗留低优先项（剩余任务 F1–F5）与兼容性核验（G1 / G2）

> 2026-10-15，随 **0.3.20** 发布。**未 bump `CACHE_FORMAT_VERSION`**（v19 不变：这轮改动没有触碰取价/折叠语义，
> 磁盘缓存里的 rollup 与成本数值不受影响）。
> `npm test` 全绿（58 条单测 / bench 全对拍 / smoke 14 条 / client-check 110 条），`verify-pack` 通过。

- **F1 `Date.UTC` 的 0–99 年映射**（`src/core/rollup.js`）：`Date.UTC(year, …)` 把 0–99 年映射成
  1900+年，于是 `?range=custom&from=<公元 1 年>` 会被**静默截到 1901 年**——桶键全错、桶数远低于
  上限，回 200 空结果而不是报错。新增 `utcKey()`：年份 ≥ 100 走 `Date.UTC` 快路径（`hourOf` 在折叠
  每个事件时都会被调用，热路径不能多付一次对象分配），更早/负数年份改用 `setUTCFullYear` 显式构造。
  桶键恢复正确后，「公元 1 年 → 现在」这种窗口会**真的**超出 `MAX_SERIES_BUCKETS` 而抛 `RangeError`
  → 路由回 **400 `bad_request`**（语义更清楚，也不再有静默错误数据）。守卫：`test/engine-contracts.test.js`
  的 F1 用例 + smoke 新增 `year<100 custom window`；**反证已验**（换回 `Date.UTC` 立即 smoke/单测双红）。
  活实例实测：`from=0001-01-01` → `400 {"error":"bad_request","message":"trend range exceeds 50000 buckets"}`。
- **F2 导出阻塞宿主线程**（`src/core/rollup.js` + `src/host.js`）：聚合主体下沉为引擎的
  `createDetailAggregator(req)`（两阶段 `addRange(rollups, from, to)` / `finish()`；`queryDetail` 与
  `queryDetailAll` 改成调用同一个聚合器，一批加到底），宿主导出时**每 25 个会话让出一次事件循环**，
  于是长导出只是「慢」而不再在整个聚合期间占满宿主线程。另加行数安全阀 `EXPORT_MAX_ROWS = 100000`
  + `assertExportRows()`：超限抛 `RangeError` → 400 而不是静默截断（导出丢行比报错更糟）。守卫：
  单测「1/2/3/7/整批切分 == 一次取全」「恰好在上限不抛、超一行抛」。**未做**流式响应（该路由模板是
  一次性 `JSON.stringify` 返回，改造面远大于收益）。
- **F3 旧缓存文件权限不会随升级收紧**（`src/core/cache-perms.js` + `src/host.js`）：`mkdir`/`writeFile`
  的 mode 只作用于**新建**对象，旧版本以默认 umask 写下的 `<id>.json` 会一直保持 0644。`initStore`
  读到缓存目录清单后先按 0600 统一收紧再读取（单个失败不影响其余；权限收紧失败绝不导致丢缓存）。
  守卫：`test/core-cache-perms.test.js`（**任何平台**都断言按 0600 调用了每个 `.json`，因为 Windows 的
  chmod 只切只读位、smoke 的 mode 断言在 Windows 上会被跳过）+ smoke 在 POSIX 上用 `stat` 断言真实
  mode + smoke 断言宿主 bundle 真的调用了该函数。**反证已验**（去掉 `fsp.chmod` 那行 → 单测 4 红）。
- **F4 三路轮询**：`refreshSeq` 只在筛选变化时自增的方案会让「看着看板时数据不再自动更新」，与 SWR 的
  设计意图相反，**不采纳**；改为按 `document.visibilityState === 'hidden'` 暂停 30s 轮询、重新可见时
  立即补一次刷新（`src/client/hooks.js` 的纯函数 `isPollingPaused`）。守卫：`test/client-pure.test.js`
  （含「实现漏接线」检查：产物里必须有 `visibilitychange` listener）。
- **F5 `_seenUsage` 无界增长**：维持**拒绝**「按时间窗淘汰」「区分缺失与显式 0」两条子建议，但先把
  内存量出来了——新增 `scripts/oneoff/measure-seen-usage.mjs`，本机 385 会话实测 **38,103 条签名 /
  3.6 MB（97 B/条、9.4 KB/会话、最大 778 条/77 KB）**，同批 rollup 的 `evts` 明细是 174,931 条 /
  10.2 MB：签名占 evts 的 **34.8%**、占缓存 JSON（14.5 MB）的 25%，与代码注释「与事件数同阶且远小于
  evts」一致；按均值外推 10k 会话 ≈ 92 MB 签名，而同一量级的 rollup 本体 ~377 MB。定长哈希能压到
  约 1/3，但要 bump 缓存格式、全量重算，并把「零碰撞」换成「极低概率碰撞 → 静默少计成本」，故不改。
- **G1 peer 范围的预发布语义**（`package.json` + `test/peer-range.test.js` + COMPAT.md）：实测
  （新增 devDep `semver`）确认旧范围 `>=0.1.0-rc.6 <0.3.0` **只匹配稳定版**——连当时的 npm `latest`
  （`0.1.7-rc.2`）与桌面端 `0.2.0-rc.1` 都不匹配。改为
  `>=0.1.3-alpha.2 <0.3.0 || ^0.1.7-rc.1 || ^0.2.0-rc.1`（三个 DSH client 包统一）：稳定带全覆盖 +
  两条在用预发布线；下限取 COMPAT 验证过的最老版本。测试同时钉住**不可表达**的部分：
  `0.2.1-rc.1` 这类「未来补丁号的预发布」对任何范围都为 false（8 种候选写法反证，只有
  `includePrerelease: true` 才行，而 `peerDependencies` 表达不了；npm 的 peer 校验传的是 loose）。
- **G2 在 DSH 0.2.x 上真实回归**（比要求的基线更新：本机运行实例是 **0.2.0-rc.2**，六个相关子包版本
  从运行实例 `app.asar` 读出，`dsh-client-runtime` 确认不存在）。宿主半边：`dev_reload_package` 把新
  构建装进活实例后，四条 `/dash-api/*` 全部通过（7d：49 会话 / 12.4 亿 token / 覆盖率 99% / 未匹配 0，
  冷 428 ms、热 6–24 ms；导出 30d/90d 8 列）。客户端半边：新增
  `scripts/oneoff/verify-client-live.mjs`，把 `lib/client.js` 按运行实例的加载契约装进真实 Chromium、
  页面同源代理到活宿主，**23 条断言全绿**（槽注册 name/order/label、样式注入、10 KPI / 21 SVG /
  280 日历格 / 20 记录行、无 pageerror / console error / 4xx、点真实按钮导出 CSV 58 行 8 列）。
  未做到的一步如实记在 COMPAT.md：桌面端自己的窗口 URL 带 token，取不到，因此「设置壳把 section
  画进侧栏」这一下没有自动断言。
- 工程侧：新增 core 模块 `src/core/cache-perms.js`（`verify-pack` 必需文件清单、构建产物守卫同步更新）；
  smoke 由 12 条增至 14 条（`year<100 custom window`、`legacy cache mode 0600`）；单测 47 → 58 条。

### 截图匿名化（隐私）

- **问题**：`scripts/capture-screenshots.mjs` 把从真实 `/dash-api/*` 抓的 fixture 逐字渲染，于是 `meta.projects[].title`（真实目录名）、`meta.projects[].id`（绝对 cwd 路径）、`meta.dist.projects[].label` 与 `detail.rows[].project` 都进了 PNG。OCR 在旧图里直接读出 `05-研究生-毕业论文`、`DeepSeek-harness`、`dsh-usage-dashboard` 等真实名。
- **修法**：脚本默认**在渲染前匿名化**——按最宽窗口（90d→today）的项目分布排序，把 44 个 id/title/label 映射为 `project-a`、`project-b`…；`detail.rows[].project` 存的是 **title**，因此按各窗口里的 id↔title 配对走同一映射。只有 `--raw` 才逐字渲染，且会打印"不要提交"的警告。
- **守卫（会真正失败）**：渲染完成、截图之前断言**页面画不出任何真实标识**——收集 body 下全部文本节点（SVG `<text>` 在内，跳过注入的 `<style>`/`<script>`）与 `title`/`aria-label`/`placeholder`/`alt` 属性，去空白小写后与 44 个真实名逐一比对，命中即抛 `anonymization leak …`（截图一张都不会写）。另加一条**与 fixture 无关**的兜底：任何 `X:/`、`X:\` 形式的盘符路径被画到页面上即失败——将来若有人把 cwd 渲染进 UI，即使白名单里没有它也会被拦下。
- **反证测试**：把脚本里的三处 fixture 重写改成 no-op 后运行，立即以 `anonymization leak — real project identifier painted on the page: DeepSeek-harness | dsh-daily-checkin | …` 退出且不产出图片（本机已验），确认断言不是空转。
- **只留被审阅的 6 张**：脚本末尾删除 `picture/` 中非 README 引用的产物（`dashboard-full` / `records` / `radar` / `cache-insight`，`--keep-all` 可退出），避免未审阅的裁剪图作为未跟踪文件被顺手提交。
- **重拍 + 复核**：6 张（浅色 30d 与深色）已重新生成；对**图片本身**做 OCR 复核，44 个真实名 **0 命中**。OCR 检测器以 HEAD 旧图做**阳性对照**：同样 44 个名字在旧图里命中 15 处（`calendar-records` 3 / `dashboard-dark` 7 / `distributions` 5），证明检测有效而非静默通过。
- 顺带修掉脚本头注释里过期的一次性依赖说明（`react` / `react-dom` / `playwright` 已是 devDependencies，剩余任务 E4）。

### 全历史图片普查与清除（B2，已执行）

- **普查**：曾入库的图片 blob 共 **20 个**，逐张 OCR 后 **5 个**含真实项目名——`803268e4` 的 `picture/{calendar-records,dashboard-dark,distributions}.png`（旧图，当时仍可从 `origin/main` 到达）与 `0c031f8` 已删除的 `picture/Snipaste_2026-08-19_21-29-29.png`、`..._21-29-53.png`；其余 15 个（`dashboard-overview` / `radar-cache` / `trend-heatmap` 与根目录 `cache-*` / `radar-v2-*` / `radar-v3-final`）OCR 未见项目名。
- **文本历史是干净的**：`selection-translator` / `05-研究生-毕业论文` / `paismart` / `scholarship-2026` / `06-Agentworkspace` / `ideacode` / `evoagent` 全历史 pickaxe 均 0 命中——泄露面就是图片。
- **执行**：先 `git bundle create --all` 全量备份（另存 6 张已审阅 PNG），把 `.gitignore` 改动与未跟踪的 `docs/` 暂时移出以保证工作区干净，然后 `git filter-repo --path picture/ --invert-paths`（一次覆盖两批图）→ 重新提交同一批匿名图 → 强推 `main`、`evoagent-webhook-test` 与 `v0.3.8` ~ `v0.3.13`（`v0.3.4` ~ `v0.3.7` 不含图片，SHA 不变）。
- **验证**：重写后 `git rev-list --all --objects` 里 **0 个 `picture/` 路径**、旧 blob `d582be31…` 已不存在；重新提交后 `HEAD^{tree}` 与重写前的 `bd40d2b4…` **逐字节一致**（证明除旧图外无任何变化）；从 GitHub **全新 clone** 复核：`picture/` 只有 1 个提交、6 个新 blob，泄露 blob 不可得；README 的 raw 链接已返回新图（84,498 B，旧图 74,757 B）。
- **仍未完成（需要外部动作）**：GitHub 侧不可达对象仍可被 `git fetch origin <旧 SHA>` 取到（本机实测：`ff0dded…`、旧 blob `d582be31…` 仍可下载），且 `refs/pull/1/head` 仍指向重写前的 `4764ca3d…`。已拟好 GitHub Support 请求（含旧 ref/blob SHA 清单），需人工提交；随后通知协作者重新 clone。


### 测试基建（D1 / D2 / D3）

- **D1 `node:test`**：新增 `npm run test:unit`（`node --test`，36 条）并接进 `npm test` 与 CI。`test/engine-contracts.test.js` 钉引擎契约（`num()` 的 12 种输入、`bucketSeries` 桶数与超限 RangeError、`priceFor` 精确命中（`gpt-5-pro` ≠ `gpt-5`、`-free` 按基座计价）、`priceForAt` 峰谷价与生效前 CSV 回退、`foldAppend` 逐条 == `foldSession` 一次性、serialize/deserialize 往返含 `generation.bucketEvts` 活引用重绑与旧缓存宽容、`totals.pct` 只可能是 null 或有限值）；`test/client-pure.test.js` 钉客户端纯模块（PLUGIN_ID == 包名、主题枚举、格式化、图表数学、host 桥的 JSON 数组编码、CSS 注入器幂等与无 document 退化）。
- **D2 host 纯逻辑下沉到 `src/core/`**：新增 `src/core/csv.js`（`csvCell`/`buildCsv`）、`src/core/query-params.js`（`parseListParam`/`parseQueryArgs`/`isLoopbackAddress` 从构建模板移出，外加四个端点的 `normalize*Args` 与 `cacheKey`）、`src/core/session-files.js`（`pickLogFile`，E1 可直接复用）；`src/host.js` 改为 import。**顺带修掉一个潜伏的构建缺陷**：构建此前只复制 `src/core/rollup.js`，因此 `rm -rf lib && npm run build` 会产出 import 悬空的 `lib/core/rollup.js`（`./errors.js` 仅因历史上被提交才存在），`node --check` 与 CI 的 drift 检查都发现不了——现在复制**全部** `src/core/*.js` 并校验每个相对 import 都落地（反证：把复制改回单文件立即抛 `lib/core/rollup.js imports ./errors.js but that file was not written to lib/core/`）。宿主导入改为按 `./core/<module>.js` 通用提取 + 逐名交叉校验导出。新增 4 个测试文件（CSV 字段/公式防护、查询参数与缓存键、文件名判定、`lib`↔`src` 产物一致性与相对 import）。
- **D3 渲染快照**：`test/render-snapshot.test.js` + `test/snapshots/`（11 个组件快照、约 71 KB），夹具用固定时间戳（不取 `Date.now()`），`UPDATE_SNAPSHOTS=1` 才刷新；反证：改一个字符即失败。同时把「StatCard 的 `useTween` 在 SSR 下渲染初始值 0」这一事实显式钉住（快照只钉结构，数值由引擎/格式化测试覆盖）。
- `verify-pack` 增加必需文件（csv/query-params/session-files）与 `lib/` 悬空 import 扫描；AGENTS 增加「纯逻辑必须能被单测」「host 纯逻辑必须住在 core」「`lib/core/` 必须是完整副本」三条 tripwire。**未改 `src/core/rollup.js` 的取价/折叠语义，未 bump `CACHE_FORMAT_VERSION`**。

### 脚本债（E1 / E2 / E3 / E4）

- **E1 `scripts/debug-total.js` 只认旧布局**：日志文件名判定改为复用 `src/core/session-files.js` 的 `pickLogFile`（与宿主同源），并跳过 legacy 裸 uuid 目录、支持未压缩的 `session.v<N>.jsonl`、从会话头读真实 `cwd`（目录名只作回退）。**实测差异**：旧脚本在本机 378 个会话里只找到 **323** 个，且「今天 / 24H / 7D」三个窗口的 KPI 交叉校验全是 **0m / 0 会话**——因为它读的是历史镜像 `session.jsonl.zstd`；修好后 378 个会话，今天 21.2h / 24H 24.0h / 7D 138.3h，与引擎 `queryUsage` 一致。
- **E2 `scripts/oneoff/diag-step-fields.mjs` 的无边界循环**：`firstFrame` 现在校验 zstd magic、检查块头与载荷越界、并把块头数封顶（旧实现碰到全 0 块头时 `v & 1` 永不成立而 `p` 一直增长 → 真死循环）；同时导出 `firstFrame`、给主流程加「直接运行才执行」判定与损坏文件的跳过日志。`test/oneoff-diag.test.js` 用真实压缩帧做阳性对照，再以全 0 / 截断 / 载荷越界 / 保留块类型四种损坏输入断言**立即抛错**。**A/B 实测**：新旧脚本在真实会话库上前 30 行输出**逐字相同**（改动只把死循环变成明确报错）。
- **E3 删除 5 个永久失效的 `dark-*.cjs`**（`dark-audit` / `dark-codemod` / `dark-debug` / `dark-dump` / `dark-js`）：目标文件 `src/client.js` 已在 0.3.19 拆成 `src/client/` 模块树，其中两个 codemod 还会**原地改写源码**且不备份，留着只会诱导误用。`scripts/oneoff/README.md` 改为记录删除原因与考古方法（`git show v0.3.19:scripts/oneoff/dark-codemod.cjs`）。
- **E4**（随 B1 完成）：`capture-screenshots.mjs` 头部注释里的「一次性依赖」改为 devDependencies。**未改任何插件运行时代码，未 bump `CACHE_FORMAT_VERSION`。**

### 定价准确性（C1 / C2，审计 F23）

- **C1 缓存读取价：47 行空列 → 30 行补齐、17 行有意留空且**不再静默按 ¥0 计**。空列此前被生成成 `0`，而模型仍算「已匹配」，于是缓存读取按 ¥0 计费、覆盖率仍显示 100%（审计 F23 的静默低估）。本次按厂商逐条核官方出处后填了 30 行：Mistral 全系 10 行（官方 pricing 页 "Cached input" 列，= 10% of input）+ 已下架的 magistral/nemo 3 行（官方全局 10% 规则）、Bedrock Nova 4 行（官方脚注「cache read 比按需输入低 75%」，欧站数值比 0.250 证实）、OpenAI `gpt-5.5-pro`（官方明确「不提供缓存输入折扣」⇒ 按标准输入价）、`gemini-1.5-pro`（归档官方页 25% 规则）、`deepseek-coder`（官方公告 cache hit $0.014/M）、`ernie-4.5-turbo`（千帆「命中缓存」¥0.2/M），以及若干**显式 0**（`gpt-4`/`gpt-3.5-turbo`/`gpt-4-turbo` 无 prompt caching 特性、Phi-4 家族无缓存档、Agnes 免费型号）。逐行依据与出处见 `pricing/PRICING_VERIFICATION_REPORT.md` 第四节。
- **C1「未知」不再等于「¥0」**：生成器新增 `CACHE_PRICE_UNKNOWN`（CSV 第 5 列为空的集合，现将从 47 降到 17），`priceFor`/`priceForAt` 带出 `cacheUnknown`（**计费口径不变，仍是 0**，否则历史费用会跳变），`queryUsage` 只把「本窗口确有缓存 token 且缓存价未知」的模型放进 `meta.pricing.cacheUnknownUsed/cacheUnknownTokens`，客户端新增琥珀徽标「缓存读取价未知，费用可能低估」并在定价弹层里把该列显示成「未知」而不是 ¥0。**开销为 0**（没有缓存 token 就不提示），覆盖率语义不变。
- **C1 有意留空的 17 行**：Cohere 6（官方只列 input/output，但 v2 Chat 会返回 `cached_tokens` ⇒ 无法确认是免费还是按输入价）、sonar 三行、`ling/ring` 三行（只有转售渠道价，且与行内输入价不同源）、`nemotron-3-super-120b`、`inflection-3-pi`、`gpt-5.4-pro`、`o3-pro`、`ernie-5.0`。这些现在会由上述徽标显式提示，而不是假装已匹配且免费。
- **C1 顺带修正**：`agnes-2.5-pro` / `agnes-2.5-pro-alpha` 缓存价 `0.03 → 0.315`（官方 wiki：Pro 档 cached input $0.045/M，原值是它的 1/10）。
- **C2 7 个未定价模型**：补录 3 个第一方可定价的——`spark-x2.5`（讯飞官方 1.6/6/0.24，限时五折）、`Qwen3.6-35B-A3B`（百炼 1.8/10.8/**0**，官方注明不支持上下文缓存）、`Qwen3.8-27B`（百炼 3/12/0.6）；其余 4 个**保持未匹配**并写明原因：`qoder-cn` 是 provider 名（Qoder CN / 通义灵码）漏进 model 字段，**绝不能计价**（已加单测钉死）、`step-explore` 走 Step Plan 额度制无逐 token 价、`kat-coder-pro-v2.5` 只有转售商价、`big-pickle` 是 OpenCode Zen 的匿名免费别名。
- **`CACHE_FORMAT_VERSION` 18 → 19**（定价表变化，磁盘缓存里的成本必须作废重算）。**守卫**：`test/pricing-cache-unknown.test.js`（8 条：未知 vs 显式 0、只在确有缓存 token 时上报、覆盖率不受影响、C1 抽查值、C2 补录与 `qoder-cn` 必须未匹配）+ 两个新渲染快照（徽标 / 弹层里的「未知」）。未改取数或折叠语义，bench 全绿。
- **未改（记入 `docs/remaining-tasks.md` 的 C3）**：Bedrock Nova 的**输入价**与官方表不一致（只有 nova-pro 对齐）；`agnes-3.0-flash` 用 list 价而同表 `agnes-2.5-flash` 用当前价（口径不一致）；`ernie-4.5-turbo` / `gemini-1.5-pro` 的输入价已过期。这些改动会改变历史费用，需要单独决策。

## [0.3.19] - 2026-10-14

> 审计 F16：客户端半边是 **1907 行单文件 + 隐式全局 + 构建期字符串替换**，源码**不是合法 JS**（`node --check src/client.js` 直接报 `Illegal return statement`），因此无法 lint、无法单测，任何改动都只能靠"改完看截图"。本版把它拆成真正的 ESM 模块树，并用 **esbuild** 取代正则改写。**未 bump `CACHE_FORMAT_VERSION`**（没碰取数/折叠语义）。

### 源码：`src/client.js` → `src/client/` 模块树

- `index.js` 入口（`inject: ['slots']` + `apply(ctx)`）、`react.js`（React/h 的唯一来源）、`host.js`（`/dash-api/*` 桥，含 JSON 数组编码）、`plugin.js`（包名 + CSS 标签 id）、`css.js`（样式表 + 幂等注入器）、`theme.js`（常量与文案）、`icons.js`、`format.js`（纯格式化）、`chart-math.js`（热力分档/雷达归一，纯函数）、`hooks.js`、`primitives.js`（Segmented/Dropdown/ModelSelect/FilterBar/Popup/StatCard…）、`prefs.js`、`nav-icon.js`，以及 `cards/` 下的 `trend.js` / `heat.js` / `radar.js` / `cache.js` / `calendar.js` / `records.js` 与 `dashboard.js`。
- **不再有隐式全局**：`React` / `host` 改为显式 `import`；`styles.insert(CSS)` 与 `ctx.interval(...)` 不再是"构建期垫片补出来的东西"，而是 `css.js` 的 `injectStyles()` 与 `dashboard.js` 里的 `setInterval` 真实代码。
- **源码即最终形态**：每个模块都能 `node --check` 通过；纯逻辑模块（format / chart-math / host / css / plugin）与组件都能被直接 import 测试。

### 构建：正则改写 → esbuild

- `scripts/regenerate.cjs` 的客户端段改为 `esbuild.buildSync({ bundle: true, format: 'cjs', external: ['react'] })`，产物套在 DSH 要求的 `window.__ModuleLoader__.load({ id, factory })` 外壳里；`require('react')` 仍由宿主 client runtime 解析。
- 删除的脆弱逻辑：`ctx.interval(...)` 正则替换、`styles.insert(CSS)` 字符串替换、顶层 `return {` → `module.exports = {` 的替换（及其恒真"守卫"，审计 F19）。
- 新增构建期断言：`src/client/plugin.js` 的 `PLUGIN_ID` 必须等于 `package.json` 的 `name`（它决定 CSS 标签 id，漂移会让样式清理失配）。

### 测试：新增 `scripts/client-check.mjs`（109 条断言，接入 `npm test` 与 CI）

1. `src/client/**/*.js` 每个模块 `node --check` 通过；并断言 `src/client.js` 已不存在、模块里不再出现 `ctx.interval(` / `styles.insert(`（注释除外）。
2. 纯模块单测：格式化（`fmtH9` / `fmtCny` / `fmtPct` 符号语义 / `fmtPriceRange` / `dateToMs` 往返）、图表数学（`calLevel` 分档、`heatColor` 边界、`RADAR_BAND` 夹取与 null）、主题常量、`PLUGIN_ID` 与包名一致、CSS 注入器的幂等插入与清理。
3. **host 桥的数组编码单测**（F14 的客户端半边）：`models` / `projects` 必须以 JSON 数组编码，含逗号的项目 id 保持单元素，null 参数被丢弃。
4. **真实 React 渲染**：用 `react-dom/server` 渲染 Dashboard 与全部卡片/原子组件，夹具是引擎产出的真实 `queryUsage` payload（`buckets` / `heat` / `meta.models` / `meta.pricing`）。
5. **构建产物契约**：在模拟 `__ModuleLoader__` + DOM 桩下加载 `lib/client.js`，断言 `inject`/`apply` 导出、`settings.section` slot 注册（id/order）、`apply()` 注入样式，以及缺少 `slots` 服务时不抛错。

### 其他

- 顺带修掉 `RadarCard` / `CacheTrendCard` 里 8 处 `'text-anchor'` / `'dominant-baseline'` 引号属性 → React 官方 camelCase（渲染出的 SVG 属性逐字不变，但不再刷 React 警告）。
- 新增 devDependencies：`esbuild`（构建）、`react-dom`（仅用于组件渲染测试；`react` 本就作为 peer 自动安装）。发布包仍只含 `lib/` 与 bundle patch。
- README/README.en 的"扩展与定制"改为指向 `src/client/dashboard.js` 与 `src/client/cards/`；`scripts/oneoff/README.md` 标注 `dark-*` codemod 的目标文件已不存在。

## [0.3.18] - 2026-10-14

> 承接 0.3.17 之后一轮独立复审（对 0.3.17 工作树只读复核 + 合成数据复现）。本版处理其中**已复现的确定缺陷**，并为每条补上会真正失败的回归守卫。`CACHE_FORMAT_VERSION` 17 → 18（seed 折叠状态入缓存，见下）。

### 导出 CSV 字段合法性（复审新发现，高）

- **问题**：`csvCell` 的公式防护把前导单引号放在 CSV 引号**之外**（`'"{值}"'`）。值本身含逗号时，外层引号不在字段首字节，标准 CSV 解析会把一个字段拆成两列——项目名 `=1,=2` 导出后被解析成 **9 列**（应为 8），且第二段以 `=` 起始。这是格式错误（拆列），公式是否被表格软件执行取决于软件，未做验证。
- **修法**：先给值加前导单引号，再整体加 CSV 引号（`"'=1,=2"`）。
- **守卫**：smoke 新增合成导出用例——含逗号与引号的 `=...` 模型名必须仍是**一个**合法字段、每个字段解析后恰好 8 列、解析结果以字面单引号开头、行数与 `rows` 一致。

### fork-seed 增量折叠与全量折叠不一致（复审新发现，高）

- **问题**：`isSeeded` 前缀在标记到达前被 `flushSeedPending` 当「无标记」全量折叠，标记随后到达也无法撤销已计入的种子 token；跨启动命中磁盘缓存时 seed 状态不落盘（`deserializeRollup` 无条件置 `_seedCut = null`），续算继续分叉。合成复现：完整折叠 10，截断后续算 210。
- **修法**：seed cut 改为**可续算**的 `pending{seq,seen}` 状态——标记出现即**重置**上一个 cut 之后的投机折叠（保留 `id`/`cwd`/`title`/`projectTitle` 元数据），`foldSession` 直接就是「逐条 `foldAppend`」，不再有独立的 park/flush 路径；`seedCut`/`seedSkip`/`seededWithoutMarker` 随 `serializeRollup` 往返。
- **守卫**：bench `[5]` 对 `late`/`twice`/`legacy` 三个夹具**枚举全部截断点**，逐点断言「缓存续算 == 整段折叠」（token 总量、`skippedSeedEvents`、`seededWithoutMarker` 三项）。
- **缓存**：`CACHE_FORMAT_VERSION` 17 → 18——旧缓存缺 seed 状态且可能已计入继承前缀，必须重折。

### DeepSeek 未知型号被前缀正则计价（复审新发现，高）

- **问题**：`resolveDSModel` 用未锚定前缀正则（`^deepseek-flash`、`^deepseek-v4-?pro`），于是 `deepseek-flash-bogus`、`deepseek-v4-prototype` 被按现行峰谷价计费，而 `priceFor` 对它们返回 null——同一 id 两套结论，未匹配模型被虚报为已定价。
- **修法**：归一后（剥 provider 作用域 / 市场后缀 / `-free` / `-latest` / 2–8 位日期后缀）**必须精确命中已知别名集合**（flash：`deepseek-flash`、`deepseek-v4-flash`、`deepseek-v4.1-flash`、`deepseek-v4-flash-vision-exp`；pro：`deepseek-v4-pro`、`deepseek-pro`）。
- **守卫**：bench `[4]` 反向断言 4 个未知 `deepseek-*` 名字在 `resolveDSModel` / `priceForAt` / `priceFor` 三处一致地「未匹配」。

### 窗口下边界的活跃时长（复审新发现，中）

- **问题**：`computeRollupActiveMs` 用 `hk + HOUR <= lo` 跳过桶，而 generation 事件挂在**开始**小时。生成跨过窗口下界时整条区间被跳过（后面的交集裁剪根本没机会执行）：合成 20s 生成跨小时、窗口从跨小时后 10s 开始，应计 5000ms，实测 0。
- **修法**：多回看一个桶（`hk + 2 * HOUR <= lo`）。记录到的生成区间只有分钟级，一小时回看足够。
- **守卫**：bench 新增 `[0n]`。

### 边缘窗口的幽灵模型行（复审新发现，低-中）

- **问题**：无 `usage` 的 `assistant/message` 其 evts 用 `fill(0)` 初始化，型号位留 0，而边缘累加只判 `!== null` → 边缘窗口出现 `id=0` 的幽灵模型行（非边缘的聚合路径没有）。
- **修法**：该分支显式写 `evt[EVT_IDX_MODEL] = null`。
- **守卫**：bench `[0n]` 断言边缘 usage/detail 里没有 `0`/`''` 型号行。

### 会话全库清空不清理 state（复审新发现，中）

- **问题**：`refreshCorpus` 在会话列表为空时提前 return，跳过删除循环——最后一个会话被删除后，usage/detail/calendar/export 继续返回旧 rollup，直到出现非空列表或重启。合成复现：列表 1 → 空 → 仍报 1。
- **修法**：区分「**权威地空**」与「**列不出来**」。任一来源真的回答了列表（含空数组）→ 继续走删除循环；来源完全无法运行（无 store、无 query 服务、读取抛错）→ 仍然提前返回，绝不把读取失败当成「全删了」。
- **守卫**：smoke 新增独立 host 实例：列表清空 + 触发 reconcile + 跨过 2× 宽限期，断言 `sessions === 0`。

### 会话读取失败预算未按「连续」计算（复审新发现，中）

- **问题**：`failCount` 只增不减，成功读取后不重置。三次**相隔很久**的瞬时 I/O 故障（中间都成功恢复）也会耗尽 3 次预算，会话永久不再重试。
- **修法**：成功读取（缓存命中 / 空日志 / 正常折叠三条路径）重置 `failCount` 与 `lastError`；预算语义变为「连续失败 3 次」。
- **守卫**：smoke 用真实临时会话库跑 `fail → ok → fail → ok → fail`，断言最后一次失败后 `sessionHealth.retryPending === 1`（未重置时会退化成 0）。反向验证：把重置改回 no-op 后该断言确实失败。

### usage 缓存 key 无界（复审新发现，低-中）

- **问题**：usage 路由把**任意** URL 参数 `...input` 展开进缓存 key，`?junk=1`、`?junk=2`… 可以凭空制造无数缓存条目，每条都付一次全库走查，而查询结果完全相同。
- **修法**：key 只由 `queryUsage` 真正读取的参数构成（`range`/`from`/`to`/`models`/`projects`/`now`）。
- **守卫**：smoke 断言 host bundle 里不再出现 `...input`；同时把 smoke 里原本靠未知参数做「换 key」的用例改为变化真实的 `to`（旧写法正是这个无界 key 空间的副产品）。

### 构建：legacy USD CSV 回退漏乘 7（复审新发现，高-条件性）

- **问题**：扩展 CNY CSV 缺失时回退到 `vibe-usage-model-pricing.csv`（USD/M），日志写着「USD × 7」，但解析函数不做换算 → 回退构建会把所有历史价格缩到 **1/7**，且没有任何报错。当前扩展 CSV 存在，正常构建不受影响。
- **修法**：`parsePricingCsv(text, multiplier)` 显式接收倍率，回退分支传 7；新增构建期自检（`$1.25 → ¥8.75`，CNY 路径不得被缩放），倍率写错即构建失败。

### 构建：空缓存价可见化（审计 F23）

- 47/292 行「缓存读取」列为空 → 生成 0，但该模型仍算「已匹配」，覆盖率不下降、缓存成本静默低估。构建脚本现在**统计并打印**这些行（不失败：部分模型确实没有独立缓存价，需人工核价）。

### 其他

- `export` 在整库聚合**之前**也 `await` 一次让出事件循环（此前只在聚合之后）；聚合与 CSV 字符串构建本身仍是同步的。
- 旧版创建的缓存目录/临时文件权限在升级后显式收紧（`chmod 0700` 于目录、写入前删除可能残留的 `.tmp`）。
- 文档：README/README.en 版本号 0.3.16 → **0.3.18**（此前落后于 `package.json`）。

### 未改（说明理由）

- **F11**（`_seenUsage` 无界增长 / 签名合并缺失与显式 0）：继续拒绝其两条子建议，理由同 0.3.17——会直接破坏重放去重与成本准确性。
- **F14 的「30s 轮询带动三路请求」**：`refreshSeq` 仍会让日历与明细卡随轮询刷新。服务端三端点都有 30s TTL + SWR，本地请求成本极低，而让卡片在长会话中保持新鲜是有意行为，故不改。
- **F16 / F21 / F23 逐行核价 / F26 / F32**：仍是独立任务（`client.js` 拆模块与打包器、截图匿名化重拍、47 行逐型号核价、一次性脚本、单元测试框架）。
- **`Date.UTC` 0–99 年映射**：仍按 tripwire 记录，不改分桶数学。

## [0.3.17] - 2026-10-13

> 承接 0.3.16 的「已知遗留」，处理审计报告中仍未修复的**代码级**发现。F11（`_seenUsage` 淘汰）继续拒绝，F16（client.js 拆模块）与 F21（截图匿名化重拍）属独立任务，未动。

### 项目筛选逗号协议（审计 F14）

- **问题**：`projects` 的值是项目 id，即会话 cwd——Windows 路径**可以含逗号**。构建垫片把数组参数写成 `v.join(",")`，服务端再 `v.split(",")`，于是单个项目 `D:/a,b` 到达时被拆成两个不存在的项目，筛选**静默**变成空结果（不报错、不提示）。
- **修法**：线上编码改为 JSON 数组（垫片 `JSON.stringify(v)`），服务端 `parseListParam` 先按 JSON 解析、失败再退回逗号拼接——**旧链接/书签继续可用**。`models` 与 `projects` 共用该协议。
- 顺带修掉同类的一处键碰撞：客户端内容区淡入过渡的 key 由 `join(",")` 改为 `JSON.stringify`（`['a,b']` 与 `['a','b']` 此前撞成同一个键，切换筛选时漏掉淡入）。
- 守卫：smoke 新增三条断言——JSON 数组确实被解码（真项目 + 未知项目 → 只匹配 1 个）、含逗号的单个 id 不被拆、逗号旧格式仍拆；并直接断言 `lib/client.js` 里数组分支是 `JSON.stringify` 而非 `join(",")`（两半必须同编码，只测服务端测不出来）。

### single-flight 版本戳（审计 F7）

- **问题**：计算完成时用**写入时刻**的 `dataVersion` 给缓存条目盖戳，而不是本次计算**启动时**的版本。并发/乱序结算下（A 在版本 V 启动、B 在 V+1 启动），A 后完成会用陈旧结果覆盖 B 的新结果，却被标记为当前版本 → 快速路径据此判定「新鲜」，整个 TTL 内既不重算也不触发 SWR。
- **修法**：戳记改用启动版本，且只在「不比现有条目更旧」时才落盘（`prev.version <= version`）。SWR 的性能修复保持不变——结果**照写**，只是不再谎报新鲜度。
- 守卫：smoke 用**第二个独立 host 实例**复现（该竞态需要一次能被挂起的计算，只在冷启动首次请求时出现）。先让计算停在 `listSessions()` 里、期间投递一个 metric 事件，再断言下一次请求**必须**走 SWR；时钟取 +25 s，让快照窗口（5 s）与列表节流（20 s）都过期、但条目仍在 30 s TTL 内，从而只有版本能决定走哪条路。

### `num()` / `bucketSeries` 契约（审计 F29）

- `num()` 的行为**不变**（正有限数原样返回；0 / 负数 / NaN / ±Infinity / 字符串 / null / undefined / 对象一律 0），但把这条隐式契约写成注释并在 bench `[0m]` 用 12 个用例钉住，免得日后被当成 bug「修」成放行负值。负数归 0 是刻意的：损坏日志里的负 token 不能污染总量与成本。
- **HTTP 契约**：`bucketSeries` 超出桶上限时抛 `RangeError`，此前路由一律回 500，把可由 URL 触发的**输入**问题报成服务端故障。改为 `RangeError → 400 {"error":"bad_request", message}`（message 由仓库常量拼成、不含调用方输入，可安全回显）；其余异常仍是 500 且不回显细节。
- 守卫：bench `[0m]` 断言超限必抛 `RangeError` **且**上限内必须正常返回（反向断言，防「总是抛」）；smoke 断言超宽 custom 窗口回 400、普通 custom 窗口仍回 200。

### 死代码（审计 F25）

- 删除 `LONG_CONTEXT_MODELS`：全仓只有定义、从未被引用。其说明改写成一段散文——**阶梯计价当前未实现**，且无法在现有事件结构上实现（事件带不出 prompt 长度分布），要接入必须先在折叠阶段记录 usage 级长度分档。留一个死常量比留一段说明更糟：它会让人误以为阶梯计价已经生效。

### 不需要 bump `CACHE_FORMAT_VERSION`

本版未触及取价与折叠语义（`num()` 行为不变、删死代码、HTTP 层错误码、请求级内存缓存的戳记）——磁盘缓存里的 rollup 与成本数值完全不受影响，因此**保持 v17**，不触发全量重算。

### 未修复（本版之外）

- **F11**（`_seenUsage` 无界增长）：继续**拒绝**其两条子建议——按时间窗淘汰签名会破坏重放去重；签名区分「字段缺失 vs 显式 0」会改变已持久化缓存的签名语义。两者都直接损伤成本准确性。仅保留注释说明。
- **F16**（client.js 拆模块 + 标准打包器）、**F21**（截图含真实项目名，需匿名数据重拍 6 张）：独立任务，未动。
- **F23**（45 行空缓存价）：其中一部分模型本就没有独立缓存读取价，不逐行补；真正该补的是 OpenAI / DeepSeek / Amazon / Mistral 等系中厂商明确公布缓存价的行，属独立核价任务。
- **F26 / F32 的部分项**：`diag-step-fields` 的死循环风险仍是「隔离到 `scripts/oneoff/`」而非修复；CI / bench / smoke 断言已加，但未引入单元测试框架。
- **新发现（本次修复过程中暴露，未改）**：`bjDayStart` / `mondayOf` / `hourOf` 用 `Date.UTC(year, …)` 构造时间戳，而 `Date.UTC` 把 0–99 年映射成 1900+年——因此「公元 1 年 → 现在」的 custom 窗口会被静默截成 1901 年起、只有 6563 个周桶（本应触发 50000 桶上限）。真实数据都在 1970 年之后，影响仅限手工构造的极端 URL，且改动面是核心分桶数学，故本次只记录不改。

## [0.3.16] - 2026-10-13

> 起因：与 [`token-monitor`](https://github.com/Javis603/token-monitor)（计价内核 tokscale）做了一次模型/定价对比（对比报告为本地文件，未纳入仓库），并据此核对了本机真实用量。**结论：报告列出的 76 个"补录候选"确实全部不在表里，但它漏掉了一个更直接的问题——本机实际用过的 55 个模型里有 24 个取不到价、成本被记成 ¥0。**

### 取价归一（`CACHE_FORMAT_VERSION` 13 → 14）

- **provider 作用域与市场后缀**：事件里的 model id 会带 `global:` / `cn:` 前缀或 `provider/model` 形态，也会带 `-sg` 这类市场后缀。此前 `priceFor` 只做「精确 → 剥 `-free` → 剥日期后缀」，这些 id 全部落空为 ¥0。新增 `modelIdCandidates`：按优先级产出候选名（原样 → 剥 provider 作用域 → 剥市场后缀白名单），`priceFor` 与 `resolveDSModel` 共用。
  - 本机实测恢复：`global:deepseek-v4.1-flash`（550 次）、`global:deepseek-v4.1-flash-sg`（19 次）、`global:gpt-6-luna`（2 次）。
- **绝不猜测**：每个候选剥出的名字必须**精确命中**价目表才计价；命中不了仍是未匹配（显示徽标），与既有日期后缀兜底同一纪律。
- **市场后缀走白名单**（`-sg` / `-cn` / `-us` / `-eu` / `-jp` / `-hk` / `-tw` / `-kr` / `-global` / `-intl` / `-oversea`），**不是**通用剥后缀——`-pro` / `-lite` / `-plus` / `-luna` 是模型名本身，通用剥会让 `gpt-5-pro` 被错按 `gpt-5`（¥8.75/¥70）计价。bench `[0l]` 用反向断言锁住这一点。
- `-free` 的语义保持既有口径：剥掉后按**基座**模型计价（因此免费模型要把基座登记为 0,0,0）。

### 定价表补录（`CACHE_FORMAT_VERSION` 14 → 17，280 → 292 行）

- 新增 5 个收费模型（USD 源按仓库惯例 × 7 写入 ¥/M）：
  - `hy4-preview`（Tencent，0.834/2.501/0.042 USD）
  - `step-5-preview`（StepFun，1.00/2.70/0.05 USD）
  - `kimi-k2.8-preview`（Moonshot AI，6.5/27/1.7 CNY）
  - `agnes-3.0-flash`（Sapiens AI，0.35/1/0.035 CNY）
  - `sakana-namazu`（Sakana，¥6.65/28/1.05；上游四源一致 0.95/4/0.15 USD × 7）
- 新增 1 个**收费基座**：`space-bunny` = ¥1.05/4.2/0.21（上游 `opencode-go` 0.15/0.6/0.03 USD × 7）。它是 `-free` 通道的基座，因此本机 3312 次 `space-bunny-free` 调用按此计费——**90 天窗口费用 ¥2092.22 → ¥2186.66（+¥94.44）**。
- 新增 7 个免费基座（0,0,0）：`nemotron-3.5-lightning`、`ling-3.1-flash`、`sensenova-6.7-flash-lite`、`sensenova-6.8-flash-lite`、`laguna-s-2.1`、`x-preview-f`。
- **实测效果**：以上模型在补录前全部计 ¥0。逐模型金额（在缓存完整重建后测得的一次快照）：`cn:step-5-preview` ¥268.72、`cn:hy4-preview` ¥189.38、`hy4-preview` ¥103.58、`kimi-k2.8-preview` ¥79.77、`step-5-preview-free` ¥25.36、`agnes-3.0-flash` ¥0.13，归一修复 ¥4.49（合计 ¥671.44）；`space-bunny-free` 追加 ¥94.13。定价覆盖率 98%。
  > 注：逐模型金额会随会话持续流入而增长，且缓存重建期间读数不稳定；上面这组取自一次完整快照，`space-bunny-free` 的 +¥94.44 取自端点前后差值。
- `step-5-preview` 的三数顺序由上游目录裁决：models.dev 的 6 个 provider 一致给出 input 1 / output 2.7 / cache_read 0.05，即"输入 / 缓存命中 / 输出"顺序。

### 已知遗留

- **仍有 7 个模型未定价**（`step-explore`、`kat-coder-pro-v2.5`、`spark-x2.5`、`big-pickle`、`Qwen3.6-35B-A3B`、`Qwen3.8-27B`、`qoder-cn`）。前三个三份上游目录均无；`Qwen3.6-35B-A3B` / `Qwen3.8-27B` 各转售商价差达 5 倍，不宜拍板；`qoder-cn` 疑似 provider 名漏进 model 字段，**不**计价。这些模型确实没有可用价格，保持未匹配（看板显示未匹配徽标、成本记 0）。
- **45 行空缓存价不等于 45 个错误**：其中一部分模型本来就没有独立的缓存读取价（上游目录里 `cache_read` 缺项或与输入同价），因此**不逐行补**。真正需要补的是那些厂商明确公布了缓存价的行（OpenAI / DeepSeek / Amazon / Mistral 等系），属独立的核价任务。
- **`-free` 一律按基座计价**（已确认口径）：基座收费则计费（`space-bunny`、`step-5-preview`），基座免费则记 0（`ling-3.1-flash` 等）。上游目录里 `-free` 通道本身标 0，但本仓库按基座口径计——这是刻意选择，不是漏算。
- 审计报告（`.audit/`）中仍未处理的项：F23（45 行空缓存价，见上）、F14（项目筛选逗号协议）、F7（single-flight 版本竞态）、F25/F29、F16/F21。

## [0.3.15] - 2026-10-13

> 本版基于一次全仓审计（`.audit/`，P1×4 / P2×22 / P3×8，无 P0）。下面按「隐私与安全 → 正确性 → 工程」列。

### 隐私 / 安全

- **从全部 git 历史移除 `unreadable-sessions-report.md`**：该文件曾包含 **321 个真实会话 UUID** 与本机项目路径，虽然早已从工作树删除，但作为 `main` 的祖先提交永久留在公开仓库里（任何人 clone 都能 `git show` 取回）。已用 `git filter-repo --invert-paths` 重写全部历史并强制推送 `main` 与 `v0.3.11`~`v0.3.13` tag。**重写前后 `HEAD^{tree}` 哈希逐字节一致**——只动历史，不动任何文件内容。
  - 注意：GitHub 侧不可达对象会保留一段时间，**已有 fork/clone 仍持有旧历史**；彻底清除需联系 GitHub Support 并通知协作者重新克隆。
- **堵住产生机制**：`scripts/scan-unreadable.cjs` 的报告改写到 `~/.dsh/usage-dashboard-reports/`，写入前断言输出不在仓库内；`.gitignore` 新增 `.audit/`、`/audit-*.md`、`/*-report.md`、`/unreadable-sessions-report.md` 以及通用凭据模式（`.env*`、`*.pem`、`*.key`、`*credentials*` 等）。CI 增加一道护栏，拒绝跟踪含真实会话数据的诊断报告。
- **`/dash-api/*` 默认只服务 loopback 调用方**（F1）：插件把自己的 HTTP 端点注册进宿主 webserver，却无法假设宿主的绑定配置——宿主一旦以 `0.0.0.0` 启动，同网段任意主机即可无凭据读取全库用量、项目 cwd 与 token。现在按 `remoteAddress` 判定（IPv4 / IPv6 / IPv4-mapped-IPv6 / 整个 `127.0.0.0/8`），非 loopback 返回 403；逃生阀为插件配置 `allowNonLoopback: true`。`dsh-mobile` 网关从 `127.0.0.1` 反代，**本机手机访问不受影响**。
- **去掉硬编码本机路径**：`scan-unreadable.cjs` 的 v0→v1 迁移器路径改为 `DSH_V0_MIGRATOR` 环境变量或模块解析自动探测（此前在其他机器上必然崩溃）；LICENSE 版权人占位 `[linxin666]` → `skkjkk`。
- **纵深防御**：磁盘缓存目录 `0o700` / 文件 `0o600`（内容含 cwd、项目标题、会话 id、逐时用量）；缓存文件名按会话 id 白名单校验 + 目录内断言。

### 正确性

- **磁盘缓存折叠状态往返**（F5，`CACHE_FORMAT_VERSION` **12 → 13**）：`_openSteps` / `_lastClosed` / `_lastMsgT` / `_lastUserT` 此前不落盘，于是「日志被崩溃截断在某个 generation 中间 → 跨启动命中磁盘缓存 → 之后才收到闭合事件」这条路径上 `closeStep` 会因找不到 step 直接返回 0，**静默丢掉该 generation 的 activeMs 与延迟样本**。`generation` 内的 `bucketEvts` 是活引用，序列化只存 `(t, hk, evtIdx)`，反序列化时重新绑回桶数组。
- **`serializeRollup` / `deserializeRollup` 下沉到引擎**（纯数据变换，无 IO/ctx），使 bench 能对磁盘缓存往返做真实断言——此前 `bench [7]` 标题写了「序列化往返」却没有任何断言，这正是 F5 长期不可见的原因。
- **缓存 key 加路由前缀**（F6）：三个端点此前都用裸 `JSON.stringify(normalized)`，构造同形参数即可让 `usage` / `detail` / `calendar` 互相命中并返回错误结构。
- **`export` 不再 O(页数 × 库大小)**（F2）：旧实现每 200 行重跑一次全库聚合，且循环内无 `await`，可被并发请求放大为宿主事件循环阻塞。引擎新增纯函数 `queryDetailAll`（一次聚合取全），导出侧加跨 key 串行闸并让出事件循环。
- **`export` 容错**（F9）：一条非有限时间戳不再让整次导出 500，改为跳过该行并在响应里报告 `skipped` 计数。
- **CSV 公式注入**（F28）：`csvCell` 先剥掉前导空白/控制字符再判断，`" =cmd|..."` 不再绕过。
- **会话读取失败可见化 + 退避复活**（F8）：一次瞬时 I/O 错误（文件被占用、网络盘抖动）此前会让会话从看板**永久消失且无任何提示**。现在记录 `failCount` / `lastError`，reconcile 按 2^n 退避复活（上限 3 次后保持永久跳过，避免回到「每个周期对同一份坏日志重付一次完整解码」的死亡风暴），并通过 `meta.sessionHealth` 暴露给前端。

### 前端

- **「统计中」不再永久卡住**（F12）：busy 只由最新一次请求收尾。旧实现里被 silent 轮询顶掉的非 silent 请求会提前 return，`setBusy(false)` 永不执行。
- **错误不再静默**（F13）：4 处 `catch` 保留错误对象并 `console.warn`；热力图区分「加载失败 + 重试」与「加载中」。
- **未匹配定价徽标点击真正打开定价弹层**（F15）：此前只命中费用卡片的 `onClick`，即误切 ¥/$。
- **`inject` 去掉从未使用的 `timer`**（F17）：缺 `timer` 插件的宿主会让看板整块不挂载，而代码只用构建期垫片化的 `ctx.interval`。
- **分页收敛与键盘语义**（F30）：刷新后 total 变小不再显示「41-30 条，共 30 条」并停在空页；卡片上的 Enter/Space 不再同时触发「切换单位」与「打开弹层」；卸载清理淡入定时器。

### 构建 / 发布

- **新增 CI**（`.github/workflows/ci.yml`）：`npm ci` → build → 生成物漂移检查（`lib/`、`src/core/pricing.js`、`package.json` 必须无 diff）→ bench → smoke → verify-pack → 隐私文件护栏。
- **`package-lock.json` 重新生成**：0.3.9 → 0.3.15，全部 `resolved` 从 `registry.npmmirror.com` 改为官方 `registry.npmjs.org`（新增项目级 `.npmrc` 钉住 registry，不含凭据）；`playwright` 归入 devDependencies；peer 集合与 `package.json` 对齐。`npm ci` 实测通过。
- **`prepublishOnly` 增补 verify-pack**；`verify-pack.mjs` 支持无参运行（缺省校验仓库根目录）、跳过 `node_modules` 等目录，`new Function` → `vm.Script`（只编译不执行）。
- **`exports` 去掉误导性子路径**：`./usage` / `./detail` / `./calendar` 曾指向 host bundle，但那些能力是 HTTP 路由而非模块导出，已移除。
- **构建守卫改为语义检查**（F18/F19）：新增 `assertNoDroppedModuleDeclarations`——不看命名风格，只要「在 `apply()` 之前声明、又在 `apply()` 体内被引用」就构建失败（旧守卫只覆盖全大写且 ≥3 字符，`const helper = ...` 会静默漏检）；`coreImports` 去掉已漏过 `pruneRollup` 的硬编码兜底，改为失配即失败 + 与引擎实际导出交叉校验；客户端转换的裸 `'return {'` 子串替换改为行首锚点 `/^return \{\s*$/m`（旧兜底会命中任意嵌套函数里的第一个 `return {`，且其守卫条件恒真）。三处均做了反向验证。
- **测试收紧**：bench 热力图容差按序列收紧（旧值 `0.5` 在相对容差语义下等于「允许 50% 偏差」，足以掩盖定价回归）；8 个零引用一次性脚本移入 `scripts/oneoff/` 并加警告 README（其中 `dark-codemod.cjs` 会原地改写 `src/client.js`）。

### 文档

- 版本号、KPI 卡片数（9 → **10**）、预热延迟（~500ms → **150ms**）、`/dash-api/*` 路由数（3 → **4**，补录 `export` 与「默认仅 loopback」说明）与实现对齐。
- 补上缺失的 `[0.3.11]` 变更段落。

### 未采纳（附理由）

- **F11 的两条子建议**：①「`_seenUsage` 按时间窗淘汰」——淘汰后重放的旧记录会再次计入；②「签名区分字段缺失与显式 0」——重放副本（字段缺失）与原记录（显式 0）会因签名不同而双计。两者都会直接破坏成本准确性，而收益只是几 MB 内存/磁盘，故拒绝。签名保持完整拼接串。
- **F16（`src/client.js` 拆模块 + 标准打包器）**：属数天的战略性重构，会重写整个构建链与 1800 行单文件，风险与收益比不适合与本次修复同批进行。
- **F21（截图含真实项目名）**：需以匿名化数据重拍 6 张 README 截图，属独立任务。

## [0.3.14] - 2026-09-30

### 定价表

- **补录 Claude / GPT / MiMo 近期新发布型号，修正过期价**——`pricing/vibe-usage-model-pricing-extended.csv` 模型数 246 → **280**。全部按厂商官方页面取价：Anthropic / OpenAI 为 USD 官方价 × 7 写入（表内单价仍为 ¥/M tokens），小米 MiMo 直接用官方人民币价（不做汇率折算）。
  - **Anthropic 新增**：`claude-opus-5-5` / `claude-sonnet-5-5` / `claude-mythos-5-1`（官方 API id 为连字符形态，同时补点号别名 `claude-opus-5.5` / `claude-sonnet-5.5` / `claude-mythos-5.1` 与既有的 `claude-fable-5.1` 双写并存）、`claude-opus-5-5-fast`（Fast mode 2× 标准价）、`claude-fable-5-1`。
  - **OpenAI 新增**：`gpt-6-sol` / `gpt-6.1-sol` / `gpt-6-luna` 及其 `-batch` / `-fast` / `-flex` 变体（batch、flex = 50%，fast = 2×；注意 gpt-6-sol 的 cache hit 为输入的 10%（¥1.4），与 6.1-sol 的 5%（¥0.7）不同），`gpt-6-astra-batch` / `-fast` / `-flex` / `-ultrafast`（astra 基线价原已在表内），以及 `chat-latest`。
  - **OpenAI 修正**：`gpt-5.6-sol` 35/210/3.5 → **28/140/2.8**（官方促销价 $4/$20/cache hit $0.40，至少有效至 2026-11-21），`-batch`/`-flex` 与 `-fast` 随之联动修正；`gpt-5.6-terra-batch`/`-flex` 8.75/52.5/0.875 → **7/42/0.7**、`-fast` → **28/168/2.8**（官方全表 batch=50%、fast=2×）。
  - **Xiaomi 新增**：MiMo-V2.6 三型 `mimo-v2.6-pro`（3/6，命中 0.025）、`mimo-v2.6-flash`（1/2，命中 0.02）、`mimo-v2.6-pro-ultraspeed`（30/60，命中 0.25）及官方 Batch 价 `mimo-v2.6-pro-batch` / `mimo-v2.6-flash-batch`。`mimo-v2.5*` 系列官方将于 2026-10-21 10:00（GMT+8）弃用，按既有策略保留原行、历史事件继续按发售时价计。
  - 取价口径：第 3 列只填 **cache 读取（hit）** 价——缓存写入按基础输入价计费（`src/core/rollup.js` 的 `costCache = (cr*p[2] + cw*p[0])/1e6`）。长上下文阶梯价与 `inference_geo` 加成不建模（事件里没有上下文长度信息）。
  - **xAI 补录**：`grok-4-fast-reasoning` / `grok-4-fast-non-reasoning`（发售时价 $0.20/$0.50、cached $0.05 → ¥1.4/¥3.5/¥0.35；xAI 目录已将其下架，按「旧型号用发售时原始价」策略保留）、`grok-4.20`（官方别名规则 `<modelname>` → 最新稳定版，与在册 `grok-4.20-0309-*` 同价 ¥8.75/¥17.5/¥1.4）。
  - **Moonshot 修正**：`kimi-k3` 缓存命中 ¥5 → **¥2**（[官方定价](https://platform.kimi.com/docs/pricing/chat)：输入未命中 ¥20 / 输出 ¥100 / 缓存命中 ¥2.00；缓存写入 ¥20/5min、¥40/1h 为单独计费维度，不在建模范围）。`scripts/bench.js` `[0k]` 的 Kimi-K3 回归价同步为 [20,100,2]。
- **未收录**（口径不同或本机不可能出现）：OpenAI 多模态/worker 类（`gpt-image-2.5-*`、`gpt-realtime-2.1`、`gpt-live-1`、按分钟计费的转写）、`gpt-rosalind-research`（受限研究，2026-10-05 起计费）。未匹配模型依旧不计费并在 UI 显示未匹配徽标。
- **真实性核验**：官方文档页默认把大部分行折叠在 "All models" 之后（URL 追加 `.md` 才能拿到未折叠的完整定价表）——初次核验据此误判 `gpt-6-sol` 为博客推导名而删除其 4 行，二次核验用官方模型详情页（`/api/docs/models/gpt-6-sol`，Snapshots 原文 "Use `gpt-6-sol` in your API requests."）与发布博客（"In the OpenAI API, they are available as `gpt-6-sol` and `gpt-6-luna`."）确认其为**真实在册 API 模型**（初代 Sol，与新版 `gpt-6.1-sol` 并存），已恢复并改用它自己的官方 cache-hit 价（10%）。目录槽位与旗舰折叠表省略 ≠ 模型不存在。其余全部新增行同样经详情页/全表逐一确认为官方在册模型；Claude 点号别名（`claude-opus-5.5` 等）指向真实存在的模型，属防御性双写（沿用表内既有惯例）。

### 缓存

- `CACHE_FORMAT_VERSION` **9 → 10 → 11 → 12**：v10 = 新模型补录与 gpt-5.6-sol 促销价修正；v11 = 恢复被误删的 `gpt-6-sol`（含其 10% cache-hit 价）+ `gpt-5.6-terra` 变体价修正；v12 = xAI grok 补录 + `kimi-k3` 缓存命中价修正。取价变化会影响已缓存会话的成本，旧缓存整批作废重算。

## [0.3.13] - 2026-09-29

### 正确性 / 缓存 / 导出

- **fork-seed 切断**：fork 子会话日志的父前缀不再重复计费。
- **usage 重放去重**：持久层重放已 flush 的 assistant 消息不再双计 token 与成本。
- **移除 presentMs（在场时长）**：与 totalMs 高度重复（v0.3.12 新增、本版删除）；`CACHE_FORMAT_VERSION` 8 → 9。
- **pruneRollup + flushCache 集成**：90 天前的桶丢弃 tool/step/generation 明细。
- **磁盘缓存孤儿清理**：reconcile 周期清理已删除会话与旧版本残留的 `.json`。
- **日期后缀取价兜底**：`gemini-3-pro-002`、`Qwen3.8-Flash-20260101` 等 2–8 位纯数字后缀剥离后命中基础型号；命中不了仍是未匹配（绝不猜测）。
- **未匹配模型提醒**：coverage < 100% 时过滤栏下方出现琥珀色徽标，列出未匹配模型。
- **CSV 导出**：`/dash-api/export` 全量分页导出（含公式注入防护），详细记录卡提供「导出 CSV」按钮。
- **prepublishOnly → npm run test**：发版前置门禁（build + bench + smoke）。
- **DSH 0.2.0-rc.1 适配**（元数据级）：逐符号验证零签名变化，`dsh.client.inject` 增补 `dsh-client-modules`，peer 范围改 `>=0.1.0-rc.6 <0.3.0`（详见 COMPAT.md）。

## [0.3.12] - 2026-09-29

### 兼容

- **适配 DSH `0.2.0-rc.1`（桌面端）**：对 0.1.7-rc.2 → 0.2.0-rc.1 的 npm 包源码与 0.2.0 桌面 `app.asar` 内实际打包的 289 个 `@deepseek-ai` 包做逐个符号核对——插件依赖的全部 API（`requireStoredLog`、`snapshotEvents`、`session/event` 发射签名、`listSessions`/`readSession`、`delegationDepth`/`parentSession`、`webServer.register`、`workspaceRegistry`、`slots.inject('settings.section')`、`session-<id>` 磁盘布局与 `session.v\d+` 日志命名）**零签名变化、零删除**；0.2.0 新增的事件词汇（`team/*`、`tool/ptc-dispatch*`、`schedule/change` 等）全部落入 `foldAppend` 的 default 忽略分支。引擎与宿主胶水**无需改动**，实际适配动作为元数据级：
  - `dsh.client.inject` 补 `@deepseek-ai/dsh-client-modules`：0.2.0 桌面 bundle 中 `dsh-client-runtime` 已退役（ABSENT），浏览器模块系统由 `dsh-client-modules` 承担（0.1.3 起随主线发布）。两个名字并存：inject 引用图中不存在的包会被 `arriveGraphRow` 静默跳过，旧 DSH 命中 runtime、新 DSH 命中 modules，一份包通吃 0.1.3 → 0.2.x。
  - `peerDependencies` 范围从 `^0.1.0-rc.6`（按 semver 预发布规则实际不匹配 0.1.6/0.1.7/0.2.x）修正为 `>=0.1.0-rc.6 <0.3.0`，并移除已停更的 `dsh-client-runtime` 声明。
  - `src/client.js` 的 `slots.register({` 改为同行书写：super-injector 的注入前预检按 `register\(\{…name:'slot'` 正则匹配合法 slot 名，此前换行排版被误判为「坏骨架」而拒绝注入。
  - `COMPAT.md` 全量重写为 0.2.0-rc.1 验证档案（新旧双版本 grep 计数与行号对照）；README 系统要求更新为「已在 0.2.0-rc.1 上验证」。
- 发版验证记录：`npm test`（build 常量守卫 + bench 引擎一致性 + smoke 缓存/SWR/路由/slot 契约）全绿；v0.3.12 功能项见下方。

### 修复

- **provider 目录原样大小写的模型名静默漏计为 ¥0**（用户反馈「Qwen3.8-Flash 的计费并没有执行」）：根因是 `priceFor`/`priceForAt` 只做**精确匹配**，而 CSV 规范名全为小写（`qwen3.8-flash`），事件里的 model id 却来自 provider 目录、大小写不受约束——qoder provider 报的是 `Qwen3.8-Flash`（另有 `MiniMax-M3`）。这类 id 在定价表里明明有价，却走进「未匹配 → 不计费」分支，费用恒为 ¥0，且因为聚合值是 0 而不是 null，**没有任何告警**，只表现为模型分布里多出一行 ¥0。
  - 实测全量日志：`Qwen3.8-Flash` 659 次调用 / 1.02 亿 tokens 被计 ¥0（按 qwen3.8-flash 价目应为 **¥15.66**），`MiniMax-M3` 4 次调用漏计 ¥0.24；定价覆盖率因此卡在 85%。
  - 修复：`priceFor` 在精确匹配后增加**大小写不敏感兜底索引**（`PRICES_LC`/`VENDORS_LC`），`-free` 后缀剥离同步改为不区分大小写；厂商分组（`queryUsage` 的 `vendors`）走同一套兜底，`Qwen3.8-Flash` 现在正确归到 Alibaba 而非「其他」。
  - 兜底索引构建时对**歧义小写形式做剔除**（同一小写对应多个规范名则不进索引，精确名仍可命中），避免把不同型号的价格张冠李戴；`tableKey` 对非字符串 id 先 `String()` 归一（旧日志/测试注入的数字或对象键此前会让 `toLowerCase` 抛 `TypeError`，bench `[0d]` 抓到）；原型键（`toString`/`__proto__` 等）不因兜底而泄漏成「已定价」。
  - **`CACHE_FORMAT_VERSION` 6 → 7**：费用是折叠时烘进 rollup 的，磁盘缓存里已固化的 ¥0 必须随版本失效重算，否则旧会话即使代码修好也仍显示 ¥0。
  - 实测修复后：全量覆盖率 85% → 88%（剩余未匹配项均为 CSV 中确实没有价目的模型，如 `sensenova-6.8-flash-lite`、`step-explore`、`kat-coder-pro-v2.5`），`Qwen3.8-Flash` 计得 ¥15.66。bench 新增 `[0k]` 段做永久回归守卫（8 个 provider 大小写变体 + 原型键 + `-free` 后缀 + 折叠/增量折叠一致性 + 厂商分组）。

- **深色模式下雷达图轴线不可见、缓存卡出现纯白块**（用户截图反馈）：两处根因，均经截图像素采样（Pillow 取色 + WCAG 相对亮度）定量确认，并用无头 Chromium 真实渲染做 A/B 对照。
  - **雷达图六轴与环线隐没**：环线与轴线复用了 UI 边框 token（`--dd-border2/3`），深色值 `#282c33`/`#3a4150` 相对卡片面色 `#1d2025` 的对比度只有 **1.17 / 1.60**（浅色模式对应 `#e9e9ec` / `#d4d4d8` 对白底是 1.21 / 1.48）——数字看着接近，但深色下"边框色当图形色"与卡片底几乎同亮度，实测截图中环线像素 `#262a33` 与底色几乎无法区分。现拆出**图形专用 token**：`--dd-radar-web`（内圈环+辐条，深色 `#414a59`，对比 1.83）、`--dd-radar-ring`（外圈，深色 `#5f6b7c`，对比 3.02）、`--dd-radar-label`（轴名，深色 `#aeb5c0`，对比 7.91，对齐浅色 `#52525b` 对白底的 7.73 观感权重）。浅色回退值逐字不变。
  - **缓存卡无遥测区间变成纯白块**：`gapBands` 的填充是**裸字面量** `fill: '#fafafa'`，从未走主题变量表——与是否有数据无关，任何深色场景都会画出一块 15.65:1 的白色矩形（正是用户说的"没有数据时背景都是白的"）。现 token 化为 `--dd-band`，浅色回退仍为 `#fafafa`（逐像素不变），深色为 `#2b323c`（对比 1.26，与浅色 1.04 同量级的"淡带"语义）。
  - 顺带修正同卡其余图形件：`--dd-grid` 深色 `#1b1f24` 对卡片对比仅 **1.01**（网格线与背景完全同色，实测截图确认），改为 `#3a4250`（1.61）；`--dd-bar-o`（用量视图未命中柱+图例色块）`#3a4150`→`#4c5563`（1.60→2.17）；`--dd-border3/4` 作为细发丝线偏暗（1.17/1.09），提到 1.42/1.39。
  - 已核验：全量 62 个在用 `var(--dd-*)` token 均有深色定义（无静默回退到浅色字面量的漏网），bug 来源锁定为「裸字面量」+「UI 边框色被当图形色复用」两类。修复后**浅色模式渲染 SHA256 与修复前逐字节相同**（零回归），深色模式 A/B 渲染差异落在预期的 4.39% 像素上；`npm run bench` / `smoke-host` 全绿。

- **趋势卡 Token/费用/时长 切换柱状图无过渡动画**：`.dd-seg` 本来就有 `transition:height .3s`，但 CSS 过渡只在 React **复用同一 DOM 节点**时才触发——三种模式的段 key 各不相同（token=`0/1/2`、cost=`0`、dur=`total/active`），只有 token↔cost 能蹭到 key `0` 的复用（所以唯独这一对有动画），涉及时长的任何切换整列节点重建、动画丢失。现统一为**三个固定段槽 key `a/b/c`**：时长模式 a=总时长、b=活跃（overlay 类切换）、c=空槽；费用模式 b/c 高度 0。任意两模式切换全部节点复用，高度+颜色都走过渡（顺带修好：时长图例开关活跃/总时长、token 图例开关各段，现在也有动画了）。harness 实测 5 对切换全部 `reused:true` + 点击后 80ms 仍有 6–9 个 height 过渡在运行，冻结 100ms 帧确认形变中间态正常。
- **X 轴时间标签改为固定步长**：旧抽样「均匀取 N 个点再四舍五入」产生 1/2/3 混合间隔（如 11 个桶标 9 个 → 00,01,03,04,05,06,08,09,10），看起来像随机漏标。现改为 **步长 = ⌈桶数 ÷ 可容纳标签数⌉，每隔固定个桶标一格**：今天 24 小时 → 每 3 小时一格；30D → 每 4/5 天一格；90D → 每 2 周一格，节奏恒定。缓存洞察卡与趋势卡同步修复；趋势卡标签位置也改为居中对齐所属列列心（旧版按 k/(N-1) 贴边定位，与列不对齐），并删除随之失效的 first/last 对齐 CSS。实测今天/30D/90D 三档标签全部等间隔。
- **用量视图柱子压住 Y 轴刻度**：柱状图此前沿用折线的「点刻度」（首桶 x=绘图区左缘），柱子以刻度为中心展开，半截越界盖住左侧 token 标签（桶少柱宽时最严重，如「今天」凌晨只有个位数桶）。改为**分带（band）刻度**：柱心落在等宽槽位正中，首末柱完整留在绘图区内；X 轴标签、hover 落点（floor 槽位）、参考线、tooltip 定位全部随视图刻度对齐，柱宽上限 26px 防单桶占满。折线视图不受影响（细点/线从未越界）。实测「今天+用量」Y 轴标签完整、hover 左右边界落桶正确（00:00/10:00）、命中率视图无回归。
- **缓存洞察卡右上角按钮**：① 视图切换从 FilterBar 同款小 pill（`.dd-range`/`.dd-pill`，12px）换成全站标准 `Segmented` 组件（与趋势卡、分布卡的 Token/费用切换同尺寸同观感）；② 移除 Y 轴缩放切换按钮（连同其「出现/消失导致按钮组横向跳位」的布局 bug）——按产品决策 **Y 轴恒为自适应放大**（域取命中率+覆盖率数据带外扩、整步进取 2/5/10pp），不再有 0–100% 选项。
- **雷达粘性 hover 无释放路径**：上一轮把图例 hover 改成粘性聚焦后，`legendId` 只进不出——悬停过一次后其他模型永远变暗，无法回到全部显示。最终语义回归经典：**放上即高亮、移开图例项即恢复全览**（item 级 mouseleave；卡级 leave 兜底）；点击 = 显式锁定、再点取消。真实渲染流逐项验证：hover→dim3、移开→dim0、切换→正常、锁定跨移开保持、解锁+移开→dim0。
- **雷达图例 hover 高亮「失效」**：图例项的 hover 在鼠标移开瞬间被清空，用户把指针移向图形查看时高亮与真值标签已消失（点击因持久化而正常），体验等同 hover 不可用。改为**粘性聚焦**：图例 hover 后高亮保持（chart hover 仍为临时预览、点击仍为锁定），优先级 chart hover > 图例 hover > 点击锁定 > 默认第一个；聚焦模型 fill 提到 0.45 强化「它亮起来」的观感。经 React 18 本地 harness + 真实鼠标事件验证：移开鼠标后 dim 与顶点标签保持。
- **健壮性审计轮**（安全/异常/死代码/口径一致性）：
  - 监听器毒事件防护：实时流事件折叠 `foldAppend` 抛错不再冲垮 `session/event` 派发（原样外抛会波及同事件的其他监听器，Node 下未捕获即进程级风险）；毒事件被丢弃并计数（`st.droppedEvents`），后续事件继续入账。`drainPending` 同口径逐事件防护。
  - 毒历史防护：`foldSession(events)` 抛错（存储日志本身畸形）此前会让该会话每 60s 重入队、每次重付全量解码——正是冷启动修复杀死的“死亡风暴”模式的折叠版；现直接永久标记 `dead` 跳过。
  - 新会话事件触发 `loadSession` 补 `.catch()`：历史装载被拒不再形成 unhandledRejection。
  - `foldAppend` 的 `assistant/message` 分支 `ev.data.usage` 空引用洞修复（`data` 缺失事件不再抛 TypeError），并新增 bench `[0f]` 脏事件套件。
  - **边缘/聚合桶响应时长口径统一**：窗口边缘小时此前用 `durUA`（用户消息→回复，跨工具执行）喂 per-model 延迟直方图，聚合桶用 `genDurMs`（step 区间）——同一模型统计随窗口是否切到小时中部而漂移。现在折叠时把 `genDurMs` 随 type-2 明细事件携带（`actMs` 槽位），边缘路径优先读取，两口径严格一致；bench `[0g]` 锁死。
  - 查询参数防护：`/dash-api/*` 的 query 键过滤 `__proto__/constructor/prototype`（防把污染键挂上 args 对象）；恶意输入实测优雅降级（`range=');__proto__=1&from=abc&to=1e20` → 回退全窗口 183 ms 正常返回）。
  - rollup 磁盘缓存格式 v3（分桶去掉死字段）；`computeRollupActiveMs` 桶扫描 `break` 改 `continue`（不依赖 Map 插入序，pending 乱序补折不丢区间）。
- **死代码清理**：删除从未被读取的 `st.failCount`、`st._lastLoadError`（写死）与分桶上恒为 0 的 `activeMs` 字段（activeMs 一律由 type-6 区间推导）；`computeRollupActiveMs` 的返回值（无调用方使用）移除。
- 客户端修正：`DUR/COST/TOTAL` tip 之前被 StatCard 透传但从未渲染，现接为 ⓘ 按钮的原生 hover 提示；COST_TIP 去掉过期的「245 个模型」硬计数；模型下拉「全选」改为置空筛选（245+ 模型 id 拼查询串会逼近 Node HTTP 16KB 头部上限，且“全选”语义等价于“全部”）；`installDashboardNavIcon` 的 MutationObserver 回调 rAF 合帧（聊天页持续流式变更时不再每批 mutation 全量扫描按钮）。
- 修复**「活跃时长」恒显示 0**：DSH v2+ 的日志迁移链（`dsh-session-format-v1-to-v2`）会直接丢弃 `assistant/chunk` 事件，实时事件流也不再生成它——原「首个输出分块 → finish」的生成区间在现网任何会话上都无法建立。引擎新增 step 区间回退：某 step 没有任何分块证据时，`step/start → assistant/message` 计为模型生成时间（其后的工具执行不计入；被打断、始终没有 assistant/message 的 step 不计入），有分块事件的旧日志仍按分块口径（排除 TTFT 与排队）。模型响应时长统计（avg/p50/p95）同步受益——此前大量退化为「用户消息 → 回复」的跨工具耗时。`rollup` 磁盘缓存格式版本升为 2，旧折叠（无生成区间、旧定价）全部失效重折。
- **qwen3.8-flash 计入定价**：价格行 `qwen3.8-flash,Alibaba,0.8,2.7,0.1`（¥/M）已在扩展 CSV 中，但 CSV 更新后未重新生成 `pricing.js`，导致该模型会话费用为 ¥0（实测当日 870 万 tokens 费用显示 0）。已 `npm run build` 重新生成（246 模型）。
- 修复数据看板在 DSH ≥ 0.1.5 上**冷启动一次一点、几分钟加载不完**的问题。上一版修复把冷加载改成了「请求立即返回部分数据、后台渐进物料化」，但死会话（约 170 个旧版子代理日志，DSH 迁移器对 `subagent/descriptor` version≠2 以外版本直接拒读）会在**每次列表与 60s reconcile 时重新入队**，每个死会话每次重试都要付出完整格式迁移解码（秒级），后台风暴永不停止。现改为：装载链只走 `sessionPersistence.requireStoredLog(id)`（单会话直读，无全库重扫）；读取失败**立即静默跳过、永不重试**；列表来源改为**直接走查会话库目录**（只认现行 `session-<id>` 布局，旧版裸 `<uuid>` 子代理目录根本不入队），走查只需每会话一次 readdir+stat。
- 按产品决策，看板**只统计普通会话**：子代理会话（旧布局裸 uuid 目录 173 个 + 新格式委派会话）一律排除，不做提示、不做进度条（`meta.warming` 与客户端进度 UI 已移除）。
- 恢复「首次打开即完整数据」：首个看板请求会等待后台物料化收敛（上限 90 s，缓存命中时为秒级），之后所有范围/筛选切换仍走 stale-while-revalidate 毫秒级缓存。

### 新增

- **「缓存命中率趋势」重设计为「缓存洞察」卡**：旧卡只有一根线，且固定 0–100% 轴把实测 91–99% 的命中率压成贴顶直线。新版：① KPI 条（窗口命中率 + 环比 ▲/▼pp、遥测覆盖率、**预计节省** = 缓存读取 tokens × (输入价 − 缓存价)，跟随 ¥/＄ 切换）；② 双视图切换——命中率视图（monotone-cubic 平滑曲线、**自适应 Y 轴**默认放大到数据带并可一键切回 0–100%、覆盖率琥珀虚线、均值参考线、末端数值胶囊、无遥测区间浅灰带）与用量视图（缓存读取 vs 未命中计费输入堆叠柱，hover 其余柱淡出）；③ **模型缓存排行**（按读取量排序：条长=读取量、琥珀刻度=覆盖率、命中率 % + 各模型节省额，未定价模型显示「—」、免费模型如实 ¥0；**点击行 = 按该模型筛选全看板**、再点解除；▾ 展开全部、内部滚动）；④ ⓘ 弹窗人话解释命中率/覆盖率/节省/排行条四个口径。Tooltip 维持既定口径仅四项（时间/命中率/缓存读取/覆盖率）。**视图切换带过渡动画**：命中率/用量两层常驻同一 SVG、交叉淡入淡出；激活层重播入场——折线 `pathLength=1` 归一后描边生长（0.6s）、面积/圆点/均值错峰淡入、覆盖率虚线最后浮现；柱状图从基线 `scaleY` 弹起并按索引 26ms 错峰（左起右随）；KPI 条与图例整体淡入上浮。基态样式即动画终态，故淡出的旧层保持完整图形只走 opacity，切换不闪断。全部数据来自现有 buckets 与 meta.models（含定价）客户端计算，**引擎零改动**。卡高 420px 与雷达卡对齐。React harness 真实数据逐项验证：双视图 hover、缩放切换、模型点击筛选联动、展开收起、90D/30D/今天三种粒度、动画冻结帧确认描边生长与柱错峰。
- **模型效能雷达 v3（六轴重设计）**：旧六轴一半是同一延迟分布的重复衍生、且含被污染数据标定的阈值与两个零区分度轴。新六轴各答一个问题、方向统一（外圈=好）：响应速度（P50 倒数，外圈=0.8s）、输出速度（tokens/实测生成秒，外圈=166）、平均输出量（tok/次，外圈=1,645）、平均输入量（计费输入 tok/次，外圈=29.4万）、稳定性（P50/P95，外圈=慢≤8.3倍）、实际单价（¥/百万 tokens 全口径反向，外圈=¥0.10/M；未定价模型该轴留空并标注）。全部对数归一、固定外圈（90d 实测最佳×1.2 标定）。直观性：顶点挂**实测真值标签**（`5.0s`、`¥0.26/M`…，最后绘制防遮挡），外圈角标基准值，图例横排带调用次数与多行真值 title，卡下新增双列**数值卡**（真值+得分色条）；ⓘ 说明只讲含义与外圈参考值、不含公式，并注明「平均输入/输出量是使用画像而非强弱」「实际单价≠官方牌价」。缓存命中轴退役（实测 90–99.5% 零区分度，缓存指标由趋势卡专职承担）。布局紧凑版：雷达卡原位、半宽内纵向堆叠，不动缓存趋势卡。
- **雷达 v3 二轮调整（用户反馈）**：① 纵向堆叠版卡片过长（~570px）→ 改「左雷达 250px + 右列（图例两行：名称整行+次数、数值卡单列真值）」，卡高压到 ~374px；② 外圈基准值标签从图面移除（标定说明保留在 ⓘ 弹窗）；③ 归一化从单端 `log(1+v)/log(1+max)` 换成**双端对数带宽** `log(v/floor)/log(ceil/floor)`——响应速度外圈=P50 1s、中心=120s（30s 的推理模型从贴中心 0.04 抬到 ~0.29，快慢分层可见），其余轴同步双端标定（输出速度 1–166 t/s、平均输出量 50–1,645 tok、平均输入量 5k–29.4万、稳定性 慢125倍–8.3倍、实际单价 ¥2–¥0.10/M）；④ 顶点真值标签放大并收紧 viewBox（552×470），小卡宽度下轴名不再贴边截断。经 React harness 真实渲染截图逐项验证（图例名称完整、标签可读）。
- **雷达数值卡升级为「标尺行」**（用户反馈纯文字无美感）：每轴 = 灰色轴名 + 等宽字体真值 + 细轨道；**四个模型的得分落点以小圆点同屏对比**——当前模型放大、白圈+主色光晕，其余半透明，hover 圆点有「模型 · 轴: 真值」原生 title；主色淡填充从 0 延伸到当前落点。信息从「一行文字」变成「这一轴上谁强谁弱」的微型对比图，配色沿用图例色板与整站一致。viewBox 放宽到 583×470 修复右轴名截断；卡高 425px（仍远低于旧堆叠版 ~570px）。
- **雷达「安静风」配色**（用户反馈原版太亮）：环线与轴线 `#9ca3af`→`#e9e9ec`（外圈 `#d4d4d8`）；多边形填充 0.42→0.13（聚焦 0.20、变暗 0.03）、描边 85% 不透明；顶点标签去掉白底药丸+投影，改白底 1px 细灰描边（`#dcdce1`）+ 墨色 `#3f3f46` 半粗文字；圆点缩小（3.5/2.5）；数值卡轨道填充 0.3→0.18、当前模型落点光晕降为 40% 主色、真值文字转墨色；图例名称同步 `#3f3f46`。整体与看板 zinc 浅灰风格统一。
- 客户端「活跃时长」说明（DUR_TIP 与 ⓘ 弹窗）改写为与新口径一致：按 step 从请求发起到回复完毕累计，旧日志含分块时从首个分块起算。
- **rollup 磁盘缓存**（`~/.dsh/usage-dashboard-cache/<sessionId>.json`，按日志文件 `mtime+size` 失效）：折叠后的 rollup（含窗口边缘精确性所需的逐事件明细）按会话落盘；DSH 重启后未变化的会话**零解码直接采纳**，全库冷启动从分钟级降到秒级，缓存总量约 20 MB（实测 18.8 万个折叠事件）。
- 会话库走查（`walkStore`）：`readdir + stat` 直查 `sessionPersistence.root`，取代每请求 4–8 s 的 `q.listSessions()`；服务不可用时回退 `sessionQuery.listSessions()`（并按头部 `delegationDepth`/`parentSession` 跳过子代理）。

### 性能

- 实测（真实会话库 340 目录）：普通会话 157 个、总 tokens 23.46 亿与修复前看板完全一致；缓存命中后重启首次完整响应为**秒级**，全部端点（`usage`/`detail`/`calendar`）毫秒级（SWR 命中 15–45 ms）。
- 读取链按 API 可用性降级（`requireStoredLog` → `open(id,'read')` → `readSession`），不再按会话失败逐级重试——不可读会话只付一次解码代价。

### 测试

- bench 新增 `[0a2]`：无分块日志的 step 区间回退语义（消息闭合 5s + 分块闭合 3s、被打断 step 不计、`foldAppend` 与 `foldSession` 逐字节一致），并断言 `qwen3.8-flash` 已在生成价目表中（防「CSV 改了没重生成」回归）。
- 新增客户端 bundle 的 **slot 注册契约**校验（`smoke-host.mjs` + `verify-pack.mjs`）：断言 bundle 解析 `slots` 服务、调用 `slots.inject('<slot>')`、且每个注入的 slot 都是已知 slot 并配对了对应的 `slots.register({ name: '<slot>' })`。此前的正则假设 API 形如 `register({`，与实际的 `slots.inject('settings.section', () => slots.register(\n  { name: ... }))` 不匹配，导致校验形同虚设；同时对畸形 bundle 做了负向验证。
- 新增 `scripts/e2e-check.mjs`：对真实/夹具会话库跑完整装载链（走查 → 缓存写入 → 二次启动采纳 → 查询），断言两轮 totals 一致。
- 新增 `scripts/scan-unreadable.cjs`（生成 `unreadable-sessions-report.md`：逐会话列出不可读原因）与 `scripts/estimate-recovery.mjs`（用插件自身引擎估算各组会话的 token/费用体量）。
- 修正两条依赖旧「请求内同步冷加载」语义的断言，改为显式跨过快照窗口并使用独立缓存键。

### 文档

- **`README.md` / `README.en.md` 全面重写**：原文档存在多处与实际行为不符的描述，逐条对照源码核实后修正。
  - 事实性错误：版本号 `0.3.10` → `0.3.11`；定价表模型数 245 → **246**；趋势粒度「7D/30D/90D 均为每日」→ **90D 实为每周**（`pickGranularity` 实测）；雷达六轴定义停留在重设计前的旧版（响应效率/一致性/成本效率/缓存命中/Token 产出）→ 现为**响应速度/输出速度/平均输出量/平均输入量/稳定性/实际单价**，且归一化由「最佳值 1.2 倍」改为**固定外圈双端对数带宽**；缓存卡描述停留在「一条折线」→ 现为**缓存洞察卡**（KPI 条 + 双视图 + 模型排行）；启动预热 500ms → **150ms**（`PREWARM_DELAY_MS`）。
  - 补充缺失章节：**系统要求**（DSH 版本区间、Node ≥18）、**统计范围**（子代理会话按产品决策排除，故会话数少于 `~/.dsh/sessions` 目录数）、**HTTP 接口**（三条 `/dash-api/*` 路由的参数表与响应结构）、**配置**（`debugCache`）、**已知限制**（费用为估算、冷启动耗时、不可读日志跳过等）、**深色模式**。
  - 措辞改为产品文档口吻：移除「而非…」「不会出现…」「不虚构…」「这是预期行为而非漏算」等对照式辩解与内部验证细节（smoke 守卫、bench 容差）。
- **README 截图全部重拍**：旧截图（2026-08-19）早于雷达 v3、缓存洞察卡与深色模式，与新文案矛盾。新增 `scripts/capture-screenshots.mjs`——把**真实的 `lib/client.js`** 与 `/dash-api/*` 实抓夹具在无头 Chromium 中渲染后按卡片裁剪，共 6 张（含深色模式）；移除 4 张过时截图。
- **`COMPAT.md` 按最新 DSH 重新验证**：覆盖上限由 `0.1.5-rc.2` 更新至 **`0.1.7-rc.2`**（本机运行 `0.1.6-alpha.2`）。方法沿用原文：下载目标版本子包，对插件依赖的每个 API 定位源码行号（`requireStoredLog`/`snapshotEvents`/`listSessions`/`readSession`/`delegationDepth`/`webServer.register`/`settings.section` 等 8 处全部命中）。新增版本时间线、事件词汇表（0.1.7 新增 `developer/message`，实测全库 629 个会话文件中仅 3 个含该事件、共 8 次，被忽略且不计入消息数）、V4 日志文件名兼容性实测（三种文件名均被现有正则匹配），并记录 `peerDependencies` 版本范围偏窄这一非阻塞待办。

## [0.3.11] - 2026-09-26

> 本段此前缺失（git tag `v0.3.11` 存在但 CHANGELOG 无对应段落），现按该区间的提交记录补录。

### 新增 / 重设计

- **深色模式**：CSS 全量 token 化（`--dd-*` 变量）；修复深色下雷达图轴线不可见、缓存卡出现纯白块。
- **缓存洞察卡重设计**、**雷达图 v3（六轴）**、**趋势切换动画与 X 轴固定步长**。
- **README（中英）重写**，`COMPAT.md` 覆盖上限更新至 DSH `0.1.7-rc.2`。
- **可复现的截图流水线**：`scripts/capture-screenshots.mjs` 以真实的 `lib/client.js` 配合 `/dash-api/*` 夹具在无头 Chromium 中渲染并按卡片裁剪，共 6 张（含深色模式）；移除 4 张过时截图。

### 修正

- **活跃时长改用 step 区间口径**，迁移日志做邻近合并（缓存格式 v5）；定价表补 `qwen3.8-flash`。
- **DeepSeek 现行两型号计价**：`deepseek-flash` 等新名此前静默漏计为 ¥0。
- **provider 目录原样大小写的模型名**（如 `Qwen3.8-Flash`）此前静默漏计为 ¥0。

## [0.3.10] - 2026-09-09

### 新增

- 新增「模型效能雷达」卡片：在筛选窗口内展示调用量前 **4** 个模型的六维雷达对比，六轴为响应效率（输出 Token / 平均响应 ms）、响应速度（1 / p50 ms）、一致性（1 / (1 + p95/p50)，分位数来自对数直方图）、成本效率（输出 Token / 费用）、缓存命中（%）与 Token 产出（输出 / 计费输入 `billedInput` × 100%）；各轴按**固定上限**归一化为 0–1（上限基于实际数据分布设定，约取当前最佳值的 1.2 倍；响应效率、响应速度、成本效率三个量级跨度大的轴用对数刻度），因此不同时间窗口之间可以直接比较，也不会出现所有模型都贴住外圈。右侧列表点击或雷达点 hover 高亮对应模型、其余变淡；标题旁 ⓘ 弹窗按轴逐条解释含义。
- 新增「缓存命中率趋势」卡片：按所选时间范围的每桶绘制缓存命中率折线 + 散点，Y 轴固定 0–100%；展示当前窗口命中率、缓存数据覆盖率与环比百分点变化（当前 − 上一窗口，基线为零时隐藏）。断点仅在非相邻桶间出现。

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

### 文档

- 修正 `README.md` / `README.en.md` 三处过时或错误说明：定价表名 `vibe-usage-model-pricing.csv` → `vibe-usage-model-pricing-extended.csv`、模型数 204 → 245、"美元 ×7 折算人民币" → 表内单价已直接以人民币元/百万 token 计价；雷达图"各维度 Top-1 归一化为 100" → 固定上限归一化为 0–1（含对数刻度说明）；缓存命中率趋势中不存在于代码的"加权平均命中率" → 实际展示的覆盖率与环比百分点。
- 补充四处 ⓘ 说明弹窗的文档：预估费用（定价覆盖与峰谷计费）、活跃时长 / 总时长（口径差异）、模型效能雷达（六轴含义）。
- 清理英文版两处漏译的中文「口径」。

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

[0.3.10]: https://github.com/skkjkk/dsh-usage-dashboard/compare/v0.3.9...v0.3.10
[0.3.9]: https://github.com/skkjkk/dsh-usage-dashboard/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/skkjkk/dsh-usage-dashboard/releases/tag/v0.3.8
