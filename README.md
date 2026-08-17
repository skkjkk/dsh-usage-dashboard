# dsh-usage-dashboard

> 面向 DSH (DeepSeek Harness) Web GUI 的本地用量数据看板。

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`dsh-usage-dashboard` 是一个 DSH bundle 插件。它直接读取 DSH 本地会话数据，在 **设置 → 数据看板** 中提供 Token、费用、时长和会话明细统计。所有聚合都在本机完成，不会上传会话内容。

## 功能

- **KPI 总览**：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、消息数。
- **时间范围与筛选**：今天、24H、7D、30D、90D、自定义日期；支持按模型和项目过滤。
- **趋势图**：按小时、天或周查看 Token、费用、时长；Token 可分别切换输入、输出和缓存分段，点击柱子可高亮查看。
- **分时活跃热力图**：7×24 小时网格，支持 Token / 费用 / 活跃时长三种指标，悬停显示精确数值。
- **活跃热力图**：最近 40 周的 `7 行 × 40 列` 日历网格，单元格固定为正方形并带圆角；边缘日期的 tooltip 会自动限制在视口内，不会被卡片裁剪。
- **Token 色阶**：日 Token 档位为 `0 / ≥1M / ≥10M / ≥30M / ≥60M / ≥100M / ≥200M / ≥250M`，图例色块悬停可查看对应阈值。
- **模型与项目分布**：环形图展示 Token 或费用占比，项目聚合与总 Token / 费用守恒。
- **详细记录**：按「时间桶 × 模型 × 项目」分组，每页 20 条；同一小时使用多个模型时分别列出。
- **舒适字体**：数字和英文字母优先使用系统自带的 `Century Gothic`，中文按系统字体回退，适合长时间查看数据。

## 数据口径

- **Token** = 输入 Token + 输出 Token + 缓存 Token。
- **活跃时长**只累计 AI 实际生成内容的时间：从首个 `assistant/chunk` 到该 turn 完成；不包含排队、首 Token 延迟、思考间隔或工具等待。并行会话分别累计，因此活跃时长可能超过 24 小时。
- **总时长**是每个会话首条消息到末条消息的时间跨度；重叠的并行会话区间先合并，再按所选窗口裁剪后求和，不会重复计算重叠时间。
- **费用**是估算值，价格来自 [`pricing/vibe-usage-model-pricing.csv`](pricing/vibe-usage-model-pricing.csv)，按美元价格 ×7 折算人民币；未匹配的模型暂不计费。DeepSeek V4 在定价生效后按北京时间高峰 / 空闲时段计费。
- **项目**优先使用会话 header 中的 canonical `cwd`，再结合 DSH workspace membership 回填；路径分隔符、大小写和尾部斜杠会统一后再分组。
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
- npm 包只包含 `lib/`、定价 CSV 和 bundle patch，不包含本机日志或会话文件。
- 费用是估算值，不代表实际账单。

## 版本

当前发布版本：`0.3.5`

## License

Apache-2.0
