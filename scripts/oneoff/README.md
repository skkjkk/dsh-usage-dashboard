# scripts/oneoff — 一次性脚本（不要对源码直接运行）

这些脚本是开发过程中的一次性产物，已确认**零引用**（不在 `package.json` 的任何
script、不在 CI、不被其它脚本 import）。留在这里只为保留排查线索。

## 警告

- 这些脚本依赖的是**当时的**日志格式与路径约定，不保证在今天的 DSH 版本上仍可用。
- `diag-step-fields.mjs` 读取损坏日志时**曾有**无边界循环（`for (;;)`）的风险；
  0.3.20 起 `firstFrame` 已加 magic 校验、块头与载荷越界检查、块头上限，并且
  `test/oneoff-diag.test.js` 用「截断帧 / 全 0 帧必须抛错而不是挂住」把它钉住。
- **`dark-*.cjs`（5 个）已在 0.3.20 删除**：目标文件 `src/client.js` 于 0.3.19 被拆分为
  `src/client/` 模块树，这些 codemod（其中 `dark-codemod.cjs` / `dark-js.cjs` 会**原地改写
  源码**、且不备份）已永久失效，留着只会诱导误用。需要考古时从 0.3.19 及更早的 tag 取回
  （例如 `git show v0.3.19:scripts/oneoff/dark-codemod.cjs`）。

## 清单

| 脚本 | 用途 |
| --- | --- |
| `diag-active-ms.mjs` | 逐会话核对 activeMs 口径 |
| `diag-step-fields.mjs` | step 事件字段探查（`firstFrame` 已导出，供 `test/oneoff-diag.test.js` 断言边界） |
| `inspect-events.mjs` | 单会话事件转储 |
| `measure-seen-usage.mjs` | 量磁盘缓存里 `_seenUsage` 去重签名的真实体量（条目数/字节数 vs `evts`），是剩余任务 F5「拒绝定长哈希」的决策依据 |
| `verify-client-live.mjs` | G2：把真实 `lib/client.js` 按运行实例的加载契约装进 Chromium、同源代理到活宿主，断言槽注册/样式注入/渲染/导出 CSV（截图落系统临时目录，含真实项目名**不得提交**；见 COMPAT.md 的例行程序第 4b 步） |

仍在维护、且在 README/AGENTS/CI 中有据可查的诊断脚本保留在 `scripts/`：
`bench.js`、`smoke-host.mjs`、`regenerate.cjs`、`verify-pack.mjs`、`e2e-check.mjs`、
`capture-screenshots.mjs`、`debug-total.js`、`scan-unreadable.cjs`、`estimate-recovery.mjs`。
