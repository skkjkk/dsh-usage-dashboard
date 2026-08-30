# dsh-usage-dashboard

> 面向 DSH（DeepSeek Harness）Web GUI 的本地用量数据看板：Token、费用、时长与会话明细，全部在本机聚合，不上传任何会话内容。

🌐 语言 / Language: **[English](README.en.md)** · 中文

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE) · [更新日志](CHANGELOG.md)

`dsh-usage-dashboard` 是一个 DSH **bundle 插件**。它直接读取 DSH 本地会话数据，在 **设置 → 数据看板** 中提供用量统计。所有聚合都在本机完成，**不会向外部服务发送任何会话内容**。

交互设计参考 VibeCafe.ai 的 Vibe Usage：这是面向本地 DSH 用量的看板，保留类似的指标切换、分布 hover 与明细浏览体验；所有统计与聚合均在本地完成，不上传会话内容或派生数据。

## 功能

### 筛选与时间范围

看板顶部是一排筛选器：时间范围可在 `今天 / 24H / 7D / 30D / 90D / 自定义` 间切换（自定义可填起止日期）；**模型筛选为多选且按厂商分组**（可展开勾选具体模型，选中后仅显示「模型 N 项」而不列出名称）；项目下拉可选单个项目；有筛选时可一键清除。所选范围、筛选与显示偏好会**缓存在本地**（localStorage），重开设置或重载插件后仍保留。数据刷新期间显示「统计中」。

### KPI 总览

一组指标卡片，覆盖：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、总消息数、用户消息数。每张卡片带相对上一周期的**环比百分比**（基线为零时自动隐藏，避免伪造的 `+100%`），数值带平滑过渡动画。点击**费用卡片**可在 ¥ / $ 间切换；点击 **Token 卡片**可在国际单位（K/M/B）与中文单位（万 / 亿）间切换。**选择模型筛选后，时长与会话类卡片会自动收起，仅保留费用与 Token 五项**，让对比更聚焦。

![KPI 总览与每小时趋势](picture/Snipaste_2026-08-19_21-28-02.png)

### 趋势图

随所选范围自动采用**小时 / 天 / 周**粒度（今天与 24H 为每小时趋势，7D/30D/90D 为每日趋势，更长范围为每周趋势）。可在 **Token / 费用 / 时长** 三种口径间切换；Token 口径下输出 / 输入 / 缓存分段堆叠，图例可单独显隐；时长口径区分活跃时长与总时长。点击任意柱子可高亮该项（其余变淡），悬停查看明细。

![每日趋势与分时活跃热力图](picture/Snipaste_2026-08-19_21-28-49.png)

### 分时活跃热力图

一张 `7 行（周几）× 24 列（小时）` 的网格，颜色深浅表示强度，可在 **Token / 费用 / 活跃时长** 三种指标间切换；悬停任意单元格显示精确数值，图例为 `少 → 多`。（上图右侧即为此图。）

### 模型分布与项目分布

两张**环形图**分别从 Token（或费用）占比视角拆解用量：**模型分布**按模型拆分，**项目分布**按项目（基于会话 `cwd` 与 DSH workspace 归属）拆分。可在 Token / 费用间切换；占比前 6 项各有固定配色，其余聚合为「其他」（不显示具体名称），总量守恒。悬停模型 / 项目（含「其他」聚合项）或对应扇区时，其他图例与扇区变淡，圆环中心会切换为当前项的 Token 与费用摘要：Token 模式中心只显示当前项的 K/M/B 缩写 Token，费用模式中心只显示当前项的人民币费用；右侧图例仍显示精确 Token / 费用与占比。

![模型分布与项目分布](picture/Snipaste_2026-08-19_21-29-29.png)

### 活跃热力图（日历）

最近 **40 周**的 `7 行 × 40 列` 日历网格，单元格固定为正方形并带圆角；按每日 Token 量分档着色（`0 / ≥1M / ≥10M / ≥30M / ≥60M / ≥100M / ≥200M / ≥250M`），边缘日期的浮动 tooltip 自动限制在视口内。

![活跃热力图与详细记录](picture/Snipaste_2026-08-19_21-29-53.png)

### 详细记录

按「时间桶 × 模型 × 项目」分组的明细表，列含 `时间 / 项目 / 模型 / 工具 / 输入 / 输出 / 缓存 / 费用`（工具固定为 `dsh`）；同一小时用多个模型时分别成行。分页展示（每页 20 条），显示「显示 x–y 条，共 z 条」，可翻页。（上图下方即为此表。）

## 数据口径

- **Token** = 输入 Token + 输出 Token + 缓存 Token。
- **活跃时长** 只累计 AI 实际生成内容的时间：从首个 `assistant/chunk` 到该 turn 完成；不包含排队、首 Token 延迟、思考间隔或工具等待。并行会话分别累计，因此活跃时长可能超过 24 小时。
- **总时长** 是每个会话首条消息到末条消息的时间跨度；重叠的并行会话区间先合并，再按所选窗口裁剪后求和，不会重复计算重叠时间。
- **费用** 是估算值，价格来自本仓库的定价表 `pricing/vibe-usage-model-pricing.csv`（覆盖 204 个模型，由构建脚本生成 `lib/core/pricing.js`），按美元价格 ×7 折算人民币；未匹配的模型暂不计费。DeepSeek V4 在 2026-08-17 起按北京时间高峰 / 空闲时段计费（高峰 9:00–12:00、14:00–18:00，空闲为高峰一半）。
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
npm run build      # node scripts/regenerate.cjs：把 src/ 适配为 lib/
npm run bench      # 引擎正确性与性能基准
node scripts/smoke-host.mjs
npm test           # 依次执行 build + bench + host smoke test
```

`npm test` 覆盖：Token / 费用 / 消息数 / 日历聚合一致性、`foldAppend` 与完整 `foldSession` 的增量等价性、活跃时长与总时长的并集 / 窗口边界、模型 / 项目分布与总 Token / 总费用守恒，以及 `/dash-api/usage`、`/dash-api/detail`、`/dash-api/calendar` 三条 host 路由。针对性回归还覆盖边缘桶、无 usage 消息、缓存竞态、session 列表滞后、UTC+8、原型键和超长趋势范围。

发布前可验证 npm 包内容：

```bash
npm pack
# 将生成的 tgz 解压到 <package-dir> 后执行
node scripts/verify-pack.mjs <package-dir>
```

验证脚本会检查 host / core / client 是否可加载、bundle patch 与 `package.files` 是否齐全，并扫描包中是否残留个人数据。

## 实时性与性能

- **纯聚合引擎** `src/core/rollup.js`：`foldSession` 把一次会话折叠为按小时分桶的紧凑 rollup，`foldAppend` 以单事件增量更新（与全量重算字节级一致），`queryUsage / queryDetail / queryCalendar` 在内存中回答任意窗口与筛选。
- **事件驱动刷新**：启动时为每个会话建立一次内存 rollup（活跃会话直接读内存中的会话对象，持久化会话经 `persistence.readFrom` 读取一次）；之后 `session/event` 事件经 `foldAppend` 增量写入，刷新时不再重新解析完整日志。每 60 秒一次 reconcile 发现新 / 移除的会话。
- **请求缓存**：30 秒 TTL + 陈旧仍可复用（stale-while-revalidate）+ 单飞（single-flight），新事件到达即失效。启动后约 500ms 预热，此后任意视图均在毫秒级返回。

## 隐私

- 所有聚合均在本地执行，不向外部服务发送会话数据。
- npm 包只包含 `lib/` 与 bundle patch；定价由生成的 `lib/core/pricing.js` 提供，原始 `pricing/` 目录不进包，也不含本机日志或会话文件。
- 费用是估算值，不代表实际账单。

## 版本

当前发布版本：`0.3.9`

## License

Apache-2.0
