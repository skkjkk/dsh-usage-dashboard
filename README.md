# dsh-usage-dashboard

> 面向 DSH（DeepSeek Harness）Web GUI 的本地用量数据看板：Token、费用、时长与会话明细，全部在本机聚合，不上传任何会话内容。

🌐 语言 / Language: **[English](README.en.md)** · 中文

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`dsh-usage-dashboard` 是一个 DSH **bundle 插件**。它直接读取 DSH 本地会话数据，在 **设置 → 数据看板** 中提供 Token、费用、时长和会话明细统计。所有聚合都在本机完成，**不会向外部服务发送任何会话内容**。

## 功能特性（附截图）

看板覆盖从总览到明细的多层视角，下面四张截图对应核心界面。

### 1. KPI 总览与每小时趋势

![KPI 总览与每小时趋势](picture/Snipaste_2026-08-19_21-28-02.png)

顶部是一组 **KPI 卡片**：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、消息数等，并带环比百分比（基线为零时自动隐藏，避免伪造的 `+100%`）。

下方是 **每小时趋势图**：按小时展示输出 / 输入 / 缓存 Token（也可切换为费用或时长），三段堆叠，点击图例或柱子可高亮单一系列；时间范围可在 `今天 / 24H / 7D / 30D / 90D / 自定义` 间切换，并支持按模型、按项目过滤。

### 2. 每日趋势与分时活跃热力图

![每日趋势与分时活跃热力图](picture/Snipaste_2026-08-19_21-28-49.png)

左侧为 **每日趋势**（天粒度柱状图），右侧为 **分时活跃热力图**：一张 `7 行（周几）× 24 列（小时）` 的网格，颜色深浅表示强度，可在 `Token / 费用 / 活跃时长` 三种指标间切换；悬停任意单元格显示精确数值，图例为 `少 → 多`。

### 3. 模型分布与项目分布

![模型分布与项目分布](picture/Snipaste_2026-08-19_21-29-29.png)

两张 **环形图** 分别从 Token（或费用）占比视角拆解用量：

- **模型分布**：按模型列出 Token / 费用占比与绝对值，总量守恒。
- **项目分布**：按项目（基于会话 `cwd` 与 DSH workspace 归属）聚合用量，总量守恒。

### 4. 活跃热力图与详细记录

![活跃热力图与详细记录](picture/Snipaste_2026-08-19_21-29-53.png)

顶部是 **活跃热力图**：最近 40 周的 `7 行 × 40 列` 日历网格，单元格固定为正方形并带圆角，边缘日期的 tooltip 会自动限制在视口内，不会被卡片裁剪。

下方是 **详细记录表**：按「时间桶 × 模型 × 项目」分组，分页展示（每页 20 条，同一小时用多个模型时分别成行），列含 `时间 / 项目 / 模型 / 工具 / 输入 / 输出 / 缓存 / 费用`。

## 数据口径

- **Token** = 输入 Token + 输出 Token + 缓存 Token。
- **活跃时长** 只累计 AI 实际生成内容的时间：从首个 `assistant/chunk` 到该 turn 完成；不包含排队、首 Token 延迟、思考间隔或工具等待。并行会话分别累计，因此活跃时长可能超过 24 小时。
- **总时长** 是每个会话首条消息到末条消息的时间跨度；重叠的并行会话区间先合并，再按所选窗口裁剪后求和，不会重复计算重叠时间。
- **费用** 是估算值，价格来自本仓库的定价表（`pricing/vibe-usage-model-pricing.csv`），按美元价格 ×7 折算人民币；未匹配的模型暂不计费。DeepSeek V4 在定价生效后按北京时间高峰 / 空闲时段计费。
- **项目** 优先使用会话 header 中的 canonical `cwd`，再结合 DSH workspace membership 回填；路径分隔符、大小写和尾部斜杠会统一后再分组。
- 环比基线为零时没有有限百分比，界面会隐藏该百分比，不显示伪造的 `+100%`。

## 安装

推荐使用 DSH CLI。它会安装包，并根据包内的 `dsh.bundle.patch` 自动把插件加入 profile bundle 列表：

```bash
dsh plugin --profile web add @skkjkk/dsh-usage-dashboard
```

安装完成后重启 DSH，打开 **设置 → 数据看板**。

没有 `dsh` CLI 时，也可以手动安装：

```bash
pnpm --dir ~/.dsh/profiles/web add @skkjkk/dsh-usage-dashboard
```

然后在 profile 的 `package.json` 中确认插件位于 `dsh.profile.bundles`：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@skkjkk/dsh-usage-dashboard"]
    }
  }
}
```

卸载：

```bash
dsh plugin --profile web remove @skkjkk/dsh-usage-dashboard
```

## 开发与验证

源码位于 `src/`，DSH 实际加载的产物位于 `lib/`。请修改 `src/` 后重新构建，不要直接编辑 `lib/`：

```bash
npm install
npm run build
npm run bench
node scripts/smoke-host.mjs
npm test
```

`npm test` 会依次执行构建、引擎基准与正确性检查、host 路由 smoke test。测试覆盖：

- Token、费用、消息数和日历聚合的一致性；
- `foldAppend` 与完整 `foldSession` 的增量等价性；
- 活跃时长、总时长并集和窗口边界；
- 模型 / 项目分布与总 Token、总费用守恒；
- `/dash-api/usage`、`/dash-api/detail`、`/dash-api/calendar` host 路由。

发布前可验证 npm 包内容：

```bash
npm pack
# 将生成的 tgz 解压到 <package-dir> 后执行
node scripts/verify-pack.mjs <package-dir>
```

验证脚本会检查 host、core、client 是否可加载，定价 CSV、bundle patch 和 package files 是否齐全，并扫描 npm 包中是否残留个人数据。

## 实时性与性能

插件启动时为每个会话建立一次内存 rollup。DSH 后续通过 `session/event` 增量更新对应会话，查询直接在内存中完成；事件到达会使请求缓存失效。每 60 秒执行一次 reconcile，用于发现新会话、删除已移除会话并处理异常恢复。

## 隐私

- 所有聚合均在本地执行，不向外部服务发送会话数据。
- npm 包只包含 `lib/` 与 bundle patch，不包含本机日志或会话文件。
- 费用是估算值，不代表实际账单。

## 版本

当前发布版本：`0.3.7`

## License

Apache-2.0
