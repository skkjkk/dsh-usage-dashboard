# scripts/oneoff — 一次性脚本（不要对源码直接运行）

这些脚本是开发过程中的一次性产物，已确认**零引用**（不在 `package.json` 的任何
script、不在 CI、不被其它脚本 import）。留在这里只为保留排查线索。

## 警告

- **`dark-codemod.cjs` / `dark-js.cjs` 会原地改写 `src/client.js`**。
  在仓库里直接运行它们会污染工作树，且不会自动备份。运行前请先 commit 或复制一份。
- `diag-step-fields.mjs` 读取损坏日志时没有边界检查，理论上可能死循环。
- 这些脚本依赖的是**当时的**日志格式与路径约定，不保证在今天的 DSH 版本上仍可用。

## 清单

| 脚本 | 用途 |
| --- | --- |
| `dark-audit.cjs` / `dark-js.cjs` / `dark-codemod.cjs` / `dark-dump.cjs` / `dark-debug.cjs` | 深色模式 token 化的一次性迁移与审计工具 |
| `diag-active-ms.mjs` | 逐会话核对 activeMs 口径 |
| `diag-step-fields.mjs` | step 事件字段探查 |
| `inspect-events.mjs` | 单会话事件转储 |

仍在维护、且在 README/AGENTS/CI 中有据可查的诊断脚本保留在 `scripts/`：
`bench.js`、`smoke-host.mjs`、`regenerate.cjs`、`verify-pack.mjs`、`e2e-check.mjs`、
`capture-screenshots.mjs`、`debug-total.js`、`scan-unreadable.cjs`、`estimate-recovery.mjs`。
