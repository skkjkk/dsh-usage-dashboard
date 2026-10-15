// 引擎纯函数的**接口契约**（剩余任务 D1）。
//
// scripts/bench.js 做的是「新引擎 vs 旧实现」的字段级对拍，跑得慢、失败时只能看到
// 脚本级断言；这里只钉住那些曾被改坏、或改坏后会被静默吞掉的契约，定位到具体函数：
//   - num() 的输入契约（负数/非数一律 0，审计 F29）
//   - bucketSeries() 的桶数与超限契约（超限必须抛 RangeError → 路由 400）
//   - priceFor / priceForAt / resolveDSModel 的归一与峰谷价语义（审计 F20/F22 系列）
//   - serializeRollup / deserializeRollup 往返 + _openSteps 活引用重绑（审计 F5）
//   - foldAppend 逐条折叠 == foldSession 一次性折叠
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  num,
  bucketSeries,
  bucketKey,
  hourOf,
  mondayOf,
  priceFor,
  priceForAt,
  resolveDSModel,
  isDSPeak,
  bjHour,
  foldSession,
  foldAppend,
  serializeRollup,
  deserializeRollup,
  queryUsage,
  queryDetailAll,
  createDetailAggregator,
  assertExportRows,
  EXPORT_MAX_ROWS
} from '../src/core/rollup.js'

const DAY = 86400000
// 北京时间 h 点（东八区）→ UTC 毫秒
const bj = (y, m, d, h) => Date.UTC(y, m, d, h - 8)

test('num(): 正有限数原样返回，其余一律 0', () => {
  assert.equal(num(5), 5)
  assert.equal(num(0.5), 0.5)
  assert.equal(num(0), 0)
  assert.equal(num(-3), 0, '负数只可能来自损坏日志，归 0 是刻意的')
  assert.equal(num(-0.0001), 0)
  assert.equal(num(NaN), 0)
  assert.equal(num(Infinity), 0)
  assert.equal(num(-Infinity), 0)
  assert.equal(num('7'), 0, '字符串不参与运算')
  assert.equal(num(null), 0)
  assert.equal(num(undefined), 0)
  assert.equal(num({}), 0)
  assert.equal(num([]), 0)
})

test('bucketSeries(): 预设桶数是最小值，桶数上限抛 RangeError', () => {
  const lo = Date.UTC(2026, 8, 1, 3, 30) // 非整点下界
  const hi = lo + 30 * DAY
  const days = bucketSeries(lo, hi, 'day', 30)
  assert.ok(days.length >= 30, '跨非整点下界时会多一个前导桶，不能少于预设')
  assert.equal(days.length, 31)
  for (let i = 1; i < days.length; i++) assert.equal(days[i] - days[i - 1], DAY, '桶等距')

  // count 非法（0 / 负数 / 非整数）时退化为「lo→hi 覆盖」
  const fromLo = bucketSeries(lo, hi, 'day', 0)
  assert.equal(fromLo.length, 31)

  // 超过上限是**可由 URL 触发的输入错误**，必须抛 RangeError（路由据此回 400）
  assert.throws(
    () => bucketSeries(Date.UTC(2000, 0, 1), Date.UTC(2026, 0, 1), 'hour', 1),
    (e) => e instanceof RangeError && /exceeds/.test(e.message)
  )
  // 恰好在上限内不抛
  assert.doesNotThrow(() => bucketSeries(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1) + 1000 * 3600000, 'hour', 1))
})

test('priceFor(): 只在「剥出的名字精确命中」时计价', () => {
  assert.equal(priceFor('deepseek-v4-flash').matched, 'deepseek-v4-flash')
  assert.equal(priceFor('GPT-5').matched, 'gpt-5', '精确命中是大小写不敏感的')

  // 市场后缀白名单之外的模型名绝不能被通用剥后缀：gpt-5-pro 不是 gpt-5
  assert.equal(priceFor('gpt-5-pro'), null)
  assert.equal(priceFor('deepseek-flash-bogus'), null, '未知 deepseek 前缀不得被前缀计价')
  assert.equal(priceFor('deepseek-v4-prototype'), null)

  // -free 的语义是「剥掉后按基座计价」：基座收费则收费，基座免费则 0
  assert.deepEqual(priceFor('space-bunny-free').p, [1.05, 4.2, 0.21])
  assert.deepEqual(priceFor('ling-3.1-flash-free').p, [0, 0, 0])

  // provider 作用域 / 日期后缀：命中基础型号，命中不了仍是 null
  assert.equal(priceFor('deepseek-ai/DeepSeek-V4-Flash-0731').matched, 'deepseek-v4-flash')
  assert.equal(priceFor('gemini-3-pro-002').matched, 'gemini-3-pro')
  assert.equal(priceFor('made-up-model-20260101'), null)

  assert.equal(priceFor(''), null)
  assert.equal(priceFor(null), null)
  assert.equal(priceFor(undefined), null)
})

test('priceForAt(): DeepSeek 峰谷价 + 生效前回退 CSV 历史价', () => {
  // 工作日高峰：9:00-12:00 / 14:00-18:00（北京时间）；空闲为高峰一半
  assert.deepEqual(priceForAt('deepseek-flash', bj(2026, 9, 14, 10)).p, [2, 8, 0.04])
  assert.deepEqual(priceForAt('deepseek-flash', bj(2026, 9, 14, 13)).p, [1, 4, 0.02])
  assert.deepEqual(priceForAt('deepseek-flash', bj(2026, 9, 17, 10)).p, [1, 4, 0.02], '周末全程空闲价')
  assert.equal(isDSPeak(bj(2026, 9, 14, 9)), true)
  assert.equal(isDSPeak(bj(2026, 9, 14, 12)), false)
  assert.equal(isDSPeak(bj(2026, 9, 14, 14)), true)
  assert.equal(isDSPeak(bj(2026, 9, 14, 18)), false)
  assert.equal(bjHour(bj(2026, 9, 14, 15)), 15)

  // V4.1 Flash 新价自 2026-09-10 12:00（北京时间）起：之前 legacy 档，之后 v41 档
  const sep1 = priceForAt('deepseek-flash', bj(2026, 8, 1, 10)) // 9/1 周二 10:00
  assert.deepEqual(sep1.p, [3, 9, 0.1])
  assert.deepEqual(sep1.peak, [3, 9, 0.1])
  assert.deepEqual(sep1.off, [1.5, 4.5, 0.05])
  assert.deepEqual(priceForAt('deepseek-flash', bj(2026, 8, 11, 10)).p, [2, 8, 0.04]) // 9/11 周五 10:00
  // Pro 自 2026-09-14 12:00 起路由到 Flash 单价
  assert.deepEqual(priceForAt('deepseek-v4-pro', bj(2026, 8, 11, 10)).p, [9, 27, 0.3]) // 9/11 仍是 Pro 价
  assert.deepEqual(priceForAt('deepseek-v4-pro', bj(2026, 8, 15, 10)).p, [2, 8, 0.04]) // 9/15 已路由

  // 峰谷价生效前（2026-08-17 00:00 前）一律用 CSV 静态价，保证旧事件不被新价重算
  const prePeak = priceForAt('deepseek-flash', bj(2026, 7, 1, 10)) // 8/1 周六 10:00
  assert.deepEqual(prePeak.p, [3, 9, 0.1])
  assert.equal(prePeak.ds, undefined)

  // resolveDSModel 与 priceFor 必须一致地「未匹配」
  assert.equal(resolveDSModel('deepseek-flash-bogus'), null)
  assert.equal(resolveDSModel('deepseek-v4-prototype'), null)
  assert.equal(resolveDSModel('global:deepseek-v4.1-flash'), 'deepseek-flash')
  assert.equal(resolveDSModel(''), null)
})

// ---- 折叠：逐条 == 一次性 ----
const sessionFixture = (t0) => [
  { type: 'user/message', time: t0, data: { source: { kind: 'user' } } },
  { type: 'step/start', time: t0 + 1, data: { turn: 0, step: 0 } },
  { type: 'assistant/chunk', time: t0 + 2000, data: { turn: 0, step: 0, chunk: { type: 'text-delta', index: 0, text: 'x' } } },
  { type: 'assistant/chunk', time: t0 + 5000, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
  {
    type: 'assistant/message',
    time: t0 + 5001,
    data: {
      turn: 0,
      step: 0,
      usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 1 },
      message: { id: 'm1', source: { model: 'gpt-5' } }
    }
  },
  { type: 'tool/call', time: t0 + 6000, data: { callId: 'c1' } },
  { type: 'tool/result', time: t0 + 7000, data: {} }
]

test('foldAppend 逐条折叠与 foldSession 一次性折叠逐字节一致', () => {
  const t0 = bj(2026, 9, 14, 10)
  const events = sessionFixture(t0)
  const oneShot = foldSession(events)
  const incremental = foldSession([])
  for (const ev of events) foldAppend(incremental, ev)
  assert.equal(
    JSON.stringify(serializeRollup(incremental)),
    JSON.stringify(serializeRollup(oneShot)),
    '增量折叠与全量折叠必须字节级一致（含 seed/去重状态）'
  )
  const win = { range: 'custom', from: t0 - DAY, to: t0 + DAY }
  assert.deepEqual(queryUsage([incremental], win, {}).totals, queryUsage([oneShot], win, {}).totals)
})

test('serialize/deserialize 往返：截断后续算 == 整段折叠，且活引用重新绑回桶', () => {
  const t0 = bj(2026, 9, 14, 10)
  const all = sessionFixture(t0)
  const trunc = all.slice(0, 3) // 停在 generation 中间（step/start + text-delta，无 finish）
  const rest = all.slice(3)

  const continuous = foldSession(all)
  const truncated = foldSession(trunc)
  // 夹具必须真的留下未闭合的 generation，否则本用例退化成「两边都没东西」
  const truncWire = serializeRollup(truncated)
  const openGen = truncWire.openSteps.filter((e) => Array.isArray(e[2]))
  assert.equal(openGen.length, 1, '截断夹具应留下一个未闭合的 generation')

  // 磁盘缓存就是 JSON 文件：必须经过真实的 JSON 往返
  const resumed = deserializeRollup(JSON.parse(JSON.stringify(truncWire)))
  assert.equal(resumed._openSteps.size, 1)
  for (const [key, step] of resumed._openSteps) {
    assert.equal(
      step.generation.bucketEvts,
      resumed.buckets.get(step.generation.hk).evts,
      'generation.bucketEvts 必须重新绑回重建后的桶 evts（否则 closeStep 静默丢 activeMs）: ' + key
    )
  }
  for (const ev of rest) foldAppend(resumed, ev)

  const win = { range: 'custom', from: t0 - DAY, to: t0 + DAY }
  const a = queryUsage([continuous], win, {})
  const b = queryUsage([resumed], win, {})
  assert.ok(a.totals.activeMs > 0, '夹具必须产生非零 activeMs')
  assert.equal(b.totals.activeMs, a.totals.activeMs)
  assert.equal(b.totals.inputTokens, a.totals.inputTokens)
  assert.equal(b.totals.outputTokens, a.totals.outputTokens)
  assert.equal(b.totals.assistantMessages, a.totals.assistantMessages)
  assert.equal(b.totals.totalMs, a.totals.totalMs)
  assert.equal(
    JSON.stringify(serializeRollup(resumed)),
    JSON.stringify(serializeRollup(continuous)),
    '续算后的序列化结果必须与整段折叠一致'
  )
})

test('deserializeRollup 对旧格式缓存（缺折叠状态字段）保持宽容', () => {
  const t0 = bj(2026, 9, 14, 10)
  const wire = serializeRollup(foldSession(sessionFixture(t0)))
  const legacy = { first: wire.first, last: wire.last, buckets: wire.buckets, modelMeta: wire.modelMeta }
  const r = deserializeRollup(legacy)
  assert.equal(r._openSteps.size, 0)
  assert.equal(r._seenUsage.size, 0)
  assert.equal(r.seededWithoutMarker, false)
  assert.equal(r._seedCut, null)
  // 桶仍然可用（token 汇总不依赖折叠状态）
  const win = { range: 'custom', from: t0 - DAY, to: t0 + DAY }
  assert.equal(queryUsage([r], win, {}).totals.inputTokens, 10)
})

test('queryUsage 的 pct 只可能是 null 或有限值（前端 fmtPct 依赖该契约）', () => {
  const t0 = bj(2026, 9, 14, 10)
  const rollup = foldSession(sessionFixture(t0))
  const win = { range: 'custom', from: t0 - DAY, to: t0 + DAY }
  const withPrev = queryUsage([rollup], win, {})
  const values = Object.values(withPrev.totals.pct)
  assert.equal(values.length, 10)
  for (const v of values) {
    assert.ok(v === null || Number.isFinite(v), 'pct 只允许 null 或有限数，实际: ' + String(v))
  }
  // 以零为基线时没有有限定义 → null（而不是 +Infinity / NaN）
  const empty = queryUsage([foldSession([])], win, {})
  for (const [k, v] of Object.entries(empty.totals.pct)) {
    assert.equal(v, null, '空基线时 ' + k + ' 应为 null')
  }
})

// ---- 遗留低优先项 F1：Date.UTC 的 0–99 年映射 ----
// 从 test 里构造公元 y 年的时间戳不能用 Date.UTC（同样是那个 bug），用 setUTCFullYear。
const utcAt = (y, m, d, h) => {
  const dt = new Date(0)
  dt.setUTCFullYear(y, m, d)
  dt.setUTCHours(h || 0, 0, 0, 0)
  return dt.getTime()
}
const BJ = 8 * 3600000
const bjYear = (t) => new Date(t + BJ).getUTCFullYear()

test('F1: 0–99 年的桶键不再被 Date.UTC 映射成 1900+年', () => {
  // 公元 50 年 1 月 1 日 12:00 UTC：整点，桶键必须就是它自己
  const t = utcAt(50, 0, 1, 12)
  assert.equal(hourOf(t), t, '整点时间戳的 hour 桶键就是它本身')
  assert.equal(bjYear(bucketKey(t, 'day')), 50, 'day 桶键必须留在公元 50 年（修复前是 1950）')
  // 周桶要挑年中的时间：元旦所在周的周一可能落在上一年（那是正确的语义，不是 bug）
  assert.equal(bjYear(mondayOf(utcAt(50, 5, 15, 12))), 50, 'week 桶键必须留在公元 50 年（修复前是 1950）')
  // 负数年份同样走显式构造路径
  assert.equal(bjYear(bucketKey(utcAt(-50, 5, 1, 12), 'day')), -50)

  // 一整月的早窗口：桶键正确、都在年内，不抛
  const keys = bucketSeries(utcAt(50, 0, 1, 0), utcAt(50, 1, 1, 0), 'day', null)
  assert.ok(keys.length >= 31, '公元 50 年 1 月应有 31+ 个日桶，实际 ' + keys.length)
  for (const k of keys) assert.equal(bjYear(k), 50, '桶键越界: ' + k)

  // 极端早的下界一直到现在：修复前会被静默截到 1901 年（桶数远低于上限、200 空结果），
  // 现在必须因超出桶上限抛 RangeError（路由回 400 bad_request）。
  assert.throws(
    () => bucketSeries(utcAt(1, 0, 1, 0), Date.now(), 'day', null),
    (e) => e instanceof RangeError,
    'year 1 → now 必须抛 RangeError（不再静默变短）'
  )

  // 快路径不能改变现代时间的取值：y ≥ 100 仍走 Date.UTC（现代整点 → 桶键就是本身）
  const modern = bj(2026, 9, 14, 10)
  assert.equal(hourOf(modern), modern)
  assert.equal(bucketKey(modern, 'day'), Date.UTC(2026, 9, 14) - BJ)
})

// ---- 遗留低优先项 F2：导出分片聚合 ----
const detailFixture = () => {
  const t0 = bj(2026, 9, 14, 10)
  const session = (cwd, model, times) => {
    const events = []
    let seq = 0
    for (const t of times) {
      events.push({ type: 'user/message', time: t, seq: ++seq, data: { source: { kind: 'user' } } })
      events.push({
        type: 'assistant/message',
        time: t + 1000,
        seq: ++seq,
        data: {
          turn: 0,
          step: 0,
          usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 1 },
          message: { id: 'm' + seq, source: { model } }
        }
      })
    }
    const r = foldSession(events)
    r.cwd = cwd
    r.projectTitle = cwd
    return r
  }
  return [
    session('D:/a', 'gpt-5', [t0, t0 + DAY, t0 + 2 * DAY]),
    session('D:/b', 'deepseek-v4-flash', [t0 + 3600000, t0 + DAY + 3600000]),
    session('D:/a', 'gpt-5', [t0 + 3 * DAY])
  ]
}

test('F2: createDetailAggregator 任意分批 == queryDetailAll 一次取全', () => {
  const rollups = detailFixture()
  const t0 = bj(2026, 9, 14, 10)
  // 非整点下界/上界都会走 evts 逐事件精确路径，分批边界不能影响结果
  const win = { range: 'custom', from: t0 - 3 * 3600000, to: t0 + 3 * DAY + 1800000 }
  const oneShot = queryDetailAll(rollups, win)
  assert.ok(oneShot.rows.length >= 4, '夹具必须产出多行（多桶 × 多项目 × 多模型），实际 ' + oneShot.rows.length)
  assert.ok(new Set(oneShot.rows.map((r) => r.project)).size >= 2, '夹具必须覆盖多个项目（行按 桶×模型×项目 分组）')

  for (const chunk of [1, 2, 3, 7, 100]) {
    const agg = createDetailAggregator(win)
    for (let i = 0; i < rollups.length; i += chunk) {
      agg.addRange(rollups, i, Math.min(rollups.length, i + chunk))
    }
    const got = agg.finish()
    assert.equal(got.gran, oneShot.gran, 'chunk=' + chunk + ' 的分辨率必须一致')
    assert.deepEqual(got.rows, oneShot.rows, 'chunk=' + chunk + ' 的分批结果必须与一次取全一致')
  }

  // 越界/非法批次不能抛：宿主的分片循环最后一段可能短于 chunk，也允许空段
  const agg = createDetailAggregator(win)
  agg.addRange(rollups, 0, 0)
  agg.addRange(rollups, rollups.length, rollups.length + 5)
  agg.addRange(rollups, -3, 1)
  assert.ok(agg.finish().rows.length >= 0)

  // 缺 range 时与 queryDetail/queryDetailAll 同契约：空结果、不抛
  const none = createDetailAggregator(null)
  none.addRange(rollups, 0, rollups.length)
  assert.deepEqual(none.finish(), { gran: 'hour', rows: [] })
})

test('F2: assertExportRows 超上限抛 RangeError（路由回 400），恰好在上限不抛', () => {
  assert.equal(assertExportRows([]), 0)
  assert.doesNotThrow(() => assertExportRows(undefined), '非数组按 0 行处理')
  assert.equal(assertExportRows(new Array(EXPORT_MAX_ROWS).fill(0)), EXPORT_MAX_ROWS)
  assert.throws(
    () => assertExportRows(new Array(EXPORT_MAX_ROWS + 1).fill(0)),
    (e) => e instanceof RangeError && /exceeds/.test(e.message) && e.message.indexOf(String(EXPORT_MAX_ROWS)) !== -1,
    '超过 ' + EXPORT_MAX_ROWS + ' 行必须抛 RangeError，消息里带上限（不含调用方输入）'
  )
})
