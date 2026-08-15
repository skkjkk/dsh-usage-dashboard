# dsh-usage-dashboard

> DSH (DeepSeek Harness) usage statistics dashboard — token / cost / duration / session aggregation with trend, heatmap and calendar views.

为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/DeepSeek-harness) Web GUI 打造的**用量数据看板**插件：聚合本地会话数据，在设置面板「数据看板」中展示 Token / 费用 / 时长的趋势、热力图、日历与明细。

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

## 功能特性

- **KPI 总览**：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、消息数
- **趋势图**：按 Token / 费用 / 时长三种模式查看，输出 / 输入 / 缓存分段着色，支持图例开关
- **周热力图**：一周 7×24 小时分布，Token / 费用 / 时长三种指标
- **日历视图**：按月展示每日用量，月份标签自适应
- **明细记录**：按天聚合的会话明细表（会话数、模型、消息数、Token、费用），支持分页
- **分布统计**：模型分布、项目分布环形图
- **时间范围**：今天 / 24H / 7D / 30D / 90D / 自定义起止日期
- **筛选**：按模型、项目多选过滤，一键清除
- **费用估算**：内置 200+ 主流模型定价表（人民币估算，美元价 ×7 折算），未收录模型不计费；支持 ¥ / $ 切换、中文 / 国际单位切换
- **性能**：服务端 5 分钟缓存 + stale-while-revalidate，切换时间范围秒回

## 架构

```
浏览器 (Client)                          DSH 宿主进程 (Host)
┌─────────────────────┐                 ┌──────────────────────────────┐
│ 设置面板「数据看板」 │  GET /dash-api/ │  /dash-api/usage   总览+趋势  │
│  React + 原生 DOM   │ ───────────────► │  /dash-api/detail  明细记录   │
│  settings.section   │    JSON 桥       │  /dash-api/calendar 日历聚合  │
└─────────────────────┘                 │  sessionQuery / workspace    │
                                        │  registry / sessionPersistence│
                                        └──────────────────────────────┘
```

- **Host 半**（`lib/index.js`）：通过 `webServer` 注册三个 JSON GET 路由，基于本地会话存储（`sessionQuery` / `workspaceRegistry` / `sessionPersistence`）做聚合，内置模型定价表与 5 分钟缓存。
- **Client 半**（`lib/client.js`）：向设置面板注册 `settings.section`（id: `dashboard`，order 30，标签「数据看板」），纯 React（无额外 UI 库）+ 原生 DOM 渲染图表。

## 安装

前置条件：本机已安装 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-harness)（含 Web GUI）。

### 方式一：本地源码挂载（推荐开发使用）

```powershell
# 1. 构建（生成 lib/）
npm run build

# 2. 链接到 DSH profile 的 node_modules
#    以默认 web profile 为例（junction 链接，包内容实时生效）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\@linxin666\dsh-usage-dashboard" `
  -Target "D:\path\to\dsh-usage-dashboard"

# 3. 注册插件行：在 profile 的 cordis.patch.yml 中追加（内容见本包 cordis.patch.yml）
#    - insert:
#        - id: usage-dashboard
#          name: '@linxin666/dsh-usage-dashboard'

# 4. 重启 DSH，打开 设置 → 数据看板
```

> 各插件包经 `@linxin666/dsh-web-ui-all` 聚合安装时，`cordis.patch.yml` 会自动装配。

### 方式二：npm 包（发布后）

```powershell
npm install -g @linxin666/dsh-usage-dashboard   # 发布后可用
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
├── src/                  # 源码（原型源，修改入口）
│   ├── host.js           #   Host 半：聚合逻辑 + 定价表 + 缓存
│   └── client.js         #   Client 半：React UI + 图表渲染
├── lib/                  # 构建产物（插件实际加载的文件）
│   ├── index.js          #   Host 半 bundle
│   └── client.js         #   Client 半 bundle（UMD）
├── scripts/
│   └── regenerate.cjs    # 构建脚本：src → lib 适配转换
├── cordis.patch.yml      # DSH bundle 插件注册补丁
└── package.json
```

## 开源协议

[Apache License 2.0](./LICENSE)

## 免责声明

本项目与 DeepSeek 官方无任何关联，为个人维护的开源插件。费用估算结果仅供参考。
