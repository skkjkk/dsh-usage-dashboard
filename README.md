# dsh-usage-dashboard

> DSH (DeepSeek Harness) usage statistics dashboard — token / cost / duration / session aggregation with trend, heatmap and calendar views.

为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/DeepSeek-harness) Web GUI 打造的**用量数据看板**插件：聚合本地会话数据，在设置面板「数据看板」中展示 Token / 费用 / 时长的趋势、热力图、日历与明细。

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

## 功能特性

- **KPI 总览**：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、消息数；每项带环比百分比（今天 / 24H / 7D / 30D / 90D / 自定义均支持）
- **趋势图**：按 Token / 费用 / 时长三种模式查看，输出 / 输入 / 缓存分段着色，图例可开关，点击柱子高亮
- **分时活跃热力图**：一周 7×24 小时分布，Token / 费用 / 时长三种指标，悬停显示精确数值
- **活跃热力图**：53 周 × 7 天网格，8 阶色阶，悬停显示「x年x月x日：xxx tokens」
- **分布统计**：模型分布、项目分布环形图，悬停联动高亮（对应色段保持、其余变暗）
- **明细记录**：按时间桶 × 模型 × 项目分行统计（同一小时两个模型 → 两条），每页 20 条分页浏览
- **时间范围**：今天 / 24H / 7D / 30D / 90D / 自定义起止日期
- **筛选**：按模型、项目过滤，一键清除
- **费用估算**：计费标准来自 `pricing/vibe-usage-model-pricing.csv`（203 个主流模型，美元价 ×7 折算人民币），未收录模型不计费；支持 ¥ / $ 切换、中文 / 国际单位切换
- **总时长口径**：每个会话「首条消息 → 末条消息」时间跨度的并集——重叠（并行）会话只计一次，今天 / 24H 总时长不会超过 24 小时
- **性能**：会话摘要物化 + revision 增量加载，查询毫秒级，首次折叠后不再触碰磁盘

## 安装

一条命令安装（推荐，会自动把插件注册进 profile 的 bundle 列表）：

```bash
dsh plugin --profile web add @skkjkk/dsh-usage-dashboard
```

> `dsh plugin` 会执行 pnpm 安装，并检测到包声明了 `dsh.bundle`（自带 `cordis.patch.yml` 自注册行），自动将其追加到 profile `package.json` 的 `dsh.profile.bundles` —— **不需要手动编辑 cordis.yml / cordis.patch.yml**。

没有 `dsh` CLI 时手动安装：

```bash
# 1. 安装到 DSH profile（默认 web）
pnpm --dir ~/.dsh/profiles/web add @skkjkk/dsh-usage-dashboard

# 2. 在 profile 的 package.json 的 dsh.profile.bundles 数组里追加包名
"dsh": { "profile": { "bundles": [..., "@skkjkk/dsh-usage-dashboard"] } }
```

重启 DSH，打开 **设置 → 数据看板** 即可使用。

## 数据与隐私

- 所有聚合均在本地完成，不上传任何会话数据；
- 费用为估算值：`pricing/vibe-usage-model-pricing.csv` 中的美元单价 ×7 折算人民币；
- 总时长依赖 DSH 会话日志：进程内活跃会话读到的是完整内存日志，重启后回落到磁盘日志，同一窗口的数值可能不同——这是 DSH 自身的数据模型。

## License

Apache-2.0
