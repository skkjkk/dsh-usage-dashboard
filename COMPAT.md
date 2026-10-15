# DSH 版本兼容性档案

> 2026-10-15 更新。基线：桌面端 **`0.2.0-rc.2`**（本机运行实例；0.2.0-rc.1 的逐符号核对
> 与 0.2.0-rc.2 的实测回归见下两节）。
> 方法：把 0.1.7-rc.2 与 0.2.0-rc.1 的相关子包从 npm 逐个下载，对 0.2.0 桌面 app.asar 内
> 实际打包的 289 个 `@deepseek-ai` 包做版本清点，插件实际依赖的每个 API 做符号定位
> （grep 源码行号，新旧双版本计数与行号对齐），不使用 changelog 文字推断。
>
> 结论：**一份代码通吃 `0.1.3-alpha.2` → `0.2.0-rc.2`，不需要按 DSH 版本开分支。**
> 唯一适配动作是元数据级：`dsh.client.inject` 与 peerDependencies 的包名/范围修正（见下）。
> peer 范围的 semver 预发布语义已在 0.3.20 复核并重写（见「0.2.0 与插件相关的元数据变化」第 2 条）。

## DSH 版本时间线（npm 实际发布）

| 版本 | 发布 | 备注 |
| --- | --- | --- |
| 0.1.3-alpha.2 | 2026-09-07 | 本档覆盖的最老版本 |
| 0.1.5-alpha.1 / .2 | 2026-09-08 / 09 | |
| 0.1.5-rc.1 / .2 | 2026-09-10 | 会话格式迁移器开始硬拒旧子代理日志 |
| 0.1.6-alpha.1 / .2 | 2026-09-15 / 17 | |
| 0.1.5-rc.3 | 2026-09-22 | 与 0.1.5-rc.2 同代补丁 |
| 0.1.7-alpha.1 / .2 | 2026-09-22 | 引入 V4 会话格式、`developer/message` 事件 |
| 0.1.7-rc.1 / .2 | 2026-09-23 / 24 | |
| **0.2.0-rc.1** | 2026-09 下旬 | **`next` tag；本机桌面端 0.2.0-rc.1 实测通过** |

`dist-tags`：`latest = 0.1.7-rc.2`、`next = 0.2.0-rc.1`、`alpha = 0.1.7-alpha.2`。
注意 `latest` 并非最新代码——这是 DSH 的发布策略，不是本插件的兼容性问题。

## 0.2.0-rc.1 验证（npm 包源码行号 + 桌面 app.asar 实测）

对插件依赖 API 做 0.1.7-rc.2 → 0.2.0-rc.1 双版本 grep 对比（出现次数与行号完全一致）：

| 插件依赖 | API | 0.2.0-rc.1 验证 |
| --- | --- | --- |
| 主读取路径 | `sessionPersistence.requireStoredLog(id)` | ✓ persistence-jsonl:2467/2470/2492（同 0.1.7） |
| 活会话零解析 | `Session.snapshotEvents()` | ✓ dsh-session:1376（同 0.1.7，含 `inheritedEventCount` 变体:1390） |
| 事件流 | `ctx.on('session/event')`，回调 `(session, event)` | ✓ dsh-session:1466-1473 `collectSessionCallbacks` + `callbackArgs = [this, event]`，签名不变 |
| fork-seed | `session/end-seed {inherited:true}` / `isSeeded` | ✓ end-seed/isSeeded 计数 31=31（新旧一致，切断语义未变） |
| 列表降级 | `sessionQuery.listSessions()` | ✓ session-query:95/1070（行号一致） |
| 会话读取降级 | `sessionQuery.readSession(id)` | ✓ session-query:1079（行号一致） |
| 子代理过滤 | header `delegationDepth` / `parentSession` | ✓ dsh-session 计数 2=2 |
| 路由注册 | `webServer.register(route)` | ✓ host-webserver:177（行号一致） |
| 项目归属 | `workspaceRegistry` | ✓ dsh-workspace:374 `super(ctx, "workspaceRegistry")` |
| 设置面板挂载 | `slots.inject('settings.section', …)` + `slots.register` | ✓ cordis-client-runner client.js:4709 slot 声明仍在，示例即 `settings.section` |
| 磁盘布局 | `session-<id>` 目录 + `session.v\d+.jsonl(\.zstd)?` | ✓ 0.2.0 桌面实测新会话全部 `session-<uuid>` 目录、V4 日志命名未变 |

事件词汇表（`known-event-types.js`）在 0.2.0 新增 `team/*`、`tool/ptc-dispatch*`、
`schedule/change`、`goal/change`、`session-log-deepseek/delivery-accepted` 等类型；插件
`foldAppend` 的 default 分支忽略它们，零影响。`developer/message`（0.1.7 引入）继续被忽略。

## 0.2.0-rc.2 实测回归（2026-10-15，剩余任务 G2）

> 基线：本机运行中的桌面端 **`@deepseek-ai/dsh-desktop@0.2.0-rc.2`**（上一节记录的是
> 0.2.0-rc.1；版本号从运行实例的 `app.asar` 内 `package.json` 读出，`dsh`、`client-modules`、
> `client-connection`、`client-ui-settings`、`host-webserver`、`desktop-host` 六个包同为
> 0.2.0-rc.2，`@deepseek-ai/dsh-client-runtime` 确认**不再存在**）。
> 本轮插件版本 = 0.3.19 + 剩余任务 F/G 的改动（**客户端 0.3.19 的 esbuild 模块树重构之后**
> 的产物），用 `dev_reload_package` 把新构建的 host + client 装进这个运行实例后测得。

**宿主半边（活实例，真实会话库）**：四条 `/dash-api/*` 全部正常。

| 端点 | 结果 |
| --- | --- |
| `usage?range=7d` | 200，49 会话 / 12.4 亿 token / 定价覆盖率 99% / 未匹配 0；冷启 428 ms，热请求 6–24 ms（SWR 快速路径） |
| `detail?range=7d&limit=3`（及 `limit=200`） | 200，`total=57`、`gran=day` |
| `calendar` | 200，61 天有数据 |
| `export?range=30d` / `90d` | 200，179 行 / 33 KB，CSV 表头 8 列且首行数据 8 列 |
| `usage?range=custom&from=0001-01-01&to=now` | **400 `bad_request`**（`trend range exceeds 50000 buckets`）——F1 修复后极端早的窗口不再被静默截到 1901 年 |

**客户端半边（真实浏览器 + 真实请求）**：`scripts/oneoff/verify-client-live.mjs` 把
`lib/client.js` 按运行实例的加载契约装进 Chromium（playwright devDep），页面**同源代理**到
活宿主的 `/dash-api/*`，23 条断言全绿：

- **运行实例里的契约复核**（不是文档推断）：`window.__ModuleLoader__.load({id, factory})`
  仍定义在 `dsh-client-modules/lib/client.js`（`bundle … loaded without registering "<id>"
  via __ModuleLoader__.load` 这条校验也在）；`cordis-client-runner/lib/client.js` 里
  `slots.register(options, component) needs an options object with a \`name\`` 这条守卫仍在，
  与插件 `slots.register({ name, id, order, label }, render)` 的调用形状一致。
- **槽注册**：`slots.inject('settings.section')` → `register({ name:'settings.section',
  id:'dashboard', order:30, label:'数据看板' })`；两个 `ctx.effect` 都返回 dispose 函数
  （样式 + 设置页图标可清理）。
- **样式注入**：`<style data-plugin-css="@skkjkk/dsh-usage-dashboard/dashboard.module.css">`
  存在，内容含 `.dd-root{`（32,911 字节）。
- **真实渲染**（7d 真实数据）：10 个 KPI、21 个 SVG、4 个图表卡、280 个日历格、20 条记录行、
  2 个分布卡 + 1 个雷达卡；无 `.dd-loading`/`.dd-empty`、**无 pageerror、无 console error、
  无 4xx/5xx 响应**。
- **导出 CSV**：点真实「导出 CSV」按钮 → 真实浏览器下载 → 表头 `时间,项目,模型,工具,
  输入tokens,输出tokens,缓存tokens,费用(元)`、58 行、每行 8 列。

**未在活窗口内验证的一步（如实记录）**：桌面端自己的那个窗口带 token（`dsh web
authentication required`），拿不到 URL，所以「DSH 设置壳把 `dashboard` 这个 section 画进
设置侧栏」这一下没有自动断言——两侧契约都已单独验证（客户端确实注册了合法形状；运行实例的
client runtime 确实按该形状校验），截图证据来自同源代理 harness。证据目录在系统临时目录
（截图含真实项目名，**不得提交**）。

## 0.2.0 与插件相关的元数据变化（本次适配点）

1. **`@deepseek-ai/dsh-client-runtime` 退役**：0.2.0 桌面 app.asar 的 289 个 `@deepseek-ai`
   包中已不存在该包，浏览器模块系统由 `@deepseek-ai/dsh-client-modules`（0.1.3 起与主线
   同版发布，各代桌面 bundle 均在）承担。`dsh.client.inject` 引用不存在的包会被
   `arriveGraphRow` 静默跳过（`graphRows.get(name) === undefined` → continue），因此
   inject 数组**同时保留** runtime（旧 DSH）与 modules（新 DSH）两个名字，全版本兼容。
2. **peerDependencies 范围修正（0.3.20 复核、0.3.22 修正下限）**：旧声明 `^0.1.0-rc.6`
   按 semver 预发布规则不匹配 0.1.6/0.1.7/0.2.x；0.3.12 改成 `>=0.1.0-rc.6 <0.3.0` 后
   **仍然只匹配稳定版**——实测（`semver@7.8.5`，见 `test/peer-range.test.js`）它只匹配
   0.2.0 / 0.2.5 这类稳定版，连当时的 `latest`（0.1.7-rc.2）与桌面端 0.2.0-rc.1 都不匹配。
   现行声明：
   ```
   >=0.1.0-rc.6 <0.3.0 || ^0.1.7-rc.1 || ^0.2.0-rc.1
   ```
   （三个 DSH client 包同一范围；`dsh-client-runtime` 保持从 peer 中移除——它已停更在
   0.1.1-rc.2。）
   > **下限为什么必须是 `>=0.1.0-rc.6` 而不是「验证过的最老版本」`0.1.3-alpha.2`**：
   > 0.3.20 曾把下限抬到 `>=0.1.3-alpha.2`（想与 COMPAT 的实测支持面严格对齐），结果
   > **CI 第一步 `npm ci` 直接 ERESOLVE**——`package-lock.json` 里实际解析到的是
   > `@deepseek-ai/dsh-client-*@0.1.0-rc.8`，新下限把这一档预发布排除了；本地 `npm install`
   > 因为 node_modules 已存在而不复现，属于「本地绿、CI 红」的经典陷阱（0.3.22 修正）。
   > 现在的护栏：`test/peer-range.test.js` 里有一条**读 lockfile** 的断言——锁文件里每个
   > `node_modules/@deepseek-ai/dsh-client-*` 的版本都必须满足 peer 范围，抬下限前它会先失败。
   > **semver 预发布规则（实测矩阵）**：带 prerelease 的版本只有在范围内存在**同
   > `[major,minor,patch]` 元组且自身带 prerelease** 的比较符时才可能满足
   > （`semver` 的 `Range.test` → `testSet` 的 `includePrerelease` 分支）。因此：0.1.x/0.2.x
   > 的**稳定版**全在范围内；`0.1.0-rc.6/rc.8`（下限那一档）与 `0.1.7-rc.1/rc.2`（npm `latest`
   > 线）、`0.2.0-rc.1/rc.2`（桌面端线）也在范围内（后者靠显式列出）；而
   > `0.1.3-alpha.2` / `0.1.5-rc.x` / `0.1.6-alpha.x` / `0.1.7-alpha.x` 这些历史预发布
   > **不在**范围内（已停止分发，实测可跑但声明不覆盖）。
   > **「任意 0.2.x 预发布」在严格 semver 下不可表达**（不是写法问题）：要匹配
   > `0.2.1-rc.1` 就必须有 `0.2.1-x` 的比较符，而未来补丁号无法预先枚举；
   > `test/peer-range.test.js` 用 8 种候选写法（含 `*`、`>=0.0.0-0`、`0.1.x || 0.2.x`）
   > 反证只有 `includePrerelease: true` 才匹配，而 `peerDependencies` 无法表达该选项
   > （npm 的 peer 校验 `@npmcli/arborist/lib/dep-valid.js:53` 传的第三个参数是 **loose**，
   > 实测同样不匹配 prerelease）。
   > 结论：**声明覆盖「稳定带 + 两条在用预发布线」，另外两条更老的历史预发布线与未来
   > 任意预发布由 bundle 装配兜住**（DSH 以 bundle 方式装配，不做严格 peer 校验）。

3. 0.2.0 的 `client-modules` 对 `dsh.client` 声明做了显式校验（`parseDshClient`：
   `platform` 必须是字符串、`inject`/`external` 必须是字符串数组、`immediately` 必须是
   布尔）——本插件声明全部合规。
4. **`/dash-api/*` 共四条路由**（`usage` / `detail` / `calendar` / `export`），且宿主
   `webServer` **对插件注册的 `kind:'exact'` 路由不做任何鉴权**（0.1.6-alpha.2 /
   0.1.0-rc.8 / 0.1.0-rc.6 三份 `dsh-host-webserver` 实现交叉核对：`match()` 命中后
   直接调用 `route.handler(req, res)`，全文无 401/403/token/Origin 校验，也没有中间件；
   `/api` 的信任栅栏由 `dsh-client-connection` 的 `API_PATH = "/api"` 限定，
   **结构上不覆盖 `/dash-api/*`**）。因此插件侧自 v0.3.15 起默认只服务 loopback
   调用方（见 README 安全边界）。宿主版本升级后若要复核这一点，只需确认
   `webServer.register` 的 `handler` 调用点前后是否新增了鉴权分支。

## 能力矩阵（usage-dashboard 依赖的全部 DSH 接口 · 0.1.7-rc.2 历史验证）

验证基准：`0.1.7-rc.2` 各子包源码行号（保留作历史参考，0.2.0 对照见上表）。

| 插件依赖 | API | 0.1.7-rc.2 验证 |
| --- | --- | --- |
| 主读取路径 | `sessionPersistence.requireStoredLog(id)` | ✓ `dsh-session-persistence-jsonl/lib/index.js:2600` |
| 降级读取 | `sessionPersistence.open(id, 'read')` | ✓ 同包 |
| 活会话零解析 | `Session.snapshotEvents()` | ✓ `dsh-session/lib/index.js:1336` |
| 事件流 | `ctx.on('session/event')` | ✓ 事件词汇表见下 |
| 列表降级 | `sessionQuery.listSessions()` | ✓ `dsh-session-query/lib/index.js:95` |
| 会话读取降级 | `sessionQuery.readSession(id)` | ✓ `dsh-session-query/lib/index.js:1079` |
| 子代理过滤 | header `delegationDepth` / `parentSession` | ✓ `dsh-session/lib/index.js:1008,1011` |
| 路由注册 | `webServer.register(route)` | ✓ `dsh-host-webserver/lib/index.js:177` |
| 项目归属 | `workspaceRegistry` | ✓ `dsh-workspace` |
| 设置面板挂载 | `slots.inject('settings.section', …)` + `slots.register` | ✓ `dsh-cordis-client-runner/lib/client.js:4705`（slot 声明仍在） |

日志文件名正则 `^session\.v\d+\.jsonl(\.zstd)?$` 同样成立：本机会话库实测存在
`session.jsonl.zstd`(329) / `session.v3.jsonl.zstd`(265) / `session.v4.jsonl.zstd`(35) 三种，
均被该正则匹配，因此 V4 迁移不需要改代码。

## 事件词汇表

插件 `foldAppend` 显式处理：`user/message`、`assistant/message`、`step/start`、`step/end`、
`tool/call`、`tool/result`。在 `0.2.0-rc.1` 中这些**全部保留，零删除**。

新增的 `developer/message`（0.1.7 引入，`dsh-session/lib/types/known-event-types.js`）不在
处理范围内，落入 `default` 分支被忽略。实测影响极小：全库 629 个会话文件中仅 3 个含该事件
（共 8 次），不计入消息数统计。

## 0.1.7 与插件相关的变更

1. **Session 日志升级 V4** + 批量迁移工具，兼容部分 V3 会话缺轮次结束记录。
2. **新增 `developer/message` 事件**（见上，被忽略，cosmetic 级）。
3. 仅存于自定义事件的附件不再自动读取/导出 —— 本插件不读附件，不涉及。
4. DeepSeek 官方适配器仅 Messages API，移除 Chat Completions 与 protocol 选项 —— 插件不碰 LLM 适配器。
5. 设置改存当前 Profile 的插件配置，旧 `settings.yaml` 仅导入一次 —— 插件配置走 `cordis.patch.yml` 的 `config`，不受影响。
6. Remote/工作区文件读取统一 `readBytes` —— 插件只用 `node:fs/promises` 读写自己的缓存目录，不碰该接口。
7. 无法读取的可选插件包不再中止 Profile 加载 —— 通用利好。

## 已知待办（非阻塞）

- 无未修项。原「peerDependencies 版本范围偏窄」在 0.3.12 修过一次，但那个范围（`>=0.1.0-rc.6
  <0.3.0`）按 semver 规则**仍然只匹配稳定版**（连 0.1.7-rc.2 / 0.2.0-rc.1 都不匹配）；
  0.3.20 已按实测矩阵重写为 `>=0.1.3-alpha.2 <0.3.0 || ^0.1.7-rc.1 || ^0.2.0-rc.1`
  （见上「0.2.0 与插件相关的元数据变化」第 2 条与 `test/peer-range.test.js`）。
- 「任意未来 0.2.x 预发布」在严格 semver 下不可表达（已在同一处论证并列反证）：
  新一轮 DSH 预发布线出现时，往范围里**加一条 `^<版本>-rc.x`** 即可，不必改代码。

## 每次升级 DSH 的例行程序

1. 升级 DSH，重启。
2. 插件自动热装配（bundle 列表）；若改了 `src/` 则先 `npm run build` 再重载插件。
3. 冒烟：打开看板，或 `curl "http://127.0.0.1:<port>/dash-api/usage?range=7d"` → 秒级返回、
   `totals.sessions` 与 token 量级不变（端口为 DSH 实例实际监听的端口）。
4. 回归：`npm test`（build 守卫 + bench 引擎一致性 + smoke 缓存/SWR/路由/slot 契约）。
4b. 客户端半边在真实浏览器里过一遍（G2 的例行化）：
   `node scripts/oneoff/verify-client-live.mjs --range 7d` —— 需要插件已装在这个实例上；
   它断言槽注册（name/id/order/label）、样式注入、10 KPI / 21 SVG / 280 日历格 /
   记录行、无 pageerror/console error/4xx，并点真实「导出 CSV」按钮校验 8 列（截图落在
  系统临时目录，含真实项目名，不要提交）。
5. 首次冷加载若经历 V3→V4 迁移解码会偏慢，属预期；第二次启动走 rollup 磁盘缓存即恢复。
6. 兜底：`~/.dsh/usage-dashboard-cache` 的磁盘 rollup 不依赖 DSH 可用性——即使读取路径再被
   重构，重启后看板仍能从缓存秒级出历史数据（未变的日志文件直接采纳缓存）。

## 如果未来真的出现不可适配的破坏

- **不要开长期分支**（双分支 cherry-pick 会拖死维护）。用 git tag 划线：旧版本是"老 API 世代"
  的完整快照，永远可从 GitHub Release 安装。
- main 保持"特性探测 + 降级链 + 磁盘缓存兜底"的设计原则，新代码优先扩展探测链而不是换轨。
- 若某次 DSH 破坏大到需要放弃旧接口：发 0.4.0，`CHANGELOG` 记最低支持版本即可——版本线本身就是分支。