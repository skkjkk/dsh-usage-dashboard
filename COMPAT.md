# DSH 版本兼容性档案

> 2026-09-26 更新。基线：本机安装的 `@deepseek-ai/dsh 0.1.6-alpha.2`；目标：npm 上最新的
> `0.1.7-rc.2`。方法：把目标版本的相关子包从 npm 逐个下载，对插件实际依赖的每个 API
> 做符号定位（`grep` 源码行号），不使用 changelog 文字推断。
>
> 结论：**一份代码通吃 `0.1.3-alpha.2` → `0.1.7-rc.2`，不需要按 DSH 版本开分支。**

## DSH 版本时间线（npm 实际发布）

| 版本 | 发布 | 备注 |
| --- | --- | --- |
| 0.1.3-alpha.2 | 2026-09-07 | 本档覆盖的最老版本 |
| 0.1.5-alpha.1 / .2 | 2026-09-08 / 09 | |
| 0.1.5-rc.1 / .2 | 2026-09-10 | 会话格式迁移器开始硬拒旧子代理日志 |
| 0.1.6-alpha.1 / .2 | 2026-09-15 / 17 | **本机当前运行版本** |
| 0.1.5-rc.3 | 2026-09-22 | 与 0.1.5-rc.2 同代补丁 |
| 0.1.7-alpha.1 / .2 | 2026-09-22 | 引入 V4 会话格式、`developer/message` 事件 |
| 0.1.7-rc.1 / .2 | 2026-09-23 / 24 | **npm 上最新**（`next` tag） |

`dist-tags`：`latest = 0.1.5-rc.3`、`next = 0.1.7-rc.2`、`alpha = 0.1.7-alpha.2`。
注意 `latest` 并非最新代码——这是 DSH 的发布策略，不是本插件的兼容性问题。

## 能力矩阵（usage-dashboard 依赖的全部 DSH 接口）

验证基准：`0.1.7-rc.2` 各子包源码行号（括号内为定位到的行）。

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
`tool/call`、`tool/result`。在 `0.1.7-rc.2` 中这些**全部保留，零删除**。

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

- **peerDependencies 版本范围偏窄**：`package.json` 声明 `^0.1.0-rc.6`，按 semver 预发布规则
  该范围只匹配 `0.1.0-*` 的预发布版，**不满足** `0.1.6`/`0.1.7` 的 alpha/rc。
  实测不影响运行（本机装的是 `0.1.6-alpha.2`，插件工作正常），因为 DSH 以 bundle 方式装配、
  不做严格的 peer 校验。若要让声明与实际一致，可改为 `>=0.1.0-rc.6 <0.2.0`。
  另注意 `dsh-client-runtime` 已停在 `0.1.1-rc.2`，不再随主线发布。

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