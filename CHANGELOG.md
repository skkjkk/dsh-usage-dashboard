# Changelog

All notable changes to `@skkjkk/dsh-usage-dashboard` are documented here.

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
