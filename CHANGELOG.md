# Changelog

All notable changes to `@skkjkk/dsh-usage-dashboard` are documented here.

## [Unreleased]

### 修复

- **provider 目录原样大小写的模型名静默漏计为 ¥0**（用户反馈「Qwen3.8-Flash 的计费并没有执行」）：根因是 `priceFor`/`priceForAt` 只做**精确匹配**，而 CSV 规范名全为小写（`qwen3.8-flash`），事件里的 model id 却来自 provider 目录、大小写不受约束——qoder provider 报的是 `Qwen3.8-Flash`（另有 `MiniMax-M3`）。这类 id 在定价表里明明有价，却走进「未匹配 → 不计费」分支，费用恒为 ¥0，且因为聚合值是 0 而不是 null，**没有任何告警**，只表现为模型分布里多出一行 ¥0。
  - 实测全量日志：`Qwen3.8-Flash` 659 次调用 / 1.02 亿 tokens 被计 ¥0（按 qwen3.8-flash 价目应为 **¥15.66**），`MiniMax-M3` 4 次调用漏计 ¥0.24；定价覆盖率因此卡在 85%。
  - 修复：`priceFor` 在精确匹配后增加**大小写不敏感兜底索引**（`PRICES_LC`/`VENDORS_LC`），`-free` 后缀剥离同步改为不区分大小写；厂商分组（`queryUsage` 的 `vendors`）走同一套兜底，`Qwen3.8-Flash` 现在正确归到 Alibaba 而非「其他」。
  - 兜底索引构建时对**歧义小写形式做剔除**（同一小写对应多个规范名则不进索引，精确名仍可命中），避免把不同型号的价格张冠李戴；`tableKey` 对非字符串 id 先 `String()` 归一（旧日志/测试注入的数字或对象键此前会让 `toLowerCase` 抛 `TypeError`，bench `[0d]` 抓到）；原型键（`toString`/`__proto__` 等）不因兜底而泄漏成「已定价」。
  - **`CACHE_FORMAT_VERSION` 6 → 7**：费用是折叠时烘进 rollup 的，磁盘缓存里已固化的 ¥0 必须随版本失效重算，否则旧会话即使代码修好也仍显示 ¥0。
  - 实测修复后：全量覆盖率 85% → 88%（剩余未匹配项均为 CSV 中确实没有价目的模型，如 `sensenova-6.8-flash-lite`、`step-explore`、`kat-coder-pro-v2.5`），`Qwen3.8-Flash` 计得 ¥15.66。bench 新增 `[0k]` 段做永久回归守卫（8 个 provider 大小写变体 + 原型键 + `-free` 后缀 + 折叠/增量折叠一致性 + 厂商分组）。

- **深色模式下雷达图轴线不可见、缓存卡出现纯白块**（用户截图反馈）：两处根因，均经截图像素采样（Pillow 取色 + WCAG 相对亮度）定量确认，并用无头 Chromium 真实渲染做 A/B 对照。
  - **雷达图六轴与环线隐没**：环线与轴线复用了 UI 边框 token（`--dd-border2/3`），深色值 `#282c33`/`#3a4150` 相对卡片面色 `#1d2025` 的对比度只有 **1.17 / 1.60**（浅色模式对应 `#e9e9ec` / `#d4d4d8` 对白底是 1.21 / 1.48）——数字看着接近，但深色下"边框色当图形色"与卡片底几乎同亮度，实测截图中环线像素 `#262a33` 与底色几乎无法区分。现拆出**图形专用 token**：`--dd-radar-web`（内圈环+辐条，深色 `#414a59`，对比 1.83）、`--dd-radar-ring`（外圈，深色 `#5f6b7c`，对比 3.02）、`--dd-radar-label`（轴名，深色 `#aeb5c0`，对比 7.91，对齐浅色 `#52525b` 对白底的 7.73 观感权重）。浅色回退值逐字不变。
  - **缓存卡无遥测区间变成纯白块**：`gapBands` 的填充是**裸字面量** `fill: '#fafafa'`，从未走主题变量表——与是否有数据无关，任何深色场景都会画出一块 15.65:1 的白色矩形（正是用户说的"没有数据时背景都是白的"）。现 token 化为 `--dd-band`，浅色回退仍为 `#fafafa`（逐像素不变），深色为 `#2b323c`（对比 1.26，与浅色 1.04 同量级的"淡带"语义）。
  - 顺带修正同卡其余图形件：`--dd-grid` 深色 `#1b1f24` 对卡片对比仅 **1.01**（网格线与背景完全同色，实测截图确认），改为 `#3a4250`（1.61）；`--dd-bar-o`（用量视图未命中柱+图例色块）`#3a4150`→`#4c5563`（1.60→2.17）；`--dd-border3/4` 作为细发丝线偏暗（1.17/1.09），提到 1.42/1.39。
  - 已核验：全量 62 个在用 `var(--dd-*)` token 均有深色定义（无静默回退到浅色字面量的漏网），bug 来源锁定为「裸字面量」+「UI 边框色被当图形色复用」两类。修复后**浅色模式渲染 SHA256 与修复前逐字节相同**（零回归），深色模式 A/B 渲染差异落在预期的 4.39% 像素上；`npm run bench` / `smoke-host` 全绿。

- **趋势卡 Token/费用/时长 切换柱状图无过渡动画**：`.dd-seg` 本来就有 `transition:height .3s`，但 CSS 过渡只在 React **复用同一 DOM 节点**时才触发——三种模式的段 key 各不相同（token=`0/1/2`、cost=`0`、dur=`total/active`），只有 token↔cost 能蹭到 key `0` 的复用（所以唯独这一对有动画），涉及时长的任何切换整列节点重建、动画丢失。现统一为**三个固定段槽 key `a/b/c`**：时长模式 a=总时长、b=活跃（overlay 类切换）、c=空槽；费用模式 b/c 高度 0。任意两模式切换全部节点复用，高度+颜色都走过渡（顺带修好：时长图例开关活跃/总时长、token 图例开关各段，现在也有动画了）。harness 实测 5 对切换全部 `reused:true` + 点击后 80ms 仍有 6–9 个 height 过渡在运行，冻结 100ms 帧确认形变中间态正常。
- **X 轴时间标签改为固定步长**：旧抽样「均匀取 N 个点再四舍五入」产生 1/2/3 混合间隔（如 11 个桶标 9 个 → 00,01,03,04,05,06,08,09,10），看起来像随机漏标。现改为 **步长 = ⌈桶数 ÷ 可容纳标签数⌉，每隔固定个桶标一格**：今天 24 小时 → 每 3 小时一格；30D → 每 4/5 天一格；90D → 每 2 周一格，节奏恒定。缓存洞察卡与趋势卡同步修复；趋势卡标签位置也改为居中对齐所属列列心（旧版按 k/(N-1) 贴边定位，与列不对齐），并删除随之失效的 first/last 对齐 CSS。实测今天/30D/90D 三档标签全部等间隔。
- **用量视图柱子压住 Y 轴刻度**：柱状图此前沿用折线的「点刻度」（首桶 x=绘图区左缘），柱子以刻度为中心展开，半截越界盖住左侧 token 标签（桶少柱宽时最严重，如「今天」凌晨只有个位数桶）。改为**分带（band）刻度**：柱心落在等宽槽位正中，首末柱完整留在绘图区内；X 轴标签、hover 落点（floor 槽位）、参考线、tooltip 定位全部随视图刻度对齐，柱宽上限 26px 防单桶占满。折线视图不受影响（细点/线从未越界）。实测「今天+用量」Y 轴标签完整、hover 左右边界落桶正确（00:00/10:00）、命中率视图无回归。
- **缓存洞察卡右上角按钮**：① 视图切换从 FilterBar 同款小 pill（`.dd-range`/`.dd-pill`，12px）换成全站标准 `Segmented` 组件（与趋势卡、分布卡的 Token/费用切换同尺寸同观感）；② 移除 Y 轴缩放切换按钮（连同其「出现/消失导致按钮组横向跳位」的布局 bug）——按产品决策 **Y 轴恒为自适应放大**（域取命中率+覆盖率数据带外扩、整步进取 2/5/10pp），不再有 0–100% 选项。
- **雷达粘性 hover 无释放路径**：上一轮把图例 hover 改成粘性聚焦后，`legendId` 只进不出——悬停过一次后其他模型永远变暗，无法回到全部显示。最终语义回归经典：**放上即高亮、移开图例项即恢复全览**（item 级 mouseleave；卡级 leave 兜底）；点击 = 显式锁定、再点取消。真实渲染流逐项验证：hover→dim3、移开→dim0、切换→正常、锁定跨移开保持、解锁+移开→dim0。
- **雷达图例 hover 高亮「失效」**：图例项的 hover 在鼠标移开瞬间被清空，用户把指针移向图形查看时高亮与真值标签已消失（点击因持久化而正常），体验等同 hover 不可用。改为**粘性聚焦**：图例 hover 后高亮保持（chart hover 仍为临时预览、点击仍为锁定），优先级 chart hover > 图例 hover > 点击锁定 > 默认第一个；聚焦模型 fill 提到 0.45 强化「它亮起来」的观感。经 React 18 本地 harness + 真实鼠标事件验证：移开鼠标后 dim 与顶点标签保持。
- **健壮性审计轮**（安全/异常/死代码/口径一致性）：
  - 监听器毒事件防护：实时流事件折叠 `foldAppend` 抛错不再冲垮 `session/event` 派发（原样外抛会波及同事件的其他监听器，Node 下未捕获即进程级风险）；毒事件被丢弃并计数（`st.droppedEvents`），后续事件继续入账。`drainPending` 同口径逐事件防护。
  - 毒历史防护：`foldSession(events)` 抛错（存储日志本身畸形）此前会让该会话每 60s 重入队、每次重付全量解码——正是冷启动修复杀死的“死亡风暴”模式的折叠版；现直接永久标记 `dead` 跳过。
  - 新会话事件触发 `loadSession` 补 `.catch()`：历史装载被拒不再形成 unhandledRejection。
  - `foldAppend` 的 `assistant/message` 分支 `ev.data.usage` 空引用洞修复（`data` 缺失事件不再抛 TypeError），并新增 bench `[0f]` 脏事件套件。
  - **边缘/聚合桶响应时长口径统一**：窗口边缘小时此前用 `durUA`（用户消息→回复，跨工具执行）喂 per-model 延迟直方图，聚合桶用 `genDurMs`（step 区间）——同一模型统计随窗口是否切到小时中部而漂移。现在折叠时把 `genDurMs` 随 type-2 明细事件携带（`actMs` 槽位），边缘路径优先读取，两口径严格一致；bench `[0g]` 锁死。
  - 查询参数防护：`/dash-api/*` 的 query 键过滤 `__proto__/constructor/prototype`（防把污染键挂上 args 对象）；恶意输入实测优雅降级（`range=');__proto__=1&from=abc&to=1e20` → 回退全窗口 183 ms 正常返回）。
  - rollup 磁盘缓存格式 v3（分桶去掉死字段）；`computeRollupActiveMs` 桶扫描 `break` 改 `continue`（不依赖 Map 插入序，pending 乱序补折不丢区间）。
- **死代码清理**：删除从未被读取的 `st.failCount`、`st._lastLoadError`（写死）与分桶上恒为 0 的 `activeMs` 字段（activeMs 一律由 type-6 区间推导）；`computeRollupActiveMs` 的返回值（无调用方使用）移除。
- 客户端修正：`DUR/COST/TOTAL` tip 之前被 StatCard 透传但从未渲染，现接为 ⓘ 按钮的原生 hover 提示；COST_TIP 去掉过期的「245 个模型」硬计数；模型下拉「全选」改为置空筛选（245+ 模型 id 拼查询串会逼近 Node HTTP 16KB 头部上限，且“全选”语义等价于“全部”）；`installDashboardNavIcon` 的 MutationObserver 回调 rAF 合帧（聊天页持续流式变更时不再每批 mutation 全量扫描按钮）。
- 修复**「活跃时长」恒显示 0**：DSH v2+ 的日志迁移链（`dsh-session-format-v1-to-v2`）会直接丢弃 `assistant/chunk` 事件，实时事件流也不再生成它——原「首个输出分块 → finish」的生成区间在现网任何会话上都无法建立。引擎新增 step 区间回退：某 step 没有任何分块证据时，`step/start → assistant/message` 计为模型生成时间（其后的工具执行不计入；被打断、始终没有 assistant/message 的 step 不计入），有分块事件的旧日志仍按分块口径（排除 TTFT 与排队）。模型响应时长统计（avg/p50/p95）同步受益——此前大量退化为「用户消息 → 回复」的跨工具耗时。`rollup` 磁盘缓存格式版本升为 2，旧折叠（无生成区间、旧定价）全部失效重折。
- **qwen3.8-flash 计入定价**：价格行 `qwen3.8-flash,Alibaba,0.8,2.7,0.1`（¥/M）已在扩展 CSV 中，但 CSV 更新后未重新生成 `pricing.js`，导致该模型会话费用为 ¥0（实测当日 870 万 tokens 费用显示 0）。已 `npm run build` 重新生成（246 模型）。
- 修复数据看板在 DSH ≥ 0.1.5 上**冷启动一次一点、几分钟加载不完**的问题。上一版修复把冷加载改成了「请求立即返回部分数据、后台渐进物料化」，但死会话（约 170 个旧版子代理日志，DSH 迁移器对 `subagent/descriptor` version≠2 以外版本直接拒读）会在**每次列表与 60s reconcile 时重新入队**，每个死会话每次重试都要付出完整格式迁移解码（秒级），后台风暴永不停止。现改为：装载链只走 `sessionPersistence.requireStoredLog(id)`（单会话直读，无全库重扫）；读取失败**立即静默跳过、永不重试**；列表来源改为**直接走查会话库目录**（只认现行 `session-<id>` 布局，旧版裸 `<uuid>` 子代理目录根本不入队），走查只需每会话一次 readdir+stat。
- 按产品决策，看板**只统计普通会话**：子代理会话（旧布局裸 uuid 目录 173 个 + 新格式委派会话）一律排除，不做提示、不做进度条（`meta.warming` 与客户端进度 UI 已移除）。
- 恢复「首次打开即完整数据」：首个看板请求会等待后台物料化收敛（上限 90 s，缓存命中时为秒级），之后所有范围/筛选切换仍走 stale-while-revalidate 毫秒级缓存。

### 新增

- **「缓存命中率趋势」重设计为「缓存洞察」卡**：旧卡只有一根线，且固定 0–100% 轴把实测 91–99% 的命中率压成贴顶直线。新版：① KPI 条（窗口命中率 + 环比 ▲/▼pp、遥测覆盖率、**预计节省** = 缓存读取 tokens × (输入价 − 缓存价)，跟随 ¥/＄ 切换）；② 双视图切换——命中率视图（monotone-cubic 平滑曲线、**自适应 Y 轴**默认放大到数据带并可一键切回 0–100%、覆盖率琥珀虚线、均值参考线、末端数值胶囊、无遥测区间浅灰带）与用量视图（缓存读取 vs 未命中计费输入堆叠柱，hover 其余柱淡出）；③ **模型缓存排行**（按读取量排序：条长=读取量、琥珀刻度=覆盖率、命中率 % + 各模型节省额，未定价模型显示「—」、免费模型如实 ¥0；**点击行 = 按该模型筛选全看板**、再点解除；▾ 展开全部、内部滚动）；④ ⓘ 弹窗人话解释命中率/覆盖率/节省/排行条四个口径。Tooltip 维持既定口径仅四项（时间/命中率/缓存读取/覆盖率）。**视图切换带过渡动画**：命中率/用量两层常驻同一 SVG、交叉淡入淡出；激活层重播入场——折线 `pathLength=1` 归一后描边生长（0.6s）、面积/圆点/均值错峰淡入、覆盖率虚线最后浮现；柱状图从基线 `scaleY` 弹起并按索引 26ms 错峰（左起右随）；KPI 条与图例整体淡入上浮。基态样式即动画终态，故淡出的旧层保持完整图形只走 opacity，切换不闪断。全部数据来自现有 buckets 与 meta.models（含定价）客户端计算，**引擎零改动**。卡高 420px 与雷达卡对齐。React harness 真实数据逐项验证：双视图 hover、缩放切换、模型点击筛选联动、展开收起、90D/30D/今天三种粒度、动画冻结帧确认描边生长与柱错峰。
- **模型效能雷达 v3（六轴重设计）**：旧六轴一半是同一延迟分布的重复衍生、且含被污染数据标定的阈值与两个零区分度轴。新六轴各答一个问题、方向统一（外圈=好）：响应速度（P50 倒数，外圈=0.8s）、输出速度（tokens/实测生成秒，外圈=166）、平均输出量（tok/次，外圈=1,645）、平均输入量（计费输入 tok/次，外圈=29.4万）、稳定性（P50/P95，外圈=慢≤8.3倍）、实际单价（¥/百万 tokens 全口径反向，外圈=¥0.10/M；未定价模型该轴留空并标注）。全部对数归一、固定外圈（90d 实测最佳×1.2 标定）。直观性：顶点挂**实测真值标签**（`5.0s`、`¥0.26/M`…，最后绘制防遮挡），外圈角标基准值，图例横排带调用次数与多行真值 title，卡下新增双列**数值卡**（真值+得分色条）；ⓘ 说明只讲含义与外圈参考值、不含公式，并注明「平均输入/输出量是使用画像而非强弱」「实际单价≠官方牌价」。缓存命中轴退役（实测 90–99.5% 零区分度，缓存指标由趋势卡专职承担）。布局紧凑版：雷达卡原位、半宽内纵向堆叠，不动缓存趋势卡。
- **雷达 v3 二轮调整（用户反馈）**：① 纵向堆叠版卡片过长（~570px）→ 改「左雷达 250px + 右列（图例两行：名称整行+次数、数值卡单列真值）」，卡高压到 ~374px；② 外圈基准值标签从图面移除（标定说明保留在 ⓘ 弹窗）；③ 归一化从单端 `log(1+v)/log(1+max)` 换成**双端对数带宽** `log(v/floor)/log(ceil/floor)`——响应速度外圈=P50 1s、中心=120s（30s 的推理模型从贴中心 0.04 抬到 ~0.29，快慢分层可见），其余轴同步双端标定（输出速度 1–166 t/s、平均输出量 50–1,645 tok、平均输入量 5k–29.4万、稳定性 慢125倍–8.3倍、实际单价 ¥2–¥0.10/M）；④ 顶点真值标签放大并收紧 viewBox（552×470），小卡宽度下轴名不再贴边截断。经 React harness 真实渲染截图逐项验证（图例名称完整、标签可读）。
- **雷达数值卡升级为「标尺行」**（用户反馈纯文字无美感）：每轴 = 灰色轴名 + 等宽字体真值 + 细轨道；**四个模型的得分落点以小圆点同屏对比**——当前模型放大、白圈+主色光晕，其余半透明，hover 圆点有「模型 · 轴: 真值」原生 title；主色淡填充从 0 延伸到当前落点。信息从「一行文字」变成「这一轴上谁强谁弱」的微型对比图，配色沿用图例色板与整站一致。viewBox 放宽到 583×470 修复右轴名截断；卡高 425px（仍远低于旧堆叠版 ~570px）。
- **雷达「安静风」配色**（用户反馈原版太亮）：环线与轴线 `#9ca3af`→`#e9e9ec`（外圈 `#d4d4d8`）；多边形填充 0.42→0.13（聚焦 0.20、变暗 0.03）、描边 85% 不透明；顶点标签去掉白底药丸+投影，改白底 1px 细灰描边（`#dcdce1`）+ 墨色 `#3f3f46` 半粗文字；圆点缩小（3.5/2.5）；数值卡轨道填充 0.3→0.18、当前模型落点光晕降为 40% 主色、真值文字转墨色；图例名称同步 `#3f3f46`。整体与看板 zinc 浅灰风格统一。
- 客户端「活跃时长」说明（DUR_TIP 与 ⓘ 弹窗）改写为与新口径一致：按 step 从请求发起到回复完毕累计，旧日志含分块时从首个分块起算。
- **rollup 磁盘缓存**（`~/.dsh/usage-dashboard-cache/<sessionId>.json`，按日志文件 `mtime+size` 失效）：折叠后的 rollup（含窗口边缘精确性所需的逐事件明细）按会话落盘；DSH 重启后未变化的会话**零解码直接采纳**，全库冷启动从分钟级降到秒级，缓存总量约 20 MB（实测 18.8 万个折叠事件）。
- 会话库走查（`walkStore`）：`readdir + stat` 直查 `sessionPersistence.root`，取代每请求 4–8 s 的 `q.listSessions()`；服务不可用时回退 `sessionQuery.listSessions()`（并按头部 `delegationDepth`/`parentSession` 跳过子代理）。

### 性能

- 实测（真实会话库 340 目录）：普通会话 157 个、总 tokens 23.46 亿与修复前看板完全一致；缓存命中后重启首次完整响应为**秒级**，全部端点（`usage`/`detail`/`calendar`）毫秒级（SWR 命中 15–45 ms）。
- 读取链按 API 可用性降级（`requireStoredLog` → `open(id,'read')` → `readSession`），不再按会话失败逐级重试——不可读会话只付一次解码代价。

### 测试

- bench 新增 `[0a2]`：无分块日志的 step 区间回退语义（消息闭合 5s + 分块闭合 3s、被打断 step 不计、`foldAppend` 与 `foldSession` 逐字节一致），并断言 `qwen3.8-flash` 已在生成价目表中（防「CSV 改了没重生成」回归）。
- 新增客户端 bundle 的 **slot 注册契约**校验（`smoke-host.mjs` + `verify-pack.mjs`）：断言 bundle 解析 `slots` 服务、调用 `slots.inject('<slot>')`、且每个注入的 slot 都是已知 slot 并配对了对应的 `slots.register({ name: '<slot>' })`。此前的正则假设 API 形如 `register({`，与实际的 `slots.inject('settings.section', () => slots.register(\n  { name: ... }))` 不匹配，导致校验形同虚设；同时对畸形 bundle 做了负向验证。
- 新增 `scripts/e2e-check.mjs`：对真实/夹具会话库跑完整装载链（走查 → 缓存写入 → 二次启动采纳 → 查询），断言两轮 totals 一致。
- 新增 `scripts/scan-unreadable.cjs`（生成 `unreadable-sessions-report.md`：逐会话列出不可读原因）与 `scripts/estimate-recovery.mjs`（用插件自身引擎估算各组会话的 token/费用体量）。
- 修正两条依赖旧「请求内同步冷加载」语义的断言，改为显式跨过快照窗口并使用独立缓存键。

## [0.3.10] - 2026-09-09

### 新增

- 新增「模型效能雷达」卡片：在筛选窗口内展示调用量前 **4** 个模型的六维雷达对比，六轴为响应效率（输出 Token / 平均响应 ms）、响应速度（1 / p50 ms）、一致性（1 / (1 + p95/p50)，分位数来自对数直方图）、成本效率（输出 Token / 费用）、缓存命中（%）与 Token 产出（输出 / 计费输入 `billedInput` × 100%）；各轴按**固定上限**归一化为 0–1（上限基于实际数据分布设定，约取当前最佳值的 1.2 倍；响应效率、响应速度、成本效率三个量级跨度大的轴用对数刻度），因此不同时间窗口之间可以直接比较，也不会出现所有模型都贴住外圈。右侧列表点击或雷达点 hover 高亮对应模型、其余变淡；标题旁 ⓘ 弹窗按轴逐条解释含义。
- 新增「缓存命中率趋势」卡片：按所选时间范围的每桶绘制缓存命中率折线 + 散点，Y 轴固定 0–100%；展示当前窗口命中率、缓存数据覆盖率与环比百分点变化（当前 − 上一窗口，基线为零时隐藏）。断点仅在非相邻桶间出现。

### 修复

- 修复构建产物 `lib/index.js` 无法启动的致命回归：5 个调优常量（`CACHE_TTL_MS`、`RECONCILE_INTERVAL_MS`、`CACHE_MAX_FAILURES`、`CACHE_STALE_MULTIPLIER`、`PREWARM_DELAY_MS`）曾声明在 `src/host.js` 的模块作用域，而构建只抽取 `export function apply(...)` 的函数体，常量被丢弃、引用全部保留——`node --check` 通过，但 DSH 启动即 `ReferenceError`。常量现已移入 `apply()` 内部。
- 新增构建期守卫：`scripts/regenerate.cjs` 对 `src/host.js` 与 `lib/index.js` 双向扫描 UPPER_SNAKE_CASE 标识符，「使用但未声明」即硬失败（同时覆盖常量被丢弃与拼写不一致两类），并给出明确修复提示。
- 修正缓存失败计数字段名 `CACHE_MAX_FAIL` → `CACHE_MAX_FAILURES`：原代码引用的常量名从未声明，失败计数淘汰分支实际不可达。
- `apply()` 不再因缺少可选 `timer` 服务而提前 `return`：`/dash-api/*` 路由无条件注册，仅定时 reconcile 与启动预热降级。`scripts/smoke-host.mjs` 补齐 timer stub 并新增「routes survive no timer」断言，`npm test` 恢复全绿。
- `playwright` 从 `dependencies` 移至 `devDependencies`：运行期看板不依赖浏览器驱动，下游安装不再拉取该重依赖。
- 清理 3 个从未使用的死常量（`FAST_FILE_THRESHOLD_BYTES`、`PARALLEL_WORKERS`、`EVENT_LISTENERS_KEY`）与过期的 "5 min CACHE_TTL_MS" 注释（实际 30s）。

### 性能

- 修复切换时间范围/筛选时请求始终 ~400–800 ms 的问题。根因：每条流式事件都让 `invalidate()` 清空整个请求缓存，同时 `cached()` 又会丢弃版本漂移的条目——两条路径叠加使 stale-while-revalidate 变成死代码，**每个请求都退化为全量冷重算**（155 个会话实测 0.42–0.83 s，缓存 0 命中）。现在 `invalidate()` 只递增 `dataVersion`，旧版本条目继续即时返回并在后台单飞重算；settled 结果无条件写回（单飞保证每个 key 至多一个在途计算，因此不存在旧结果覆盖新数据）。
- 新增 rollup 列表快照（`ROLLUP_SNAPSHOT_MS` = 5s）：后台重算不再每次重新 `listSessions()` 遍历全部会话。
- 155 个会话实测：热请求 2–8 ms，新 key 首次 50–800 ms（一次性），重复切换 2–3 ms。唯一仍慢的是一次性冷加载（对每个持久化会话做完整 `readFrom`），已由启动后 ~500 ms 的预热覆盖。
- 注意：本项有意反转了 0.3.9 的「旧版本 in-flight 结果不写回缓存」决策。原守卫在缓存随事件清空的前提下是必要的；缓存不再被清空后，该守卫会把后台重算结果全部丢弃，导致条目永久停留在过期版本。0.3.9 的失败计数失效问题由新的无条件写回 + 独立 `failCount` 累加解决。`scripts/smoke-host.mjs` 新增 SWR 断言锁定该契约。

### 数据口径

- 汇总与分桶口径沿用 disjoint bucket 约定：**缓存命中率** = `cacheRead / cacheObserved × 100%`，其中 `cacheRead` 来自 provider 的 `usage.cacheReadTokens`；**`cacheObserved`** = 有显式 cache 遥测的行（provider 报告了 `cacheReadTokens` 或 `cacheWriteTokens`）的 `inputTokens + cacheRead + cacheWrite` 之和，即带 telemetry 的计费输入，未报告的行排除出分母。**`billedInput`** = 全窗口 `inputTokens + cacheTokens` 之和（含未知 telemetry 行），作为覆盖率分母；**覆盖率** = `cacheObserved / billedInput × 100%`，全未知时显示「—」。成本效率轴对未计费模型作 omission 处理（不参与归一化，显示「—」），不映射到 100。
- `src/core/rollup.js` 新增 `totals.cacheRead/cacheWrite/billedInput/cacheObserved/cacheHitRate/cacheCoverage/cacheHitRateDeltaPp` 字段与分桶同名字段；模型聚合额外导出 `avgResponseMs/p50ResponseMs/p95ResponseMs`（对数分桶直方图）以支撑雷达得分计算。
- `src/client.js` 新增 `RadarCard` / `CacheTrendCard` 组件及相关 `.dd-radar-*` / `.dd-cache-*` CSS。

### 文档

- 修正 `README.md` / `README.en.md` 三处过时或错误说明：定价表名 `vibe-usage-model-pricing.csv` → `vibe-usage-model-pricing-extended.csv`、模型数 204 → 245、"美元 ×7 折算人民币" → 表内单价已直接以人民币元/百万 token 计价；雷达图"各维度 Top-1 归一化为 100" → 固定上限归一化为 0–1（含对数刻度说明）；缓存命中率趋势中不存在于代码的"加权平均命中率" → 实际展示的覆盖率与环比百分点。
- 补充四处 ⓘ 说明弹窗的文档：预估费用（定价覆盖与峰谷计费）、活跃时长 / 总时长（口径差异）、模型效能雷达（六轴含义）。
- 清理英文版两处漏译的中文「口径」。

## [0.3.9] - 2026-08-30

### 修复

- 修复时长趋势图将“总时长”和“活跃时长”错误相加堆叠的问题；活跃时长现在作为总时长的底部叠覆层显示。
- 修复滚动窗口下界落在小时中间时的边缘桶遗漏，补齐边缘热力图、Token、费用、缓存读取量和消息计数。
- 修复无 `usage` 的 `assistant/message` 在边缘桶中被遗漏的问题；此类消息只计消息与跨度，不虚构 Token 或费用。
- 修复上一周期只有消息、工具事件或无 usage 消息时环比基线缺失的问题。
- 修复只有孤立消息的趋势桶会话数为零的问题，并为超长趋势范围增加显式桶数上限，拒绝静默截断。
- 统一服务端聚合、热力图、日历、趋势和客户端日期显示到 UTC+8；修复北京时间日期边界和工作日峰谷计价显示错位。
- 自定义日期改为点击“应用”后才提交查询，避免编辑日期时产生连续无效请求。
- 修复 host 请求缓存的旧版本 in-flight 结果覆盖新数据，以及 stale-while-revalidate 失败计数失效的问题。
- 修复事件流创建的新 session、以及已列出 session 遇到滞后 `listSessions()` 快照时被错误清理的问题。

### 安全与隐私

- 移除 `webhook_test.py` 中的任意代码执行路径，改为严格 JSON 对象解析。
- webhook 测试口令改为从 `WEBHOOK_PASSWORD` 环境变量注入，未配置时明确失败。
- 发布包扫描改用通用 token / email 检测，并支持可信发布环境追加 `DASH_PERSONAL_SCAN_PATTERN`；无效自定义正则会回退到默认检查。
- 保持所有用量聚合在本机完成，npm 包不包含原始 pricing CSV、会话日志或本机数据。

### 数据与构建

- 将 `pricing/vibe-usage-model-pricing.csv` 纳入版本控制，重新生成包含 204 个模型的 `src/core/pricing.js` 和 `lib/core/pricing.js`。
- 增强 host 函数抽取器对字符串、模板、注释、正则字面量和正则字符类的词法处理，并加入构建期回归样例。
- 完善 host smoke 与引擎 bench，覆盖边缘桶、缓存竞态、session 列表滞后、UTC+8、原型键和超长趋势等场景。

### 验证

- `npm test`：build、bench、host smoke 全部通过。
- `npm pack` + `scripts/verify-pack.mjs`：发布包内容、host/core/client 加载、bundle patch 和隐私扫描全部通过。
- `python -m py_compile webhook_test.py`：通过；恶意表达式被拒绝且不会执行。

[0.3.10]: https://github.com/skkjkk/dsh-usage-dashboard/compare/v0.3.9...v0.3.10
[0.3.9]: https://github.com/skkjkk/dsh-usage-dashboard/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/skkjkk/dsh-usage-dashboard/releases/tag/v0.3.8
