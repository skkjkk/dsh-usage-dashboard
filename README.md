# dsh-usage-dashboard

> 面向 DSH（DeepSeek Harness）Web GUI 的本地用量看板：Token、费用、时长与会话明细，全部在本机聚合，不上传任何会话内容。

🌐 语言 / Language: **[English](README.en.md)** · 中文

[![npm](https://img.shields.io/npm/v/%40skkjkk%2Fdsh-usage-dashboard)](https://www.npmjs.com/package/@skkjkk/dsh-usage-dashboard) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE) [![Changelog](https://img.shields.io/badge/changelog-CHANGELOG.md-blue.svg)](CHANGELOG.md)

`dsh-usage-dashboard` 是一个 DSH **bundle 插件**。它直接读取 DSH 本地会话数据，在 **设置 → 数据看板** 中提供用量统计。所有聚合都在本机完成，**不会向外部服务发送任何会话内容**。

交互参考 VibeCafe.ai 的 Vibe Usage，提供指标切换、分布 hover 与明细浏览；统计与聚合完全在本地完成。

![筛选器与 KPI 总览](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/dashboard-overview.png)

## 功能

### 筛选与时间范围

顶部筛选器支持时间范围 `今天 / 24H / 7D / 30D / 90D / 自定义`（自定义可填起止日期）；**模型筛选为多选、按厂商分组**（可展开勾选具体模型，选中后按钮显示「N项」）；项目下拉可选单个项目；有筛选时可一键**清除**。所选范围、筛选与显示偏好保存在本地（`localStorage`），重开设置或重载插件后仍保留。数据刷新期间显示「统计中」。

### KPI 总览

共 **9 张**指标卡片：预估费用、总 Token、输入 / 输出 / 缓存 Token、活跃时长、总时长、会话数、总消息数、用户消息数。每张卡片带相对上一周期的**环比百分比**（基线为零时隐藏）。

- 点击**费用卡片**在 ¥ / $ 间切换；点击**总 Token 或缓存 Token 卡片**在国际单位（K/M/B）与中文单位（万 / 亿）间切换，四个 Token 卡片共用同一单位。
- **选择模型筛选后，时长与会话类卡片自动收起，仅保留费用与 Token 五项**。
- 「预估费用」「活跃时长」「总时长」标题旁的 ⓘ 可展开说明弹窗（定价覆盖与峰谷规则、两种时长口径差异）。

### 趋势图

随所选范围自动切换粒度：**今天 / 24H 为每小时，7D / 30D 为每日，90D 为每周**（自定义范围按跨度：≤48 小时用小时、≤62 天用天，更长用周）。可在 **Token / 费用 / 时长** 三种口径间切换：

- **Token**：输出 / 输入 / 缓存分段堆叠，图例可单独显隐；
- **费用**：按桶汇总的估算费用；
- **时长**：区分活跃时长与总时长，图例同样可单独显隐。

点击任意柱子高亮该项（其余变淡），再次点击空白处取消；悬停查看明细。X 轴标签按固定步长标注（今天每 3 小时一格、30D 每 4/5 天一格、90D 每 2 周一格）。

![每日趋势与分时活跃热力图](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/trend-heatmap.png)

### 分时活跃热力图

`7 行（周几）× 24 列（小时）` 网格，可在 **Token / 费用 / 时长** 三种指标间切换；悬停任意单元格显示精确数值与时刻，图例为 `少 → 多`。（上图下半部分即为此图。）

### 模型分布与项目分布

两张**环形图**分别从 Token（或费用）视角拆解用量：**模型分布**按模型拆分，**项目分布**按项目（基于会话 `cwd` 与 DSH workspace 归属）拆分。可在 Token / 费用间切换；占比前 **6** 项各有固定配色，其余聚合为「其他」，总量守恒。悬停图例项或扇区时，其余项与扇区变淡，圆环中心切换为当前项的 Token 与费用摘要。

![模型分布与项目分布](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/distributions.png)

### 活跃热力图（日历）

最近 **40 周**的 `7 行 × 40 列` 日历网格，单元格固定为正方形并带圆角；按每日 Token 量分 **8 档**着色（`无 Token / ≥1M / ≥10M / ≥30M / ≥60M / ≥100M / ≥200M / ≥250M`）。边缘日期的浮动 tooltip 自动限制在视口内。

### 详细记录

按「时间桶 × 模型 × 项目」分组的明细表，列为 `时间 / 项目 / 模型 / 工具 / 输入 / 输出 / 缓存 / 费用`（工具列固定为 `dsh`）；同一小时用多个模型时分别成行。分页展示（每页 **20** 条），右上角显示「显示 x–y 条，共 z 条」，底部可翻页。

![活跃热力图与详细记录](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/calendar-records.png)

### 模型效能雷达

**六轴雷达图**，展示当前筛选窗口内**调用量前 4** 的模型。各维度使用固定外圈基准值归一化到 0–1，因此不同时间窗口之间可直接比较。方向统一：**越靠外圈越好**。

| 维度 | 含义 | 外圈 | 中心 |
| --- | --- | --- | --- |
| 响应速度 | 一次请求通常要等多久（P50） | 1 s | 120 s |
| 输出速度 | 每秒吐出多少 tokens | 166 t/s | 1 t/s |
| 平均输出量 | 平均每次回复写多少 tokens | 1,645 tok/次 | 50 tok/次 |
| 平均输入量 | 平均每次读入多少计费输入 tokens | 29.4 万 tok/次 | 5,000 tok/次 |
| 稳定性 | 最慢的 5% 请求比典型请求慢几倍（P95/P50） | 慢 ≤8.3 倍 | 慢 125 倍 |
| 实际单价 | 每百万 tokens 实际花多少钱（全口径反向） | ¥0.10/M | ¥2/M |

各维度均使用**双端对数带宽** `log(v / floor) / log(ceil / floor)` 归一化。图上顶点标注**实测真值**（如 `8.0s`、`¥0.09/M`）；右侧为图例（含调用次数）与**标尺行**数值卡——每轴一条细轨道，四个模型的得分落点以小圆点同屏对比，当前模型放大高亮。模型未匹配定价表时，「实际单价」轴留空并标注。

点击雷达上的点或图例项可高亮单个模型（其余变淡）：图例 hover 保持高亮，点击为锁定、再点取消。标题旁 ⓘ 弹窗按轴说明含义与外圈参考值。

### 缓存洞察

一条时间序列 + 一张排行榜，展示所选范围内**每个时间桶**的缓存效率。

- **KPI 条**：窗口命中率（含环比 ▲/▼ pp）、遥测覆盖率、**预计节省**（= 缓存读取 tokens × (输入价 − 缓存价)，跟随 ¥/＄ 切换）。
- **双视图切换**：**命中率**视图（monotone-cubic 平滑曲线、自适应 Y 轴放大到数据带、覆盖率琥珀虚线、均值参考线、末端数值胶囊、无遥测区间浅灰带）与**用量**视图（缓存读取 vs 未命中计费输入堆叠柱）。
- **模型缓存排行**：按读取量排序，条长 = 读取量、琥珀刻度 = 覆盖率、右侧给出命中率与各模型节省额（未定价模型显示「—」，免费模型显示 ¥0）。**点击行 = 按该模型筛选全看板**，再点解除；可展开全部、内部滚动。
- ⓘ 弹窗解释命中率 / 覆盖率 / 节省 / 排行条四个口径。

切换视图带过渡动画（折线描边生长、柱状从基线弹起并错峰、KPI 与图例淡入）。

![模型效能雷达与缓存洞察](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/radar-cache.png)

### 深色模式

看板跟随 DSH 的明暗主题：颜色统一由 CSS 变量表驱动（作用域 `body[data-ds-dark-theme]`），图表元素使用图形专用颜色变量，在两种主题下均有足够对比度。

![深色模式下的完整看板](https://raw.githubusercontent.com/skkjkk/dsh-usage-dashboard/main/picture/dashboard-dark.png)

## 数据口径

- **Token** = 输入 Token + 输出 Token + 缓存 Token。
- **活跃时长**只累计 AI 实际生成内容的时间：从请求发出到该 step 回复完成；不包含排队、首 Token 延迟、思考间隔或工具等待。旧版日志带输出分块时从首个分块起算。并行会话分别累计，因此活跃时长可能超过 24 小时。
- **总时长**是每个会话首条消息到末条消息的时间跨度；重叠的并行会话区间先合并（只计一次），再按所选窗口裁剪后求和。
- **费用**是估算值，价格来自本仓库的定价表 `pricing/vibe-usage-model-pricing-extended.csv`（覆盖 **280** 个模型，由构建脚本生成 `lib/core/pricing.js`）；表内单价已直接以人民币元 / 百万 token 计价，无需汇率换算。**未匹配的模型暂不计费**（明细表中显示 ¥0，可在 ⓘ 弹窗查看覆盖率）。模型 id 匹配**不区分大小写**，provider 目录中的 `Qwen3.8-Flash` 等写法按规范价目计费。
- **DeepSeek 峰谷计费**：现行两型号（`deepseek-flash`、`deepseek-v4-pro`）按北京时间计费——工作日高峰为 9:00–12:00 与 14:00–18:00，周末及其余时段为空闲（价格为高峰一半）。V4.1 Flash 新价自 2026-09-10 12:00 起生效，V4 Pro 自 2026-09-14 12:00 起路由到 Flash 计费；已下线的旧名与第三方转售商变体名按 Flash 计费，峰谷价生效前的历史事件按当时的静态价计算。
- **项目**优先使用会话 header 中的 canonical `cwd`，再结合 DSH workspace membership 回填；路径分隔符、大小写和尾部斜杠会统一后再分组。
- **统计范围**：仅统计普通会话。子代理会话（header 中 `delegationDepth > 0` 或含 `parentSession`）与旧布局的裸 `<uuid>` 目录不计入，因此看板的会话数少于 `~/.dsh/sessions` 下的目录总数。无法读取的日志（格式迁移失败、文件损坏）会被跳过。
- **缓存命中率** = `cacheRead / cacheObserved × 100%`：
  - **`cacheRead`** = provider 显式报告的 `usage.cacheReadTokens` 之和。
  - **`cacheObserved`** = provider 报告了 `cacheReadTokens` 或 `cacheWriteTokens` 的行，取这些行的 `inputTokens + cacheRead + cacheWrite` 之和（即带 telemetry 的计费输入）。未报告的行不计入分母。
  - **`billedInput`** = 全窗口 `inputTokens + cacheTokens` 之和，包含未提供 telemetry 的行。
  - **缓存数据覆盖率** = `cacheObserved / billedInput × 100%`；无 telemetry 时覆盖率为 0%，命中率显示「—」。
- 环比基线为零时，界面隐藏该百分比。

## 系统要求

| 项 | 要求 |
| --- | --- |
| DSH | `0.1.3-alpha.2` 及以上（已在 `0.2.0-rc.1` 上验证） |
| Node.js | `>=18`（`package.json` 的 `engines` 声明） |
| 运行环境 | DSH Web / Desktop GUI（客户端半边注册为 `settings.section`） |

插件通过特性探测适配不同 DSH 版本：`sessionPersistence` 可用时直读单会话日志（快路径），否则回退到 `sessionQuery.listSessions`；`timer` 服务缺失时仅周期 reconcile 与预热降级，HTTP 路由不受影响。完整能力矩阵、rc.1 → rc.2 差异与升级例行程序见 [COMPAT.md](COMPAT.md)。

## 安装

### 方式一：DSH 设置界面添加插件（推荐）

打开 DSH 设置，找到插件管理入口，点击「添加插件」，在输入框中填入以下任一内容：

| 来源 | 填写内容 | 示例 |
| --- | --- | --- |
| 包名 | npm 包名 | `@skkjkk/dsh-usage-dashboard` |
| GitHub 仓库 | 仓库地址 | `https://github.com/skkjkk/dsh-usage-dashboard` |
| 本地目录 | 绝对路径 | `D:\path\to\dsh-usage-dashboard` |

右上角「安装源」可选择 npm 源（默认 / 中国大陆镜像源）。安装完成后重启 DSH，打开 **设置 → 数据看板**。

### 方式二：使用 DSH CLI

```bash
# 从 npm 安装
dsh plugin --profile web add @skkjkk/dsh-usage-dashboard

# 从 GitHub 安装（开发版本）
dsh plugin --profile web add "github:skkjkk/dsh-usage-dashboard#main"

# 从本地目录安装（开发调试）
dsh plugin --profile web add link:/path/to/dsh-usage-dashboard
```

### 方式三：手动安装

没有 `dsh` CLI 时，可以手动安装：

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

### 卸载

```bash
dsh plugin --profile web remove @skkjkk/dsh-usage-dashboard
```

### 查看插件信息

```bash
# 查看插件依赖关系
dsh plugin --profile web why @skkjkk/dsh-usage-dashboard
```

## HTTP 接口

host 半边在 DSH 的 web server 上注册三条只读 JSON GET 路由（返回本地聚合结果，不含会话原文）：

| 路由 | 说明 | 主要参数 |
| --- | --- | --- |
| `GET /dash-api/usage` | KPI 总计 + 趋势桶 + 热力图 + 模型/项目分布 + 定价覆盖 | `range`、`from`、`to`、`models`、`projects` |
| `GET /dash-api/detail` | 明细行（按「时间桶 × 模型 × 项目」分组） | 同上 + `offset`、`limit`（上限 **200**，默认 100） |
| `GET /dash-api/calendar` | 日历热力图逐日 Token | `models`、`projects`、`now` |

`range` 取 `today / 24h / 7d / 30d / 90d / custom`（缺省 `today`）；`custom` 需配合 `from` / `to`（epoch 毫秒）。`models` / `projects` 为逗号分隔的多值参数。响应形如：

```jsonc
// /dash-api/usage
{ "totals": { "cost": 0, "totalTokens": 0, "sessions": 0, "cacheHitRate": null, ... },
  "buckets": [{ "label": "9/26", "input": 0, "output": 0, "cache": 0, "costIn": 0, ... }],
  "granularity": "day",
  "heat": { "token": [], "cost": [], "dur": [], "active": [] },
  "meta": { "models": [], "projects": [], "vendors": {}, "pricing": {}, "dist": {} } }
```

请求级缓存为 30 秒 TTL + stale-while-revalidate + 单飞，重复调用为毫秒级。这些路由不经过 DSH GUI 的会话鉴权，可直接访问（端口为 DSH 实例实际监听的端口）：

```bash
curl -s "http://127.0.0.1:<port>/dash-api/usage?range=7d" | head -c 200
```

## 配置

可选的 `debugCache` 开关用于诊断磁盘 rollup 缓存，开启后向 stderr 输出 `[dash-cache]` / `[dash-pending]` / `[dash-load]` / `[dash-event]` 诊断行。在 profile 的 `cordis.patch.yml` 中以 **id 定向覆盖**的形式添加 `config`（该形式覆盖既有行，无需 `insert:` 包裹）：

```yaml
- id: usage-dashboard
  name: "@skkjkk/dsh-usage-dashboard"
  config:
    debugCache: true
```

> 同一文件内 `id` 重复会导致 DSH 启动失败（`duplicate loader entry id`）。

默认关闭。

## 开发与验证

源码位于 `src/`，DSH 加载的产物位于 `lib/`。修改 `src/` 后需重新构建，不要直接编辑 `lib/`：

```bash
npm install
npm run build      # node scripts/regenerate.cjs：把 src/ 适配为 lib/
npm run bench      # 引擎正确性与性能基准
npm run smoke      # build + host 冒烟测试
npm test           # build + bench + host smoke
```

`npm test` 覆盖：

- Token / 费用 / 消息数 / 日历聚合一致性，以及 `foldAppend` 与完整 `foldSession` 的**增量等价性**（逐字节一致）；
- 活跃时长与总时长的并集 / 窗口边界语义、`totalMs` 的并行会话去重；
- 模型 / 项目分布与总 Token / 总费用守恒、缓存命中率各口径（`cacheRead` / `cacheObserved` / `billedInput`）的守恒；
- 定价取用：DeepSeek 峰谷边界与生效日、变体名归一、模型 id 大小写不敏感、原型键处理；
- `/dash-api/usage`、`/dash-api/detail`、`/dash-api/calendar` 三条 host 路由，以及 client bundle 的 **slot 注册契约**。

发布前可验证 npm 包内容：

```bash
npm pack
# 将生成的 tgz 解压到 <package-dir> 后执行
node scripts/verify-pack.mjs <package-dir>
```

验证脚本检查 host / core / client 是否可加载、bundle patch 与 `package.files` 是否齐全，并扫描包中是否残留个人数据。

`scripts/capture-screenshots.mjs` 用于生成 README 截图：以真实的 `lib/client.js` 配合 `/dash-api/*` 数据在无头 Chromium 中渲染，并按卡片裁剪。

## 实时性与性能

- **纯聚合引擎** `src/core/rollup.js`：`foldSession` 把一次会话折叠为按小时分桶的紧凑 rollup，`foldAppend` 以单事件增量更新（与全量重算字节级一致），`queryUsage / queryDetail / queryCalendar` 在内存中回答任意窗口与筛选。
- **事件驱动刷新**：启动时为每个会话建立一次内存 rollup（活跃会话直接读内存中的会话对象，持久化会话经 `persistence.readFrom` 读取一次）；之后 `session/event` 事件经 `foldAppend` 增量写入，刷新时不重新解析完整日志。每 60 秒一次 reconcile 发现新 / 移除的会话。
- **磁盘 rollup 缓存**（`~/.dsh/usage-dashboard-cache/<sessionId>.json`，按日志文件 `mtime + size` 失效）：DSH 重启后未变化的会话直接采纳缓存，无需重新解码。缓存格式带版本号，定价或口径变更时整体失效重算。
- **请求缓存**：30 秒 TTL + stale-while-revalidate + 单飞；流式事件只递增数据版本，不清空缓存。启动后约 150ms 预热，此后任意视图均为毫秒级返回。客户端每 30 秒轮询一次。

## 隐私

- 所有聚合均在本地执行，不向外部服务发送会话数据。
- npm 包只包含 `lib/` 与 bundle patch；定价由生成的 `lib/core/pricing.js` 提供，原始 `pricing/` 目录不进包，也不含本机日志或会话文件。
- 费用是估算值，不代表实际账单。

## 已知限制

- **仅统计普通会话**：子代理会话（`delegationDepth > 0` / `parentSession`）与旧布局裸 `<uuid>` 目录不计入，因此会话数少于 `~/.dsh/sessions` 的目录总数。
- **费用为估算值**：单价来自本地定价表，未匹配的模型不计费（显示 ¥0），看板费用通常低于上游实际账单；缓存「预计节省」同样按表内价目估算。
- **首次冷启动需要时间**：全库首次折叠在后台进行（启动后约 150ms 触发）。命中磁盘缓存时重启为秒级；缓存缺失或因定价 / 口径变更失效时，需重新折叠全部会话（大库为分钟级）。
- **无法读取的日志会被跳过**：格式迁移失败或文件损坏的日志不重试，个别历史会话可能不出现在看板中。
- **活跃时长按生成区间累计**，并行会话分别累加，因此可能超过 24 小时；它衡量的是模型生成占用，不是墙钟时间。
- **`totalMs` 为区间并集**：重叠的并行会话只计一次，窗口边缘按事件级精确裁剪，跨桶边界的情形为近似值。

## 版本

当前发布版本：`0.3.13`（变更记录见 [CHANGELOG.md](CHANGELOG.md)）

## 扩展与定制

本项目鼓励你用 AI 辅助开发来按需增减功能。无论是删掉不关心的 KPI 卡片、增加新的图表维度，还是接入你自己的定价表——直接把需求告诉 AI，让它帮你改代码、跑测试、出构建产物。

几个常见方向：

- **删减卡片**：不用的指标卡直接在 `src/client.js` 的 `cards2` 数组中移除对应项即可
- **新增图表**：在 `src/client.js` 中追加一个 section，调用已有的 `/dash-api/usage` 数据
- **自定义定价**：编辑 `pricing/vibe-usage-model-pricing-extended.csv` 后 `npm run build` 即可生效
- **接入其他数据源**：host 半边的 `src/core/rollup.js` 是纯聚合引擎，可以 fork 后替换事件源

源码结构清晰（`src/core/rollup.js` 聚合、`src/host.js` 路由、`src/client.js` 界面），`npm test` 覆盖核心逻辑，适合 AI 直接上手改。欢迎提交 PR 分享你的定制版本。

## License

Apache-2.0