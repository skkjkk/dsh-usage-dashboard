# dsh-usage-dashboard

> DSH (DeepSeek Harness) usage statistics dashboard — token / cost / duration / session aggregation with trend, heatmap and calendar views.

为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/DeepSeek-harness) Web GUI 打造的**用量数据看板**插件：聚合本地会话数据，在设置面板「数据看板」中展示 Token / 费用 / 时长的趋势、热力图、日历与明细。

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

## 功能特性

- **KPI 总览**：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、消息数
- **趋势图**：按 Token / 费用 / 时长三种模式查看，输出 / 输入 / 缓存分段着色，支持图例开关
- **周热力图**：一周 7×24 小时分布，Token / 费用 / 时长三种指标
- **日历视图**：按月展示每日用量，月份标签自适应
- **明细记录**：按时间桶 × 模型 × 项目分行统计（同一小时用了两个模型 → 两条），展示项目名、模型、Token、费用，支持分页
- **分布统计**：模型分布、项目分布环形图（前 6 项固定蓝绿橙红紫黄，其余聚合为「其他」）
- **时间范围**：今天 / 24H / 7D / 30D / 90D / 自定义起止日期
- **筛选**：按模型、项目多选过滤，一键清除
- **费用估算**：内置 200+ 主流模型定价表（人民币估算，美元价 ×7 折算），未收录模型不计费；支持 ¥ / $ 切换、中文 / 国际单位切换
- **性能**：会话摘要物化 + revision 增量加载，查询毫秒级（见「性能」章节）

## 架构

```
浏览器 (Client)                          DSH 宿主进程 (Host)
┌─────────────────────┐                 ┌──────────────────────────────┐
│ 设置面板「数据看板」 │  GET /dash-api/ │  /dash-api/usage   总览+趋势  │
│  React + 原生 DOM   │ ───────────────► │  /dash-api/detail  明细记录   │
│  settings.section   │    JSON 桥       │  /dash-api/calendar 日历聚合  │
└─────────────────────┘                 │         │                    │
                                        │         ▼                    │
                                        │  src/core/rollup.js          │
                                        │  纯函数聚合引擎（无 IO）       │
                                        │  foldSession → 会话摘要物化   │
                                        │  queryUsage/Detail/Calendar   │
                                        │         │                    │
                                        │         ▼                    │
                                        │  getRollups()（增量加载）      │
                                        │  listSnapshots() revision 对比 │
                                        │  → 只重读变更会话（8 并发）    │
                                        └──────────────────────────────┘
```

- **Host 半**（`src/host.js`）：注册三个 JSON GET 路由；通过 `persistence.listSnapshots()` 拿到每个会话的**变更令牌（revision）**，只重读并重折叠发生变化的会话；请求级 5 分钟缓存 + SWR + 单飞去重；启动预热默认视图。
- **聚合引擎**（`src/core/rollup.js`）：纯函数、可测试。`foldSession` 把每个会话折叠成紧凑的小时桶摘要（按模型细分 token/费用/时长），一次折叠、按 revision 增量失效；`queryUsage` / `queryDetail` / `queryCalendar` 从内存摘要回答任意时间窗口、粒度与筛选——**首次折叠后查询不再触碰磁盘**。窗口边界（如 7D 从 `now-7d` 开始，非整点）通过桶内事件明细精确处理。
- **Client 半**（`src/client.js`）：向设置面板注册 `settings.section`（id: `dashboard`，order 30，标签「数据看板」），纯 React + 原生 DOM 图表。

## 性能（v0.2）

| 操作 | v0.1 全量扫描 | v0.2 物化摘要 |
|---|---|---|
| 数据查询（7D，内存） | ~62 ms（每次全量遍历 4 万+ 事件 ×2 窗口） | **~1.3 ms**（≈47× 加速） |
| 磁盘读取 | 每次缓存过期重读全部 300 个会话 JSONL | **仅读取变更会话**（revision 对比） |
| 会话变更（10 个） | 重扫全部会话 | 只折叠变更的 10 个（~2.4 ms） |
| 冷启动（一次性） | — | 首次全量折叠 ~154 ms（之后增量） |

`npm run bench` 内置 300 会话 / 4.1 万事件的合成数据基准：**与旧算法逐字段一致性校验通过**（除两项有意的修正：修复了旧版「总时长」恒为 0 的 bug；窗口边界小时内的「活跃时长」为有界近似）。

## 总时长（totalMs）口径

总时长 = 所选窗口内**每个会话「首条消息 → 末条消息」时间跨度的并集**：

- 先按窗口裁剪每个会话的跨度（如「今天」从 00:00 起算，跨天会话只算今天部分）；
- **重叠（并行/后台）会话的时间只计一次**——多个会话同时开着时不会把时间翻倍，因此「今天」的总时长永远不会超过 24 小时；
- 会话之间的间隔不计入；会话内部的思考、看代码等空闲时间计入；
- 趋势图每根柱采用同样的并集口径（逐小时/天去重叠）。

> 注意：`sessionPersistence.readFrom` 对进程内活跃会话返回**完整内存日志**（可能远大于磁盘上的压缩镜像文件），因此重启 DSH 前后同一窗口的数值可能不同——这是 DSH 自身的数据模型（内存为权威、文件为压缩镜像），看板如实反映。

## 安装

前置条件：本机已安装 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-harness)（含 Web GUI）。

### 方式一：本地源码挂载（推荐开发使用）

```powershell
# 1. 构建（生成 lib/）
npm run build

# 2. 链接到 DSH profile 的 node_modules
#    以默认 web profile 为例（junction 链接，包内容实时生效）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\@skkjkk\dsh-usage-dashboard" `
  -Target "D:\path\to\dsh-usage-dashboard"

# 3. 注册插件行：在 profile 的 cordis.patch.yml 中追加（内容见本包 cordis.patch.yml）
#    - insert:
#        - id: usage-dashboard
#          name: '@skkjkk/dsh-usage-dashboard'

# 4. 重启 DSH，打开 设置 → 数据看板
```

> 各插件包经 `@linxin666/dsh-web-ui-all` 聚合安装时，`cordis.patch.yml` 会自动装配。

### 方式二：npm 包（发布后）

```powershell
npm install -g @skkjkk/dsh-usage-dashboard   # 发布后可用
```

## 使用说明

1. 打开 DSH Web GUI → 右上角「设置」→ 侧边栏「数据看板」
2. 选择时间范围（今天 / 24H / 7D / 30D / 90D / 自定义）
3. 可按模型、项目筛选，点击 KPI 卡片可切换 ¥ / $ 与中文 / 国际单位
4. 悬停趋势柱 / 热力格 / 日历格可查看明细

## 数据与隐私

- 所有聚合**仅在本机**进行，数据来自 DSH 本地会话存储，不向任何外部服务发送数据。
- 费用为**估算值**：以内置定价表（CSV 美元价 ×7 折算人民币）与各会话 token 用量相乘得出，与真实账单可能存在差异。
- 定价表位于 `src/host.js` 的 `PRICES` 常量，欢迎提交新模型的定价 PR。

## 开发

```powershell
npm run build   # 从 src/ 重新生成 lib/（scripts/regenerate.cjs）
```

```
dsh-usage-dashboard/
├── src/                  # 源码（修改入口）
│   ├── core/rollup.js    #   纯函数聚合引擎：会话摘要折叠 + 查询（定价表在此）
│   ├── host.js           #   Host 半胶水层：增量加载、缓存、路由
│   └── client.js         #   Client 半：React UI + 图表渲染
├── lib/                  # 构建产物（插件实际加载的文件）
│   ├── index.js          #   Host 半 bundle
│   ├── core/rollup.js    #   聚合引擎（原样拷贝）
│   └── client.js         #   Client 半 bundle（UMD）
├── scripts/
│   ├── regenerate.cjs    # 构建脚本：src → lib 适配转换
│   └── bench.js          # 正确性 + 性能基准（npm run bench）
├── cordis.patch.yml      # DSH bundle 插件注册补丁
└── package.json
```

## 开源协议

[Apache License 2.0](./LICENSE)

## 免责声明

本项目与 DeepSeek 官方无任何关联，为个人维护的开源插件。费用估算结果仅供参考。
