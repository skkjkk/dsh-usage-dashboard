# DSH 版本兼容性档案

> 2026-09-29 更新。基线：桌面端 `0.2.0-rc.1`（本机 `D:\DeepSeek Harness`，实测运行实例）。
> 方法：把 0.1.7-rc.2 与 0.2.0-rc.1 的相关子包从 npm 逐个下载，对 0.2.0 桌面 app.asar 内
> 实际打包的 289 个 `@deepseek-ai` 包做版本清点，插件实际依赖的每个 API 做符号定位
> （grep 源码行号，新旧双版本计数与行号对齐），不使用 changelog 文字推断。
>
> 结论：**一份代码通吃 `0.1.3-alpha.2` → `0.2.0-rc.1`，不需要按 DSH 版本开分支。**
> 唯一适配动作是元数据级：`dsh.client.inject` 与 peerDependencies 的包名/范围修正（见下）。

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

## 0.2.0 与插件相关的元数据变化（本次适配点）

1. **`@deepseek-ai/dsh-client-runtime` 退役**：0.2.0 桌面 app.asar 的 289 个 `@deepseek-ai`
   包中已不存在该包，浏览器模块系统由 `@deepseek-ai/dsh-client-modules`（0.1.3 起与主线
   同版发布，各代桌面 bundle 均在）承担。`dsh.client.inject` 引用不存在的包会被
   `arriveGraphRow` 静默跳过（`graphRows.get(name) === undefined` → continue），因此
   inject 数组**同时保留** runtime（旧 DSH）与 modules（新 DSH）两个名字，全版本兼容。
2. **peerDependencies 范围修正**：旧声明 `^0.1.0-rc.6` 按 semver 预发布规则不匹配
   0.1.6/0.1.7/0.2.x（此前实测不影响运行，因 DSH 以 bundle 方式装配、不做严格 peer 校验）。
   现改为 `>=0.1.0-rc.6 <0.3.0`，声明与实际支持面一致；`dsh-client-runtime` 从 peer 中移除
   （它已停更在 0.1.1-rc.2，不应再作为对等依赖声明）。
3. 0.2.0 的 `client-modules` 对 `dsh.client` 声明做了显式校验（`parseDshClient`：
   `platform` 必须是字符串、`inject`/`external` 必须是字符串数组、`immediately` 必须是
   布尔）——本插件声明全部合规。

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

- 无。原「peerDependencies 版本范围偏窄」项已在 0.3.12 修复（见上「0.2.0 与插件相关的元数据变化」第 2 条）。

## 每次升级 DSH 的例行程序

1. 升级 DSH，重启。
2. 插件自动热装配（bundle 列表）；若改了 `src/` 则先 `npm run build` 再重载插件。
3. 冒烟：打开看板，或 `curl "http://127.0.0.1:<port>/dash-api/usage?range=7d"` → 秒级返回、
   `totals.sessions` 与 token 量级不变（端口为 DSH 实例实际监听的端口）。
4. 回归：`npm test`（build 守卫 + bench 引擎一致性 + smoke 缓存/SWR/路由/slot 契约）。
5. 首次冷加载若经历 V3→V4 迁移解码会偏慢，属预期；第二次启动走 rollup 磁盘缓存即恢复。
6. 兜底：`~/.dsh/usage-dashboard-cache` 的磁盘 rollup 不依赖 DSH 可用性——即使读取路径再被
   重构，重启后看板仍能从缓存秒级出历史数据（未变的日志文件直接采纳缓存）。

## 如果未来真的出现不可适配的破坏

- **不要开长期分支**（双分支 cherry-pick 会拖死维护）。用 git tag 划线：旧版本是"老 API 世代"
  的完整快照，永远可从 GitHub Release 安装。
- main 保持"特性探测 + 降级链 + 磁盘缓存兜底"的设计原则，新代码优先扩展探测链而不是换轨。
- 若某次 DSH 破坏大到需要放弃旧接口：发 0.4.0，`CHANGELOG` 记最低支持版本即可——版本线本身就是分支。