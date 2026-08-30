# 总览

共发现确定问题 14 个（高 3 个、中 10 个、低 1 个），疑似问题 8 个（均低）。最该优先修复的是 `src/client.js` 中未定义的图标/常量导致整个看板渲染崩溃、时长趋势图叠加溢出裁剪，以及 `src/core/rollup.js` 与 `src/host.js` 在窗口边缘聚合与事件/缓存竞态上的静默误报（这些会在常规滚动窗口中直接产生错误的 Token、消息、热力图和环比数据）。

## BUG-1 [逻辑] [严重度: 高]
- 文件: `src/client.js`
- 位置: `TrendChart`，约第 537–568 行
- 现象: 趋势图切到「时长」模式时，`total` 段与 `active` 段被当成和普通 token 段一样**相加堆叠**；归一化基准 `M` 只取 `total` 或 `active` 单一最大值，而非两者之和。`.dd-bar-inner` 是纵向 flex 列且 `overflow:hidden`，于是整柱高度 = `(total+active)/M` 溢出并把顶部 `active` 段裁掉。最典型：某桶 `totalMs` 是窗口最大值（占满整柱）且 `activeMs > 0`，峰值桶的「活跃时长」完全不可见，其余桶 active 被压扁/裁切，视觉上 active 看起来“超过总时长”。
- 根因: 时长模式下总时长与活跃时长是包含关系（active ⊆ total），不应像 token 那样相加堆叠，但渲染代码与 token 分支同样处理了。
- 候选修复 diff:
  ```diff
        const cols = buckets.map((w, i) => {
          let segArr
          if (isDur) {
  -         segArr = [
  -           { h: durSegs.total ? w.totalMs / M : 0, bg: TREND_SEG_COLORS.durTotal },
  -           { h: durSegs.active ? (w.activeMs != null ? w.activeMs : w.durMs) / M : 0, bg: TREND_SEG_COLORS.durActive }
  -         ]
  +         // 时长模式：总时长是满柱背景，活跃时长是其子集，应“叠覆”在底部，
  +         // 不能像 token 那样相加堆叠，否则柱高 = total+active 溢出并被裁切。
  +         const totalH = durSegs.total ? w.totalMs / M : 0
  +         const activeH = durSegs.active ? (w.activeMs != null ? w.activeMs : w.durMs) / M : 0
  +         const mkDur = (h, bg, key) => h('div', {
  +           key,
  +           className: 'dd-seg' + (key === 'active' ? ' dd-seg-overlay' : ''),
  +           style: {
  +             height: Math.max(0, h * 100) + '%',
  +             backgroundColor: bg,
  +             borderRadius: h > 0 ? Math.min(4, h * 220 / 2) + 'px ' + Math.min(4, h * 220 / 2) + 'px 0 0' : '0'
  +           }
  +         })
  +         segsEl = h('div', { className: 'dd-bar-inner' },
  +           durSegs.total ? mkDur(totalH, TREND_SEG_COLORS.durTotal, 'total') : null,
  +           durSegs.active ? mkDur(activeH, TREND_SEG_COLORS.durActive, 'active') : null)
          } else if (isCost) {
  ```
  并配套 CSS：给 `.dd-bar-inner` 增加 `position:relative;`，新增 `.dd-seg-overlay{position:absolute;left:0;right:0;bottom:0}`。柱高恒为 `max(total,active)/M`，active 作为底部叠覆，永不超过总时长。
- 复现/验证: 进入「数据看板」→ 趋势图切「时长」→ 构造某桶 `totalMs` 为该窗口最大值且 `activeMs > 0`；断言渲染后峰值桶 `active` 段仍可见（不溢出裁剪），且 `active` 高度 ≤ `total` 高度。
- 约束: KPI 卡片「总时长 / 活跃时长」数值本身正确，不要修改；只在趋势图渲染层改为叠覆，不要给 token/cost 分支改动；CSS 改动不能影响其他 `.dd-seg` 堆叠段。

## BUG-2 [逻辑] [严重度: 高]
- 文件: `src/client.js`
- 位置: 裸引用 `ICON_INFO`/`ICON_ECG`/`ICON_CAL`/`ICON_MODEL`/`ICON_PROJECT`/`ICON_PIE`/`ICON_GRID`/`CHECK`/`ARROW`/`COST_TIP`/`DUR_TIP`/`TOTAL_TIP`，约第 256、264、299、315、352、360、406、502、627、742、800、904、1048、1055、1056 行
- 现象: 这些标识符在 `src/client.js` 与 `lib/client.js` 中**只有使用、没有任何 `const`/`var` 定义**；仓库内（含 DSH 依赖 `@deepseek-ai/dsh*`）也搜不到其定义，构建脚本 `scripts/regenerate.cjs` 仅做 `ctx.interval→setInterval`、`styles.insert→<style>`、`return{…}→module.exports` 与 UMD 包装，**并不注入这些标识符**。首次渲染 `Dashboard`（任意用到图标的组件）→ 直接 `ReferenceError: ICON_ECG is not defined`，整个看板白屏。
- 根因: 渲染依赖一组从未定义/导入的图标与提示常量；若运行环境也未以全局/模块作用域预置这些标识符，则必然崩溃。
- 候选修复 diff:
  ```diff
   const h = React.createElement
  +
  +  // 浏览器内联 SVG 图标与提示文案（仓库此前漏定义，运行环境亦未预置 → 渲染崩溃）
  +  const svgIcon = (...kids) => h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, ...kids)
  +  const ICON_INFO = svgIcon(h('circle', { cx: 12, cy: 12, r: 9 }), h('line', { x1: 12, y1: 11, x2: 12, y2: 16 }), h('line', { x1: 12, y1: 7.5, x2: 12, y2: 8 }))
  +  const ICON_ECG = svgIcon(h('polyline', { points: '2 12 7 12 10 4 14 20 17 12 22 12' }))
  +  const ICON_CAL = svgIcon(h('rect', { x: 3, y: 4, width: 18, height: 17, rx: 2 }), h('line', { x1: 3, y1: 9, x2: 21, y2: 9 }), h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }), h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }))
  +  const ICON_MODEL = svgIcon(h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), h('line', { x1: 3, y1: 9, x2: 21, y2: 9 }), h('line', { x1: 9, y1: 9, x2: 9, y2: 20 }))
  +  const ICON_PROJECT = svgIcon(h('path', { d: 'M3 7l9-4 9 4-9 4-9-4z' }), h('path', { d: 'M3 12l9 4 9-4' }), h('path', { d: 'M3 17l9 4 9-4' }))
  +  const ICON_PIE = svgIcon(h('path', { d: 'M12 3v9h9a9 9 0 1 0-9-9z' }))
  +  const ICON_GRID = svgIcon(h('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }), h('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }), h('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }), h('rect', { x: 14, y: 14, width: 7, height: 7, rx: 1 }))
  +  const CHECK = svgIcon(h('polyline', { points: '4 12 10 18 20 6' }))
  +  const ARROW = svgIcon(h('polyline', { points: '6 9 12 15 18 9' }))
  +  const COST_TIP = '预估费用为估算值：USD 单价 × 7 折算为人民币 ¥/M tokens，来源于定价表。未匹配模型暂不计费。'
  +  const DUR_TIP = '活跃时长为 AI 实际生成内容的时间；总时长包含思考、看代码等空闲，但不含会话间隔。'
  +  const TOTAL_TIP = DUR_TIP
  ```
- 复现/验证: `node --check lib/client.js`（语法）后，在浏览器加载 Dashboard，确认不抛 `ReferenceError` 且各标题图标正常渲染；或加一个最小测试：用 `new Function` 包裹 client 工厂并 mock `React`/`fetch`，断言 `apply` 不抛未定义错误。
- 约束: 图标只需视觉占位，应与 `.icon` 尺寸/颜色一致；若运行环境确实预置这些标识符，则改为从运行环境 import 而非重复定义，但不能保留“无定义即崩溃”的现状；不要改动其余渲染逻辑。

## BUG-3 [安全] [严重度: 高]
- 文件: `webhook_test.py`
- 位置: `webhook_test`，约第 4 行
- 现象: `eval(user_input)` 将变量内容作为 Python 代码执行。一旦该函数被 webhook/调用方补充为接收外部输入，攻击者可执行任意进程、读写文件或窃取环境变量。当前文件虽未被 npm `files` 打包，且函数未调用、`user_input` 未定义，但**危险执行点本身确定存在**，不能作为输入校验。
- 根因: 把输入直接交给 Python 解释器，而不是按数据格式解析或按允许值分派。
- 候选修复 diff:
  ```diff
   def webhook_test():
       # 故意留两个明显问题，确认审查真的跑起来了
       password = "secret123"
  -    eval(user_input)
  +    # 严禁把调用方文本当作 Python 代码执行；如需解析字面量用 ast.literal_eval 并校验类型
  +    import ast
  +    try:
  +        parsed = ast.literal_eval(user_input)
  +    except (ValueError, SyntaxError):
  +        parsed = None
  +    print("EvoAgent webhook test parsed:", parsed)
       print("EvoAgent webhook test")
  ```
- 复现/验证: `python -m py_compile webhook_test.py` 验证语法；将 `user_input` 设为 `__import__('os').system('echo pwned')` 并调用函数，修复后不应执行该表达式（只做字面量解析）。
- 约束: webhook 若需要解析 JSON/字面量，应使用严格 schema 或 `ast.literal_eval`（且校验结果类型），不能恢复任意代码执行；该测试文件不应进入发布包。

## BUG-4 [逻辑] [严重度: 中]
- 文件: `src/core/rollup.js`
- 位置: `queryUsage`，约第 544 行
- 现象: 在 `today`、`24h` 等上界落在当前小时中间的窗口内，当前小时边缘桶中的 Token/费用被计入 `cellOf(lo)`。例如今天 15:30 查询时，15:10 的 Token 会落到当天 00:00 的热力格，而不是 15:00；KPI 和趋势数值仍可能正确，但热力图按错小时显示。
- 根因: `edgeAccumulate` 对整个边缘桶只接收一个 `cell`，调用处传入了窗口下界的单元格 `cellOf(lo)`，没有使用当前桶的 `cellOf(hk)`。
- 候选修复 diff:
  ```diff
  -        const lastT = edgeAccumulate(lo, hi, modelSet, b.evts, cellOf(lo), {
  +        const lastT = edgeAccumulate(lo, hi, modelSet, b.evts, cell, {
             totals: cur.totals, heatToken, heatCost, heatDur,
             bucketMap, gran, modelAgg, projectAgg, cwd: cwdKey, gkSpan
           })
  ```
- 复现/验证: 固定 `now` 为本地 15:30，构造 15:10 带 100 Token 的 assistant 事件，调用 `queryUsage(..., { range: 'today', now })`，应断言 `heat.token[cellOf(eventTime)] === 100` 且 `heat.token[cellOf(now 的 00:00)] === 0`（两者不相同的时区/小时场景）。
- 约束: 保留 `[lo, hi]` 的边缘事件过滤；不要改动 `activeHeat` 的按生成开始时间归属，也不要改变 KPI/费用总量。

## BUG-5 [逻辑] [严重度: 中]
- 文件: `src/core/rollup.js`
- 位置: `foldAppend` 的 `assistant/message` 分支与 `edgeAccumulate`，约第 321、805 行
- 现象: assistant 消息落在窗口边缘桶时，`totals.cacheReadTokens` 永远不包含该消息的缓存命中 Token；非边缘桶能计入。当前事件数组把 `cacheReadTokens` 与 `cacheWriteTokens` 合并为 `e[5]`，所以即使在边缘累加也无法得到准确的“缓存读取”子项。
- 根因: 近期只在非边缘的 `b.per[9]` 聚合路径累加了缓存读取量，边缘事件明细没有保留 `cr`，且 `edgeAccumulate` 没有更新 `cacheReadTokens`。
- 候选修复 diff:
  ```diff
  - // evts entry: [t, type, model|null, in, out, cache, costIn, costOut, costCache,
  - //              durUA, actMs, endT] — type: 0 user, 1 injected, 2 assistant,
  + // evts entry: [t, type, model|null, in, out, cache, costIn, costOut, costCache,
  + //              durUA, actMs, endT, cacheRead] — type: 0 user, 1 injected, 2 assistant,
  + //              cache is still cacheRead + cacheWrite; cacheRead is kept separately at index 12.
  //              3 toolCall, 4 toolResult, 5 step/start, 6 generation interval.
  ...
  -        b.evts.push([t, 2, model, inp, otp, cr + cw, costIn, costOut, costCache, r._lastUserT !== null ? Math.max(0, t - r._lastUserT) : 0])
  +        b.evts.push([t, 2, model, inp, otp, cr + cw, costIn, costOut, costCache, r._lastUserT !== null ? Math.max(0, t - r._lastUserT) : 0, 0, 0, cr])
  ...
  -        const inp = e[3], otp = e[4], cache = e[5], costIn = e[6], costOut = e[7], costCache = e[8]
  +        const inp = e[3], otp = e[4], cache = e[5], costIn = e[6], costOut = e[7], costCache = e[8]
  +        const cacheRead = Number(e[12]) || 0
  +        sink.totals.cacheReadTokens += cacheRead
  ```
- 复现/验证: 构造 `assistant/message` 位于 `now` 当前小时边缘、`cacheReadTokens: 123`、`cacheWriteTokens: 0` 的事件，查询 `24h` 或 `today`，应断言 `totals.cacheReadTokens === 123`；同时断言 `cacheTokens === 123` 和费用未改变。
- 约束: `cacheTokens` 必须继续等于 `cr + cw`，费用仍按缓存读取价/输入价分别计算；同步更新 `src` 生成的 `lib/core/rollup.js`，不要改变 type 6 的 `actMs/endT` 下标。

## BUG-6 [逻辑] [严重度: 中]
- 文件: `src/core/rollup.js`
- 位置: `foldAppend` 的 `assistant/message` 分支，约第 296–340 行
- 现象: 没有 `usage` 的 assistant 消息在窗口边缘桶中不会被计入 `assistantMessages`/`totalMessages`，其时间也不会参与该桶的 `totalMs`。同一消息放在非边缘桶时计数正常。DSH 的事件类型定义明确允许 `assistant/message.usage` 缺省，例如没有 Token accounting 的 adapter 或中断消息。
- 根因: 只有 `if (usage)` 分支向 `b.evts` 写入 type 2 事件，而边缘查询只能从 `b.evts` 重建消息计数和跨度。
- 候选修复 diff:
  ```diff
         closeStep(r, ev.data, t)
         const usage = ev.data.usage
  +      if (!usage) {
  +        // 保留 message-only 边缘明细；不造 token/cost 行
  +        b.evts.push([t, 2, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  +      }
         if (usage) {
           const msg = ev.data.message
           const model = msg && msg.source ? String(msg.source.model || '') : ''
  ```
- 复现/验证: 在边缘小时放入一条无 `usage` 的 `assistant/message`，另放一条普通 `user/message`，调用 `queryUsage`，应断言边缘窗口的 `assistantMessages` 增加 1、`totalMessages` 增加 1，且该消息时间参与趋势桶跨度。
- 约束: 无 `usage` 的消息不能虚构 Token、费用或 detail Token 行；保留现有 `b.msg[2]` 与 `first/last` 统计。

## BUG-7 [逻辑] [严重度: 中]
- 文件: `src/core/rollup.js`
- 位置: `queryUsage` 的 previous-window 聚合，约第 573–585 行
- 现象: 上一周期某个非边缘小时桶只有 `user/message`、tool 消息或无 `usage` 的 assistant 消息时，上一周期的消息数被整体漏掉，导致环比百分比为 `null` 或数值错误；当前周期同样的桶却能正确计数。
- 根因: `prev.totals` 的五类消息计数被放在 `b.per.size > 0` 条件分支内，而 `b.per` 只在带 Token usage 的 assistant 消息出现时才有项。
- 候选修复 diff:
  ```diff
  -      } else if (inPrevB && b.per.size > 0) {
  -        if (modelSet === null) {
  -          for (const [model, per] of b.per) acc(prev, per)
  -        } else {
  -          for (const [model, per] of b.per) {
  -            if (modelSet.has(model)) acc(prev, per)
  -          }
  -        }
  +      } else if (inPrevB) {
  +        if (b.per.size > 0) {
  +          if (modelSet === null) {
  +            for (const [model, per] of b.per) acc(prev, per)
  +          } else {
  +            for (const [model, per] of b.per) {
  +              if (modelSet.has(model)) acc(prev, per)
  +            }
  +          }
  +        }
           prev.totals.userMessages += b.msg[0]
           prev.totals.injectedMessages += b.msg[1]
           prev.totals.assistantMessages += b.msg[2]
  ```
- 复现/验证: 固定 `today` 的 `now`，在上一周期 3 个非边缘小时各放一条 `user/message`，当前周期放两条，断言 `pct.userMessages === (2 - 3) / 3 * 100`（约 `-33.3`），而不是 `null`。
- 约束: 只把消息计数从 Token 聚合条件中解耦；模型筛选对 Token/费用的现有语义不变，不要重复计算 previous edge 桶。

## BUG-8 [逻辑] [严重度: 中]
- 文件: `src/core/rollup.js`
- 位置: `queryUsage` 趋势并集写回，约第 648–653 行
- 现象: 当前窗口边缘桶若只有一个孤立消息（没有 Token usage，也没有另一条消息产生 gap），趋势桶的 `sessions` 为 0，实际应为 1。多消息且有正间隔时，gap 分支恰好会创建桶而掩盖问题。
- 根因: `gkSpan` 已记录该会话的跨度，但 `edgeAccumulate` 只在 Token 或 gap 分支创建 `bucketMap` 条目；`if (!g) continue` 丢弃了没有数值指标的跨度。
- 候选修复 diff:
  ```diff
  +  const zeroBucket = () => ({ input: 0, output: 0, cache: 0, costIn: 0, costOut: 0,
  +    costCache: 0, durMs: 0, totalMs: 0, sessions: 0, activeMs: 0 })
     for (const [gk, ints] of gkInts) {
  -    const g = bucketMap.get(gk)
  -    if (!g) continue
  +    let g = bucketMap.get(gk)
  +    if (!g) { g = zeroBucket(); bucketMap.set(gk, g) }
       g.totalMs = mergeIntervals(ints)
       g.sessions = ints.length
     }
  ```
- 复现/验证: 在当前窗口的上边缘小时只放一条 `user/message`，同时在普通小时放一条作为对照，断言边缘趋势项 `sessions === 1`、普通趋势项也为 1。
- 约束: 单点消息的 `totalMs` 仍应为 0；只补足趋势元数据，不得给 Token/费用/时长凭空加值。

## BUG-9 [逻辑] [严重度: 中]
- 文件: `src/core/rollup.js`
- 位置: `bucketSeries`，约第 148–162 行；调用处 `queryUsage` 约第 681 行
- 现象: `24h`、`7d`、`30d`、`90d` 的趋势序列固定从“结束桶往前 N 个桶”开始，窗口下界若落在桶中间，最早那段窗口数据不在 `buckets` 中，但 KPI `totals` 仍包含它，造成趋势 Token/费用之和小于 KPI。比如 7 天滚动窗口下界为周三 13:30 时，周三 13:30 到当天结束的部分被 KPI 统计却没有趋势桶。
- 根因: `count` 分支直接使用 `end - step * (count - 1)`，没有与 `bucketKey(lo, gran)` 取更早者。
- 候选修复 diff:
  ```diff
     const end = bucketKey(hi, gran)
     let k = Number.isInteger(count) && count > 0
  -    ? end - step * (count - 1)
  +    ? Math.min(end - step * (count - 1), bucketKey(lo, gran))
       : bucketKey(lo, gran)
  ```
- 复现/验证: 构造事件落在 `24h` 窗口下界所在小时，比较 `queryUsage(...).totals.totalTokens` 与 `buckets.reduce((s, b) => s + b.input + b.output + b.cache, 0)`，修复后两者应相等；同时检查 7d/30d 的最早边缘桶不再缺失。
- 约束: 不得删除 `[lo, hi]` 内任一事件；接受边界不齐时多出一个部分桶，或采用等价的显式边缘桶合并方案，不要恢复固定 N 桶但丢数据的行为。

## BUG-10 [逻辑] [严重度: 中]
- 文件: `src/host.js`
- 位置: `cached` 与 `session/event` 的版本失效，约第 214–217、263–284、349–374 行
- 现象: 请求正在计算旧 rollup 时收到新事件，旧结果会以新的 `dataVersion` 写回缓存，之后 30 秒内的请求命中这份陈旧数据。例如事件后真实 `assistantMessages=1`、费用非零，但后续请求仍返回事件前的 0。
- 根因: `invalidate()` 只清 `cache` 不清 `inflight`；两个 `.then` 写回时读取的是当时的全局 `dataVersion`，没有绑定计算开始版本，且后续请求无条件复用旧版本的 in-flight Promise。
- 候选修复 diff:
  ```diff
  -  const inflight = new Map() // cache key → Promise
  +  const inflight = new Map() // cache key → { version, promise }
  +  function startInflight(key, compute) {
  +    const version = dataVersion
  +    const active = inflight.get(key)
  +    if (active && active.version === version) return active.promise
  +    const promise = Promise.resolve().then(compute).then((data) => {
  +      if (dataVersion === version) {
  +        cache.set(key, { at: Date.now(), data, failCount: 0, version })
  +      }
  +      return data
  +    }).finally(() => {
  +      if (inflight.get(key) && inflight.get(key).promise === promise) inflight.delete(key)
  +    })
  +    inflight.set(key, { version, promise })
  +    return promise
  +  }
  ...
  -    if (inflight.has(key)) return inflight.get(key)
  +    const active = inflight.get(key)
  +    if (active && active.version === dataVersion) return active.promise
  -    const p = compute().then((data) => {
  -      cache.set(key, { at: Date.now(), data, failCount: 0, version: dataVersion })
  -      return data
  -    })
  +    const p = startInflight(key, compute)
  ```
  对 stale-while-revalidate 分支也使用 `startInflight`，并只在 `version === dataVersion` 时写缓存；旧 Promise 的清理必须按对象身份判断，不能删除新版本 Promise。
- 复现/验证: 在 `compute` 已读取旧 rollup、尚未写缓存的同步点调用 `session/event` 并 `foldAppend` 新 assistant usage，再发第二个相同请求；第二个请求应等于新鲜 `queryUsage`，不应继续返回旧的 `assistant=0/cost=0`。
- 约束: 保留 single-flight、stale-while-revalidate 和失败计数语义；旧计算可以完成但不得覆盖新版本缓存，也不得由新请求复用旧版本 Promise。

## BUG-11 [逻辑] [严重度: 中]
- 文件: `src/host.js`
- 位置: `getRollups` 与 reconcile 的状态清理循环，约第 252–254、297–299 行
- 现象: 新会话已通过 `session/event` 创建了 `states` 条目，但在同一时段的 `listSessions()` 快照中尚未出现时，后续清理会把它无条件 `states.delete(id)`。其加载结果写入的也是已脱离 map 的旧对象，直到下一次 reconcile/事件才恢复，期间看板漏掉整段会话。
- 根因: 清理逻辑把“本次列表尚未观察到”直接等同于“会话已删除”，没有记录事件发生在列表快照之后，也没有保护事件创建但尚未被列表确认的 state。
- 候选修复 diff:
  ```diff
  +  let eventEpoch = 0
  ...
  -      st = { rollup: emptyRollup(), cwd: (header && header.cwd) || '', title: null, at: Date.now(), pending: [], needsReload: false, loadingPromise: null }
  +      st = { rollup: emptyRollup(), cwd: (header && header.cwd) || '', title: null, at: Date.now(), pending: [], needsReload: false, loadingPromise: null, listed: false, lastEventEpoch: 0 }
  ...
  +    st.lastEventEpoch = ++eventEpoch
         if (!st) {
  ...
  +    const listEpoch = eventEpoch
       const recs = await q.listSessions()
  ...
  +      const st = states.get(id)
  +      if (st && (!st.listed || st.lastEventEpoch > listEpoch || st.loading || st.pending.length)) continue
         states.delete(id)
  ```
  两个列表清理点都应采用同一护栏；处理 `recs` 时将对应 state 标记 `listed = true`，以便真正消失且没有新事件的旧会话仍能被删除。
- 复现/验证: 让 `listSessions()` 在快照后延迟返回或让新会话在列表遍历后创建，先触发 `session/event`，再执行一次 `getRollups`/reconcile；修复后该会话应持续出现在 `currentRollups()`，不必等待下一轮 60 秒 reconcile。
- 约束: 仍要清理已从列表消失且没有新事件的会话；不要因为一个历史事件永久阻止删除，事件 epoch 只应保护本次列表快照之后发生的事件。

## BUG-12 [性能] [严重度: 中]
- 文件: `src/host.js`
- 位置: `session/event` 回调与 `invalidate`，约第 214–217、263–266 行
- 现象: 每个 `session/event`，包括高频 `assistant/chunk`、`turn/start` 以及不属于已跟踪 state 的事件，都执行 `cache.clear()`。活跃生成期间缓存持续为空，客户端每 30 秒轮询都会对全部会话/桶重新聚合，30 秒 TTL 和 stale-while-revalidate 在高频事件场景下失去作用。
- 根因: 在判断事件是否会改变统计前无条件做全局缓存失效；事件回调没有按 `foldAppend` 实际影响的指标做筛选或去抖。
- 候选修复 diff:
  ```diff
  +  function affectsMetrics(event) {
  +    if (!event) return false
  +    if (event.type === 'assistant/chunk') return !!(event.data && event.data.chunk && event.data.chunk.type === 'finish')
  +    return event.type === 'user/message' || event.type === 'assistant/message' ||
  +      event.type === 'tool/call' || event.type === 'tool/result' || event.type === 'step/end'
  +  }
  ...
       const id = session && (session.id || (session.header && session.header.id))
       if (!id || !event || typeof event.time !== 'number') return
  -    invalidate()
  +    if (affectsMetrics(event)) invalidate()
         let st = states.get(id)
  ```
- 复现/验证: 对一个活跃 session 连续发送大量非 finish `assistant/chunk`，记录相同 usage 请求的 `queryUsage` 执行次数；修复后非指标事件期间应命中 30 秒缓存，而 finish/assistant/message/step/end 仍应立即失效。
- 约束: 不能延迟 Token、费用、消息数和已结束生成时长的可见更新；若存在其他会影响 `foldAppend` 聚合的合法事件类型，应加入 `affectsMetrics`，不能只依赖当前样例。

## BUG-13 [逻辑] [严重度: 中]
- 文件: `.gitignore`、`scripts/regenerate.cjs`、`src/core/pricing.js`、`lib/core/pricing.js`
- 位置: `.gitignore` 约第 29–30 行；`pricingSource` 约第 35–61 行；生成表模型条目
- 现象: 构建依赖的 `pricing/vibe-usage-model-pricing.csv` 被 `.gitignore` 忽略，干净 checkout 没有该文件时 `npm run build` 在第 39 行直接失败；当前工作区 CSV 已包含 `deepseek-v4-flash-vision-exp`，但跟踪的 `src/core/pricing.js`/`lib/core/pricing.js` 没有该模型，`priceFor` 返回 `null`，该模型会被按未匹配模型计为 0 费用，直到手动构建并提交生成表。
- 根因: 必需的定价源没有纳入版本控制，生成产物又没有与当前源同步，导致构建不可复现且运行时定价覆盖不完整。
- 候选修复 diff:
  ```diff
  --- a/.gitignore
  +++ b/.gitignore
  @@
  -# pricing source CSV (generated lib/core/pricing.js is what ships; do not commit source)
  -pricing/
  +# pricing/ is the tracked source for generated pricing tables.
  +# package.json files only ships lib/ and cordis.patch.yml.
  ```
  之后执行 `npm run build`，生成的两个表应包含：
  ```diff
  +  "deepseek-v4-flash-vision-exp":[3.08,9.24,0.098],
  ...
  +  "deepseek-v4-flash-vision-exp":"DeepSeek",
  ```
- 复现/验证: 用 `git archive HEAD` 得到没有被跟踪的 `pricing/` 的临时 checkout，运行 `npm run build` 应不再因缺 CSV 退出；在当前 CSV 下构建后导入 `src/core/rollup.js`，`priceFor('deepseek-v4-flash-vision-exp')` 应返回三元价格而不是 `null`，再运行 `npm test`。
- 约束: 定价源仍只能由 CSV 生成，不能手改 `src/core/pricing.js`/`lib/core/pricing.js`；npm 包仍不得包含原始 CSV。

## BUG-14 [逻辑] [严重度: 低]
- 文件: `src/core/rollup.js`
- 位置: `priceFor`、`priceForAt` 和 `queryUsage` 的 vendor 查表，约第 24、57、723 行
- 现象: 某个合法但未知的模型名为 `toString` 或 `__proto__` 时，`PRICES[id]`/`DS_PEAK[id]` 命中对象原型而不是价格记录。生效日期后 `priceForAt('toString', t)` 会访问不存在的 `ds.in` 并抛异常，折叠会话失败；生效日期前则可能把函数/Object.prototype 当价格数组参与计算，产生 `NaN`，JSON 响应变成 `null`。`VENDORS[m.id]` 也有同样的继承属性问题。
- 根因: 生成的普通对象表使用了继承属性查找，没有用 own-property 判断；模型名来自会话事件，不能假设永远避开原型键。
- 候选修复 diff:
  ```diff
  +const hasOwn = (table, key) => Object.prototype.hasOwnProperty.call(table, key)
  ...
  -  if (PRICES[id]) return { matched: id, p: PRICES[id] }
  +  if (hasOwn(PRICES, id)) return { matched: id, p: PRICES[id] }
  ...
  -  if (stripped !== id && PRICES[stripped]) return { matched: stripped, p: PRICES[stripped] }
  +  if (stripped !== id && hasOwn(PRICES, stripped)) return { matched: stripped, p: PRICES[stripped] }
  ...
  -    const key = DS_PEAK[stripped] ? stripped : (DS_PEAK[id] ? id : null)
  +    const key = hasOwn(DS_PEAK, stripped) ? stripped : (hasOwn(DS_PEAK, id) ? id : null)
  ...
  -  for (const m of models) vendors[m.id] = VENDORS[m.id] || '其他'
  +  for (const m of models) vendors[m.id] = hasOwn(VENDORS, m.id) ? VENDORS[m.id] : '其他'
  ```
- 复现/验证: 直接断言 `priceForAt('toString', Date.UTC(2026, 8, 1)) === null` 且 `foldSession([{ type:'assistant/message', time: Date.UTC(2026,8,1), data:{message:{source:{model:'toString'}}, usage:{inputTokens:1,outputTokens:0,cacheReadTokens:0,cacheWriteTokens:0}} }])` 不抛异常、费用为 0。
- 约束: 保留已知模型和 `-free` 后缀匹配；未知模型仍不计费，不能通过把原型属性当作价格来改变已有费用。

## BUG-15 [疑似] [逻辑] [严重度: 低]
- 文件: `src/core/rollup.js`
- 位置: `bjHour`/`isDSPeak` 约第 41–49 行；`hourOf`/`bucketKey`/`mondayOf` 约第 73、95–138 行；`client.js` `CalendarChart`
- 现象: DeepSeek 峰谷定价用 `bjHour`/`isDSPeak` 硬编码 UTC+8（北京时间），但所有其它分桶（hour/day/week、趋势、热力、日历）用服务器**本地**时间 `Date.getHours()/getDay()/getDate()`。服务器若不在 UTC+8，`DS_PEAK` 的高峰窗口与趋势/热力显示小时不一致；用户看到的高峰高亮与实际计费小时错位。
- 根因: 定价时基（UTC+8）与展示/聚合时基（本地时间）双轨并行，没有统一到一个时区。
- 候选修复 diff:
  ```diff
  -  function hourOf(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime() }
  +  // 所有分桶统一按 UTC+8 计算，与 DS_PEAK 定价时基一致
  +  function bjDate(t) { return new Date(t + 8 * 3600 * 1000) }
  +  function hourOf(t) { const d = bjDate(t); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()).getTime() }
  +  function mondayOf(t) { const d = bjDate(t); const day = d.getUTCDay(); const diff = (day + 6) % 7; const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff)); return monday.getTime() - 8 * 3600 * 1000 }
  ... // CalendarChart 同样改用 UTC+8 边界（endSunday/gridStart）
  ```
- 复现/验证: 在 `TZ=America/New_York` 下运行，`now = Date.UTC(2026,2,10,2,0)`（北京 10:00，高峰），构造该小时 DS 消息，断言 `isDSPeak`（按北京）与趋势桶所在本地小时一致；客户日历周起始也与北京周一对齐。
- 约束: 先确认产品到底采用本地日历还是固定 UTC+8；若统一为 UTC+8，server/client 的 day/week/heat/calendar 边界必须一起改，不能只动后端；不要影响 `DS_PEAK` 既有的（DST 安全）UTC+8 实现。

## BUG-16 [疑似] [逻辑] [严重度: 低]
- 文件: `src/core/rollup.js`
- 位置: `bucketSeries`，约第 156 行
- 现象: 自定义范围超过 500 个桶时循环静默停止，KPI 仍统计整个窗口但趋势只显示前 500 个桶，数据无错误提示。通常 UI 会把长范围自动降为 week，因此约 500 周以上才容易触发，但直接调用 day/hour 或极长自定义范围即可复现。
- 根因: `guard < 500` 是硬截断，不区分合法的长窗口和异常输入，也不返回截断状态。
- 候选修复 diff:
  ```diff
  -  let guard = 0
  -  while (k <= end && guard < 500) {
  +  while (k <= end) {
       keys.push(k)
       k += step
  -    guard += 1
     }
  ```
- 复现/验证: 调用 `bucketSeries(lo, lo + 1000 * DAY, 'day')`，修复后应返回 1001 个桶；通过 `queryUsage` 再断言趋势 Token 总和覆盖 KPI。若必须限制资源，应显式拒绝并返回错误，而不是静默丢数据。
- 约束: 需要资源上限时应改成可见的请求上限/错误或明确降采样，并保持 API 告知调用方，不能继续返回看似完整的部分结果。

## BUG-17 [疑似] [逻辑] [严重度: 低]
- 文件: `src/core/rollup.js`
- 位置: `prevWindow`，约第 119–122 行
- 现象: 除 `today` 外使用 `span = hi - lo + 1`，上一周期比当前时间跨度多 1 ms。对于边界恰好落在该 1 ms 的事件，会被纳入上一周期，环比基线与当前周期不再等长。注：当前窗口与上一窗口区间的闭/开语义未在产品层明确，因此标疑似待确认。
- 根因: 把离散的闭区间端点数量 `+1` 当成了时间持续时长；`today` 分支又使用无 `+1` 的 `DAY`，两种语义不一致。
- 候选修复 diff:
  ```diff
   export function prevWindow(range, lo, hi) {
     if (range === 'today') return [lo - DAY, lo - 1]
  -  const span = hi - lo + 1
  +  const span = hi - lo
     return [lo - span, lo - 1]
   }
  ```
- 复现/验证: 对 `custom` 的 `from=100,to=100` 或 `from=100,to=200` 构造位于上一窗口边界的事件，断言 previous window 的毫秒跨度与当前窗口的 `hi-lo` 相同且两个窗口不重叠。
- 约束: 先统一查询区间是闭区间还是半开区间；不要改变 `today` 现有的一天窗口和两个窗口不重叠的约束。

## BUG-18 [疑似] [性能] [严重度: 低]
- 文件: `src/client.js`
- 位置: `Dashboard` 的 `load`/effect，约第 999–1024 行
- 现象: 自定义日期输入的每次键入都会更新 `custom.from/to`，由于 `load` 的依赖包含这两个字段，`useEffect([load])` 会在用户尚未点击“应用”时立即发起一次 `/dash-api/usage` 请求；清空或逐字符编辑日期时会产生多次无效请求，并与最终请求竞争。
- 根因: 展示/编辑态的 custom 日期和已提交查询条件共用同一个 state，effect 没有等待显式应用动作。
- 候选修复 diff:
  ```diff
  -  const [custom, setCustom] = React.useState(prefs.custom || defaultCustom())
  +  const [custom, setCustom] = React.useState(prefs.custom || defaultCustom())
  +  const [appliedCustom, setAppliedCustom] = React.useState(custom)
  ...
  -  }, [range, custom.from, custom.to, modelSel, projectSel])
  +  }, [range, appliedCustom.from, appliedCustom.to, modelSel, projectSel])
  ...
  -             onApply: () => load(false)
  +             onApply: () => { setAppliedCustom(custom); load(false) }
  ```
- 复现/验证: 打开 custom，连续修改 from 日期但不点击应用，监听 network；修复后不应发送新的 usage 请求，点击应用后只发送一次包含最终日期的请求。
- 约束: 非 custom 范围、模型/项目筛选变化仍应立即刷新；保存的偏好应保存编辑后的日期或明确保存已应用日期，不能造成 UI 日期与实际查询条件无提示分离。

## BUG-19 [疑似] [安全] [严重度: 低]
- 文件: `src/host.js`（生成产物为 `lib/index.js`）
- 位置: `registerJsonRoute` 的错误处理，约第 34–37 行
- 现象: 读会话/聚合失败时，HTTP 500 响应把异常的 `message` 原样返回；持久化层异常若带本地文件路径、session ID 或内部实现信息，调用方可直接看到这些细节。
- 根因: 错误响应没有做对外归一化，直接序列化内部异常文本。
- 候选修复 diff:
  ```diff
       } catch (e) {
         res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
  -      res.end(JSON.stringify({ error: String((e && e.message) || e) }))
  +      res.end(JSON.stringify({ error: 'internal_error' }))
       }
  ```
- 复现/验证: 让 `sessionPersistence.readFrom` 抛出包含本地路径的异常，调用 `/dash-api/usage`，修复后响应只能包含稳定错误码，不应包含路径或堆栈片段。
- 约束: 客户端只依赖 `r.error` 判定失败；服务端日志仍可在受控日志通道记录完整异常，不要把调试细节放入 HTTP 响应。

## BUG-20 [疑似] [安全] [严重度: 低]
- 文件: `webhook_test.py`
- 位置: `webhook_test`，约第 3 行
- 现象: 名为 `password` 的明文口令 `secret123` 被写入仓库源码。它当前未使用且像测试占位值，无法仅凭代码确认是否是真实凭据，因此标为疑似；若被复用为 webhook 凭据，源码泄露即可导致未授权访问。
- 根因: 凭据以字面量形式硬编码，而不是从环境/密钥存储注入。
- 候选修复 diff:
  ```diff
  -    password = "secret123"
  +    password = os.environ.get('WEBHOOK_PASSWORD')
  +    if not password:
  +        raise RuntimeError("WEBHOOK_PASSWORD not set")
  ```
- 复现/验证: `grep -n "secret123\|password" webhook_test.py`；修复后在未设置 `WEBHOOK_PASSWORD` 时应明确失败或由测试 fixture 注入，仓库扫描不应发现真实口令。
- 约束: 测试若只需占位符应使用明显无效的 sentinel，并不得把它作为生产认证材料；保留 webhook 的其他测试行为。

## BUG-21 [疑似] [安全] [严重度: 低]
- 文件: `scripts/verify-pack.mjs`
- 位置: `scan`，约第 74 行
- 现象: 发布前自检脚本把作者姓名 `王凯彪` 与数字 `1764495524` 作为个人数据特征硬编码在仓库中。若该脚本被发布、镜像或公开复制，会扩大个人标识的暴露范围；这也使检查规则依赖具体作者而不是通用敏感信息检测。
- 根因: 将具体个人标识直接写入源代码，而不是从受保护配置或通用模式加载。
- 候选修复 diff:
  ```diff
  -        if (/gho_|ghp_|1764495524|王凯彪/.test(s)) fail('possible personal data in ' + fp.replace(dir, ''))
  +        const personalPattern = process.env.DASH_PERSONAL_SCAN_PATTERN || 'gho_|ghp_'
  +        if (new RegExp(personalPattern).test(s)) fail('possible personal data in ' + fp.replace(dir, ''))
  ```
- 复现/验证: `grep -n "王凯彪\|1764495524" scripts/verify-pack.mjs` 应无结果；设置受保护的扫描 pattern 后，仍应能检测对应 fixture。
- 约束: 保留 token 前缀（`gho_`/`ghp_`）等通用检测；正则来自环境时必须只在可信发布环境使用并处理无效 pattern，不能因修复而关闭泄露检查。

## BUG-22 [疑似] [逻辑] [严重度: 低]
- 文件: `scripts/regenerate.cjs`
- 位置: `findMatchingClosingBrace`，约第 87–146 行
- 现象: 构建脚本用手写扫描器从 host 源码抽取 `apply` 函数，但扫描器处理字符串/注释时没有完整识别正则字面量。未来 host 中出现含括号或注释样式文本的正则时，可能错误地改变大括号深度，生成错误的 `lib/index.js`；当前 host 正常构建，所以这是潜在构建脆弱性。
- 根因: 用不完整的词法状态机代替 JavaScript 解析器定位函数体。
- 候选修复 diff:
  ```diff
  -  const body = findMatchingClosingBrace(host, open)
  +  // 用 acorn 解析替代手写括号扫描，避免正则/注释导致大括号深度误判
  +  const acorn = require('acorn')
  +  const ast = acorn.parse(host, { ecmaVersion: 'latest', sourceType: 'module' })
  +  const applyNode = ast.body.find((node) => node.type === 'ExportNamedDeclaration' &&
  +    node.declaration && node.declaration.type === 'FunctionDeclaration' && node.declaration.id.name === 'apply').declaration
  +  const body = host.slice(applyNode.body.start + 1, applyNode.body.end - 1)
  ```
- 复现/验证: 在 host 中加入包含 `/\{/`、`//` 文本的正则字面量，运行 `npm run build` 并比较抽取的 `lib/index.js` 语法/行为；采用 AST 后生成结果应稳定，现有 `npm test` 仍应通过。
- 约束: 若引入 parser，必须把它作为构建依赖并保持 ESM host、CommonJS 构建脚本的边界；生成 client 的替换规则不能被改变。

---

验证说明：本仓库的 `npm test`（build → bench → smoke）在干净工作树上已通过，bench 对合成数据做字段级比对；但合成数据每个消息桶都带 usage，因此不会触发 BUG-6/7/8 这类“无 usage 边缘桶”分支，需补充针对性单测覆盖。以上为只读审查，未修改任何源文件。
