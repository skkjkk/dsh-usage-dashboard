# DSH 版本兼容性档案

> 2026-09-11 对 npm registry 上各 DSH 版本做的静态解剖 + 本机 rc.1 实测。
> 结论：**main（≥0.3.11）一份代码通吃 0.1.3-alpha.2 → 0.1.5-rc.2，不需要按 DSH 版本开分支。**

## 能力矩阵（usage-dashboard 依赖的全部 DSH 接口）

| 插件依赖 | 0.1.3-alpha.2 | 0.1.5-alpha.2 | 0.1.5-rc.1（现役） | 0.1.5-rc.2 |
|---|---|---|---|---|
| `sessionPersistence.requireStoredLog`（主读取路径） | ✓ | ✓ | ✓ 实测 | ✓ |
| `sessionPersistence.open(id,'read')`（降级路径） | ✓ | ✓ | ✓ | ✓ |
| `Session.snapshotEvents`（活会话，零解析） | ✓ | ✓ | ✓ | ✓ |
| `ctx.on('session/event')` 事件流 | ✓ | ✓ | ✓ | ✓ |
| `sessionQuery.listSessions`（无 root 时的列表降级） | ✓ | ✓ | ✓ | ✓ |
| `settings.section` slot + 客户端 register/inject 契约 | ✓ | ✓ | ✓ | ✓ |
| `webServer.register` 路由 | ✓ | ✓ | ✓ | ✓ |
| `persistence.readFrom` | ✗ 不存在 | ✗ 不存在 | ✗ | ✗ |
| `sessionPersistence.root`（目录走查） | 未验证* | 未验证* | ✓ 实测 | ✓ |

\* 属性是否在 cordis 服务代理上暴露未静态确认；但 `initStore()` 探测不到 `root` 时自动降级为 `listSessions` 列表——即 v0.3.10 时代在老 DSH 上实际生效的同一条路径，行为正确、只是首列稍慢。

## 关键事实（纠正两个历史误解）

1. **`persistence.readFrom` 从未存在于 0.1.x 任何已发布版本**——v0.3.10 的 `readFrom` 分支是死代码；它在老 DSH 上实际靠 `sessionQuery.readSession` 兜底工作（冷加载分钟级，但后台预热，所以"看起来"一直很快）。
2. **`sessionQuery.readSession` 内部 `listPersisted` 重扫全库的 O(N²) 行为从 alpha.2 到 rc.2 一字未变**——不是 rc.1 新增的坑。0.3.11 起主路径走 `requireStoredLog` 单会话直读，彻底绕开。
3. rc.1 真正的破坏是：会话格式迁移器对 `subagent/descriptor` version≠3 **硬拒读**（173 个旧子代理日志永久不可读）+ 客户端 bundle 的 slot 注册校验——两者都已处理（子代理静默跳过；register 契约已适配并有测试守卫）。

## rc.1 → rc.2 差异

会话侧 10 个关键包（session / persistence / persistence-jsonl / query / api-session-controller / client-ui-settings / settings-controller / session-log / subagent / format-v0-to-v1）**逐文件 MD5 全部一致：零变化**。可放心升级。

## 以后每次升级 DSH 的例行程序

1. 升级 DSH，重启。
2. 插件会自动热装配（bundle 列表）；若改了 `src/` 则先 `npm run build` + `dev_reload_package`。
3. 冒烟：浏览器打开看板，或 `curl http://127.0.0.1:3080/dash-api/usage?range=7d` → 2 秒内返回、`totals.sessions` ≈155、tokens 量级不变。
4. 回归：`npm test`（build 守卫 + bench 引擎一致性 + smoke 缓存/SWR/路由/slot 契约）。
5. 兜底：`~/.dsh/usage-dashboard-cache` 的磁盘 rollup 不依赖 DSH 可用性——即使某天 DSH 读取路径再被重构，重启后看板仍秒级出历史数据（未变的日志文件直接采纳缓存）。

## 如果未来真的出现不可适配的破坏

- **不要开长期分支**（双分支 cherry-pick 会拖死维护）。用 git tag 划线：`v0.3.10` 及之前是"老 API 世代"的完整快照，永远可从 GitHub Release 安装。
- main 保持"特性探测 + 降级链 + 磁盘缓存兜底"的设计原则，新代码优先扩展探测链而不是换轨。
- 若某次 DSH 破坏大到需要放弃旧接口：发 0.4.0，`CHANGELOG` 记最低支持版本即可——版本线本身就是分支。
