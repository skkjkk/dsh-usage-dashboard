// dsh-usage-dashboard core — pure aggregation engine (no ctx, no IO, no DOM).
//
// Architecture (v0.2 performance pass):
//   1. foldSession(events) materializes ONE compact per-session rollup:
//      sparse hourly buckets (tokens/cost per model, message counts,
//      durations), model metadata and the session time span. All events are
//      folded exactly once per session revision; the result is cached by the
//      host layer keyed on the persistence revision token.
//   2. queryUsage / queryDetail / queryCalendar answer ANY time window,
//      granularity and model/project filter purely in memory from the
//      rollups — no disk reads after the first fold. Hourly buckets are
//      up-rolled to day/week on demand; heatmaps are re-derived from buckets
//      per query so window filters stay correct.
//
// All functions are pure: deterministic input → deterministic output.

// 定价表：由 scripts/regenerate.cjs 从 pricing/vibe-usage-model-pricing.csv 生成（USD × 7 → ¥/M tokens），见 ./pricing.js
import { PRICES, VENDORS } from './pricing.js'
import { BusinessException } from './errors.js'

const hasOwn = (table, key) => Object.prototype.hasOwnProperty.call(table, key)

// ---- named constants (replace scattered magic numbers) ----
const HOUR = 3600000
const DAY = 86400000
const WEEK = 7 * DAY
const BJ_OFFSET = 8 * HOUR
const INTER_MSG_GAP_MS = 600000 // ≤ 10 min inter-message gap
const MAX_SERIES_BUCKETS = 50000
const BUCKET_MSG_TYPES = 5 // [user, injected, assistant, tool_call, tool_result]
const EVT_FIELD_LENGTH = 15
// per-model aggregate indices
const PER_INPUT = 0
const PER_OUTPUT = 1
const PER_CACHE = 2
const PER_COST_IN = 3
const PER_COST_OUT = 4
const PER_COST_CACHE = 5
const PER_CALLS = 6
const PER_RESP_MS_SUM = 7
const PER_MATCHED = 8
const PER_CACHE_READ = 9
const PER_LATENCY_BINS = 10
const PER_BILLED_INPUT_TOTAL = 11
const PER_OBSERVED_BILLED = 12
const PER_OBSERVED_INPUT = 13
// per-bucket msg-count indices
const MSG_USER = 0
const MSG_INJECTED = 1
const MSG_ASSISTANT = 2
const MSG_TOOL_CALL = 3
const MSG_TOOL_RESULT = 4
const EVT_IDX_T = 0
const EVT_IDX_TYPE = 1
const EVT_IDX_MODEL = 2
const EVT_IDX_IN = 3
const EVT_IDX_OUT = 4
const EVT_IDX_CACHE = 5
const EVT_IDX_COST_IN = 6
const EVT_IDX_COST_OUT = 7
const EVT_IDX_COST_CACHE = 8
const EVT_IDX_DUR_UA = 9
const EVT_IDX_ACT_MS = 10
const EVT_IDX_END_T = 11
const EVT_IDX_CACHE_READ = 12
const EVT_IDX_CACHE_KNOWN = 13
const EVT_IDX_LATENCY_KNOWN = 14

// 模型 → 定价；未匹配返回 null（不计费）
export function priceFor(model) {
  const id = String(model || '')
  if (!id) return null
  if (hasOwn(PRICES, id)) return { matched: id, p: PRICES[id] }
  const stripped = id.replace(/-free$/, '')
  if (stripped !== id && hasOwn(PRICES, stripped)) return { matched: stripped, p: PRICES[stripped] }
  return null
}

// ---------- DeepSeek 峰谷定价（2026-08-17 00:00 北京时间起生效） ----------
// 官方口径（UTC+8）：高峰时段 = 周一至周五 9:00-12:00 与 14:00-18:00，其余（含周末）为空闲时段；
// 空闲时段价格为高峰时段的一半（元/百万 tokens）。生效前的事件按 CSV 静态价（USD×7）计。
const DS_PEAK_SINCE = Date.UTC(2026, 7, 16, 16) // 2026-08-16T16:00Z = 08-17 00:00 +08:00
// model → [输入(缓存未命中), 输出, 缓存(命中)] × [空闲, 高峰]
const DS_PEAK = {
  'deepseek-v4-flash': { in: [1.5, 3.0], out: [4.5, 9.0], cache: [0.05, 0.10] },
  'deepseek-v4-flash-vision-exp': { in: [1.5, 3.0], out: [4.5, 9.0], cache: [0.05, 0.10] },
  'deepseek-v4-pro': { in: [4.5, 9.0], out: [13.5, 27.0], cache: [0.15, 0.30] }
}

// 北京时间（UTC+8）小时数 0-23
export function bjHour(t) {
  return new Date(t + BJ_OFFSET).getUTCHours()
}

// t 是否处于高峰时段（工作日 9:00-12:00、14:00-18:00，北京时间）
export function isDSPeak(t) {
  const bj = new Date(t + BJ_OFFSET)
  const day = bj.getUTCDay()
  if (day === 0 || day === 6) return false
  const h = bj.getUTCHours()
  return (h >= 9 && h < 12) || (h >= 14 && h < 18)
}

// 按事件时间取价：DeepSeek 峰谷模型在 2026-08-17 00:00（北京时间）后按峰/谷价计费；
// 其余模型与生效前的事件一律使用静态价（CSV）。返回 { matched, p, peak?, off?, ds? }。
export function priceForAt(model, t) {
  const id = String(model || '')
  if (!id) return null
  const stripped = id.replace(/-free$/, '')
  const key = hasOwn(DS_PEAK, stripped) ? stripped : (hasOwn(DS_PEAK, id) ? id : null)
  if (key && typeof t === 'number' && t >= DS_PEAK_SINCE) {
    const pk = isDSPeak(t) ? 1 : 0
    const ds = DS_PEAK[key]
    return {
      matched: id,
      p: [ds.in[pk], ds.out[pk], ds.cache[pk]],
      peak: [ds.in[1], ds.out[1], ds.cache[1]],
      off: [ds.in[0], ds.out[0], ds.cache[0]],
      ds: true
    }
  }
  return priceFor(id)
}

export function num(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

// Response-latency histogram
const LATENCY_BIN_UPPER = [250, 500, 1000, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 60000, 120000, 300000, 600000, 1800000, 3600000]
function newLatencyBins() { return new Array(LATENCY_BIN_UPPER.length + 1).fill(0) }
function latencyBin(ms) {
  for (let i = 0; i < LATENCY_BIN_UPPER.length; i++) {
    if (ms <= LATENCY_BIN_UPPER[i]) return i
  }
  return LATENCY_BIN_UPPER.length
}
function mergeLatencyBins(target, source) {
  if (!source) return
  for (let i = 0; i < target.length; i++) target[i] += source[i] || 0
}
function quantileFromBins(bins, q) {
  if (!bins) return null
  const total = bins.reduce((sum, n) => sum + (Number(n) || 0), 0)
  if (!(total > 0)) return null
  const wanted = Math.max(1, Math.ceil(total * q))
  let seen = 0
  for (let i = 0; i < bins.length; i++) {
    seen += Number(bins[i]) || 0
    if (seen >= wanted) return LATENCY_BIN_UPPER[Math.min(i, LATENCY_BIN_UPPER.length - 1)]
  }
  return LATENCY_BIN_UPPER[LATENCY_BIN_UPPER.length - 1]
}
function cacheRate(read, observed) {
  return observed > 0 ? read / observed * 100 : null
}
function cacheCoverage(observed, billed) {
  return billed > 0 ? observed / billed * 100 : 0
}
function pad2(n) { return n < 10 ? '0' + n : String(n) }

// All dashboard buckets use the fixed UTC+8 business timezone. Bucket keys are
// still absolute timestamps: a Beijing midnight is represented by its UTC time.
function bjDate(t) { return new Date(t + BJ_OFFSET) }
function bjDayStart(t) {
  const d = bjDate(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - BJ_OFFSET
}
function bjSundayStart(t) {
  const d = bjDate(t)
  return bjDayStart(t) - d.getUTCDay() * DAY
}
export function mondayOf(t) {
  const d = bjDate(t)
  const day = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - BJ_OFFSET
}
export function cellOf(t) {
  const d = bjDate(t)
  return d.getUTCDay() * 24 + d.getUTCHours()
}
function weekLabel(monday) {
  const s = bjDate(monday)
  const e = bjDate(monday + 6 * DAY)
  return (s.getUTCMonth() + 1) + '/' + s.getUTCDate() + '-' + (e.getUTCMonth() + 1) + '/' + e.getUTCDate()
}
export function hourOf(t) {
  const d = bjDate(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()) - BJ_OFFSET
}
export function rangeBounds(req) {
  const input = req || {}
  const now = typeof input.now === 'number' && Number.isFinite(input.now) ? input.now : Date.now()
  if (!input.range) return [0, now]
  const sod = bjDayStart(now)
  switch (input.range) {
    case 'today': return [sod, now]
    case '24h': return [now - DAY, now]
    case '7d': return [now - 7 * DAY, now]
    case '30d': return [now - 30 * DAY, now]
    case '90d': return [now - 90 * DAY, now]
    case 'custom': {
      const from = typeof input.from === 'number' && Number.isFinite(input.from) ? input.from : 0
      const to = typeof input.to === 'number' && Number.isFinite(input.to) ? input.to : now
      return from <= to ? [from, to] : [to, from]
    }
    default: return [0, now]
  }
}
export function prevWindow(range, lo, hi) {
  if (range === 'today') return [lo - DAY, lo - 1]
  // Windows use inclusive event endpoints but a continuous duration of hi-lo;
  // keep the previous window adjacent without adding a phantom millisecond.
  const span = Math.max(0, hi - lo)
  return [lo - span, lo - 1]
}
export function pickGranularity(req, lo, hi) {
  if (req.range === 'today' || req.range === '24h') return 'hour'
  if (req.range === '7d' || req.range === '30d') return 'day'
  if (req.range === '90d') return 'week'
  const span = hi - lo
  if (span <= 48 * HOUR) return 'hour'
  if (span <= 62 * DAY) return 'day'
  return 'week'
}
export function bucketKey(t, gran) {
  if (gran === 'hour') return hourOf(t)
  if (gran === 'day') return bjDayStart(t)
  return mondayOf(t)
}
export function bucketLabel(key, gran) {
  const d = bjDate(key)
  if (gran === 'hour') return pad2(d.getUTCHours())
  if (gran === 'day') return (d.getUTCMonth() + 1) + '/' + d.getUTCDate()
  return weekLabel(key)
}
// Return all calendar buckets touched by [lo, hi]. Preset counts are a minimum:
// a rolling window whose lower edge is mid-bucket needs one extra leading bucket
// so its KPI data is still represented in the trend.
export function bucketSeries(lo, hi, gran, count) {
  const keys = []
  const step = gran === 'hour' ? HOUR : gran === 'day' ? DAY : WEEK
  const end = bucketKey(hi, gran)
  const naturalStart = end - step * (count - 1)
  let k = Number.isInteger(count) && count > 0
    ? Math.min(naturalStart, bucketKey(lo, gran))
    : bucketKey(lo, gran)
  while (k <= end) {
    if (keys.length >= MAX_SERIES_BUCKETS) {
      throw new RangeError('trend range exceeds ' + MAX_SERIES_BUCKETS + ' buckets')
    }
    keys.push(k)
    k += step
  }
  return keys
}

export function presetBucketCount(range, gran) {
  if (range === '24h' && gran === 'hour') return 24
  if (range === '7d' && gran === 'day') return 7
  if (range === '30d' && gran === 'day') return 30
  if (range === '90d' && gran === 'week') return 13
  return null
}

// ---------- fold: events → one session rollup ----------
// Bucket layout (sparse hourly):
//   per:    Map<model, [in, out, cache, costIn, costOut, costCache, calls, durUA]>
//   msg:    [user, injected, assistant, toolCalls, toolResults]
//   durGap: sum of ≤10min inter-message gaps starting in this hour (usage durMs)
//   activeMs: AI generation interval (first output chunk → finish) attributed
//             to the hour where generation started; TTFT/tool wait excluded
//   first/last/hasMsg: bucket message span (trend totalMs / sessions)
//   evts:   lightweight per-event detail [t, type, model|null, in, out, cache,
//           costIn, costOut, costCache, durUA, actMs, endT, cacheRead] — used
//           to make window EDGE buckets exact (windows rarely align on the
//           hour). Non-edge buckets use the aggregates. type: 0 user, 1 injected,
//           2 assistant, 3 toolCall, 4 toolResult, 5 step/start, 6 generation
//
// foldSession folds a FULL event list; foldAppend applies ONE new event to an
// existing rollup. The host keeps rollups live via DSH's "session/event"
// stream (foldAppend per event), so it never re-parses full session logs on
// refresh. The rollup carries internal state (_lastMsgT / _lastUserT /
// _openSteps) so appends bridge generation intervals across event batches.
// exactly like a full fold.
export function emptyRollup() {
  return {
    first: null,
    last: null,
    buckets: new Map(),
    modelMeta: new Map(),
    _lastMsgT: null,
    _lastUserT: null,
    // turn:step → { generation: { t, hk, evtIdx, bucketEvts } | null }
    // A generation starts at the first real assistant output chunk, not at
    // step/start (which includes queueing and TTFT).
    _openSteps: new Map()
  }
}

function bucketAt(r, t) {
  const hk = hourOf(t)
  let b = r.buckets.get(hk)
  if (!b) {
    b = { per: new Map(), msg: new Array(BUCKET_MSG_TYPES).fill(0), durGap: 0, activeMs: 0, first: 0, last: 0, hasMsg: false, evts: [] }
    r.buckets.set(hk, b)
  }
  return b
}

function stepKey(data) {
  return data && data.turn + ':' + data.step
}

function openGeneration(r, data, t) {
  const key = stepKey(data)
  if (key === undefined || key === 'undefined:undefined') return null
  let step = r._openSteps.get(key)
  if (!step) {
    step = { generation: null }
    r._openSteps.set(key, step)
  }
  if (!step.generation) {
    const b = bucketAt(r, t)
    const evt = new Array(EVT_FIELD_LENGTH).fill(0)
    evt[EVT_IDX_T] = t
    evt[EVT_IDX_TYPE] = 6
    b.evts.push(evt)
    step.generation = { t, hk: hourOf(t), evtIdx: b.evts.length - 1, bucketEvts: b.evts }
  }
  return step
}

function closeGeneration(step, end) {
  const gen = step && step.generation
  if (!gen) return
  if (typeof end === 'number' && end > gen.t) {
    gen.bucketEvts[gen.evtIdx][EVT_IDX_ACT_MS] = end - gen.t
    gen.bucketEvts[gen.evtIdx][EVT_IDX_END_T] = end
  }
  step.generation = null
}

function closeStep(r, data, end) {
  const key = stepKey(data)
  if (key === undefined || key === 'undefined:undefined') return 0
  const step = r._openSteps.get(key)
  if (!step) return 0
  // Capture the open generation BEFORE closeGeneration clears it.
  const gen = step.generation
  closeGeneration(step, end)
  let dur = 0
  if (gen && Array.isArray(gen.bucketEvts[gen.evtIdx]) && typeof gen.bucketEvts[gen.evtIdx][EVT_IDX_ACT_MS] === 'number') {
    dur = gen.bucketEvts[gen.evtIdx][EVT_IDX_ACT_MS] || 0
  }
  r._openSteps.delete(key)
  return dur
}

// inter-message gap ≤ 10min → attributed to the hour of the EARLIER message
function trackInterMsgGap(r, t) {
  const lastT = r._lastMsgT
  r._lastMsgT = t
  if (lastT !== null) {
    const gap = t - lastT
    if (gap > 0 && gap <= INTER_MSG_GAP_MS) bucketAt(r, lastT).durGap += gap
  }
}

function newPerAggregate() {
  // [in, out, cache, costIn, costOut, costCache, calls, responseMsSum,
  //  matched, cacheRead, latencyBins, billedInputTotal, observedBilled, observedInput]
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, 0, 0, 0]
}

function newZeroBucket() {
  return {
    input: 0, output: 0, cache: 0,
    cacheRead: 0, cacheWrite: 0,
    billedInput: 0, cacheObserved: 0,
    costIn: 0, costOut: 0, costCache: 0,
    durMs: 0, totalMs: 0, sessions: 0, activeMs: 0
  }
}

export function foldAppend(r, ev) {
  const t = ev.time
  switch (ev.type) {
    case 'user/message':
    case 'assistant/message':
    case 'tool/call':
    case 'tool/result': {
      // 会话跨度只统计消息事件；step/start 不是消息，不得拉长跨度
      if (r.first === null || t < r.first) r.first = t
      if (r.last === null || t > r.last) r.last = t
      break
    }
    default:
      break
  }
  switch (ev.type) {
    case 'user/message': {
      const src = ev.data && ev.data.source
      const b = bucketAt(r, t)
      if (src && src.kind === 'user') b.msg[MSG_USER] += 1
      else b.msg[MSG_INJECTED] += 1
      r._lastUserT = t
      b.hasMsg = true
      if (t < b.first || !b.first) b.first = t
      if (t > b.last) b.last = t
      const evt = new Array(EVT_FIELD_LENGTH).fill(0)
      evt[EVT_IDX_T] = t
      evt[EVT_IDX_TYPE] = src && src.kind === 'user' ? 0 : 1
      b.evts.push(evt)
      trackInterMsgGap(r, t)
      break
    }
    case 'assistant/message': {
      const b = bucketAt(r, t)
      b.msg[MSG_ASSISTANT] += 1
      b.hasMsg = true
      if (t < b.first || !b.first) b.first = t
      if (t > b.last) b.last = t
      // assistant/message is the completion fallback for providers that do not
      // emit a finish chunk. When chunks are present, closeGeneration already
      // closed at the finish timestamp and this is a no-op.
      let genDurMs = closeStep(r, ev.data, t)
      const usage = ev.data.usage
      // Detect cache telemetry with own-property checks
      const hasOwnCacheRead = usage && Object.prototype.hasOwnProperty.call(usage, 'cacheReadTokens')
      const hasOwnCacheWrite = usage && Object.prototype.hasOwnProperty.call(usage, 'cacheWriteTokens')
      const cacheKnown = hasOwnCacheRead || hasOwnCacheWrite
      let latencyKnown = genDurMs > 0
      if (!usage) {
        // 保留 message-only 边缘明细；不造 token/cost 行
        const evt = new Array(EVT_FIELD_LENGTH).fill(0)
        evt[EVT_IDX_T] = t
        evt[EVT_IDX_TYPE] = 2
        evt[EVT_IDX_CACHE_KNOWN] = cacheKnown ? 1 : 0
        evt[EVT_IDX_LATENCY_KNOWN] = latencyKnown ? 1 : 0
        b.evts.push(evt)
      }
      if (usage) {
        const msg = ev.data.message
        const model = msg && msg.source ? String(msg.source.model || '') : ''
        const pr = priceForAt(model, t)
        const inp = num(usage.inputTokens)
        const otp = num(usage.outputTokens)
        const cr = cacheKnown ? num(usage.cacheReadTokens) : 0
        const cw = cacheKnown ? num(usage.cacheWriteTokens) : 0
        let costIn = 0, costOut = 0, costCache = 0
        if (pr) {
          costIn = inp * pr.p[0] / 1e6
          costOut = otp * pr.p[1] / 1e6
          costCache = (cr * pr.p[2] + cw * pr.p[0]) / 1e6
        }
        // Fallback: use time since last user message if no generation data
        if (!latencyKnown && r._lastUserT !== null) {
          genDurMs = Math.max(0, t - r._lastUserT)
        }
        latencyKnown = genDurMs > 0
        const durUA = r._lastUserT !== null ? Math.max(0, t - r._lastUserT) : 0
        // evt: [t, type, model, inp, otp, cache, costIn, costOut, costCache, durUA, actMs, endT, cacheRead, cacheKnown, latencyKnown]
      const evt = new Array(EVT_FIELD_LENGTH).fill(0)
      evt[EVT_IDX_T] = t
      evt[EVT_IDX_TYPE] = 2
      evt[EVT_IDX_MODEL] = model
      evt[EVT_IDX_IN] = inp
      evt[EVT_IDX_OUT] = otp
      evt[EVT_IDX_CACHE] = cr + cw
      evt[EVT_IDX_COST_IN] = costIn
      evt[EVT_IDX_COST_OUT] = costOut
      evt[EVT_IDX_COST_CACHE] = costCache
      evt[EVT_IDX_DUR_UA] = durUA
      evt[EVT_IDX_CACHE_READ] = cr
      evt[EVT_IDX_CACHE_KNOWN] = cacheKnown ? 1 : 0
      evt[EVT_IDX_LATENCY_KNOWN] = latencyKnown ? 1 : 0
      b.evts.push(evt)
        let per = b.per.get(model)
        if (!per) {
          per = newPerAggregate()
          b.per.set(model, per)
        }
        const modelMatched = !!pr
        per[PER_INPUT] += inp
        per[PER_OUTPUT] += otp
        per[PER_CACHE] += cr + cw
        per[PER_COST_IN] += costIn
        per[PER_COST_OUT] += costOut
        per[PER_COST_CACHE] += costCache
        per[PER_CALLS] += 1
        per[PER_RESP_MS_SUM] += genDurMs || 0
        per[PER_MATCHED] = modelMatched ? 1 : per[PER_MATCHED]
        per[PER_CACHE_READ] += cr
        per[PER_BILLED_INPUT_TOTAL] += inp + cr + cw
        if (cacheKnown) {
          per[PER_OBSERVED_BILLED] += inp + cr + cw
          per[PER_OBSERVED_INPUT] += inp
        }
        if (genDurMs > 0) {
          const bin = latencyBin(genDurMs)
          if (!per[PER_LATENCY_BINS]) per[PER_LATENCY_BINS] = newLatencyBins()
          per[PER_LATENCY_BINS][bin] += 1
        }
        // 元数据总是更新为「最近一条事件」的取价结果（DeepSeek 峰谷价随事件时间变化）
        if (pr) r.modelMeta.set(model, { matched: pr.matched, p: pr.p, peak: pr.peak || null, off: pr.off || null, ds: !!pr.ds })
      }
      trackInterMsgGap(r, t)
      break
    }
    case 'tool/call': {
      const b = bucketAt(r, t)
      b.msg[MSG_TOOL_CALL] += 1
      b.hasMsg = true
      if (t < b.first || !b.first) b.first = t
      if (t > b.last) b.last = t
      // Tool execution is part of the session span, but never active generation.
      const evt = new Array(EVT_FIELD_LENGTH).fill(0)
      evt[EVT_IDX_T] = t
      evt[EVT_IDX_TYPE] = 3
      b.evts.push(evt)
      trackInterMsgGap(r, t)
      break
    }
    case 'tool/result': {
      const b = bucketAt(r, t)
      b.msg[MSG_TOOL_RESULT] += 1
      b.hasMsg = true
      if (t < b.first || !b.first) b.first = t
      if (t > b.last) b.last = t
      const evt = new Array(EVT_FIELD_LENGTH).fill(0)
      evt[EVT_IDX_T] = t
      evt[EVT_IDX_TYPE] = 4
      b.evts.push(evt)
      trackInterMsgGap(r, t)
      break
    }
    case 'assistant/chunk': {
      const data = ev.data || {}
      const chunk = data.chunk || {}
      if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta' || chunk.type === 'tool-call-delta') {
        openGeneration(r, data, t)
      } else if (chunk.type === 'finish') {
        closeStep(r, data, t)
      }
      break
    }
    case 'step/start': {
      const key = stepKey(ev.data)
      if (key !== undefined && key !== 'undefined:undefined' && !r._openSteps.has(key)) {
        r._openSteps.set(key, { generation: null })
      }
      break
    }
    case 'step/end': {
      closeStep(r, ev.data, t)
      break
    }
    default:
      break
  }
  return r
}

export function foldSession(events) {
  const r = emptyRollup()
  for (let i = 0; i < events.length; i++) foldAppend(r, events[i])
  return r
}

// ---------- query: usage (totals + trend + heat + distributions) ----------
// Single pass over the rollups; the current window and the previous
// (comparison) window are accumulated in the same traversal.
export function queryUsage(rollups, req, opts) {
  if (!req || !req.range) {
    return {
      totals: {
        cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
        billedInputTokens: 0, cacheObservedTokens: 0, totalTokens: 0,
        activeMs: 0, totalMs: 0, sessions: 0,
        userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, totalMessages: 0,
        cacheRead: 0, cacheWrite: 0, billedInput: 0, cacheObserved: 0,
        cacheHitRate: null, cacheCoverage: null, previousCacheHitRate: null, cacheHitRateDeltaPp: null
      },
      buckets: [],
      granularity: 'hour',
      heat: { token: new Array(168).fill(0), cost: new Array(168).fill(0), dur: new Array(168).fill(0), active: new Array(168).fill(0) },
      meta: { models: [], projects: [], vendors: {}, pricing: { coverage: 0, rows: [] }, dist: { models: [], projects: [] } }
    }
  }
  const [lo, hi] = rangeBounds(req)
  const gran = pickGranularity(req, lo, hi)
  const [plo, phi] = prevWindow(req.range, lo, hi)
  const modelSet = opts && opts.modelSet ? opts.modelSet : (Array.isArray(req.models) && req.models.length ? new Set(req.models) : null)
  const projectSet = opts && opts.projectSet ? opts.projectSet : (Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null)
  const pathTitle = (opts && opts.pathTitle) || new Map()

  const mk = () => ({
    totals: {
      cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      billedInputTokens: 0, cacheObservedTokens: 0, totalTokens: 0,
      activeMs: 0, totalMs: 0, sessions: 0,
      userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, totalMessages: 0,
      cacheRead: 0, cacheWrite: 0, billedInput: 0, cacheObserved: 0,
      cacheHitRate: null, cacheCoverage: null, previousCacheHitRate: null, cacheHitRateDeltaPp: null
    },
    matchedTokens: 0, totalUsageTokens: 0
  })
  const cur = mk()
  const prev = mk()
  const curInts = []              // per-session [start,end] spans inside the window
  const prevInts = []             // (union-merged → totals.totalMs)
  const bucketMap = new Map()     // granKey → agg bucket
  const gkInts = new Map()        // granKey → [[start,end], ...] trend intervals
  const heatToken = new Array(168).fill(0)
  const heatCost = new Array(168).fill(0)
  const heatDur = new Array(168).fill(0)
  const activeHeat = new Array(168).fill(0)
  const modelAgg = new Map()      // model → { id, calls, input, output, cache, cost, matched, p }
  const projectAgg = new Map()    // cwd → { input, output, cache, cost }
  const projectList = new Map()   // cwd → { id, title, sessions } (all rollups)

  function accumulatePer(agg, per) {
    agg.totals.cost += per[PER_COST_IN] + per[PER_COST_OUT] + per[PER_COST_CACHE]
    agg.totals.inputTokens += per[PER_INPUT]
    agg.totals.outputTokens += per[PER_OUTPUT]
    agg.totals.cacheTokens += per[PER_CACHE]
    agg.totals.cacheReadTokens += per[PER_CACHE_READ]
    agg.totals.cacheWriteTokens += Math.max(0, per[PER_CACHE] - per[PER_CACHE_READ])
    if (per[PER_BILLED_INPUT_TOTAL]) {
      const observed = per[PER_OBSERVED_BILLED]
      const cacheWrite = observed
        ? Math.max(0, observed - per[PER_CACHE_READ] - (per[PER_OBSERVED_INPUT] || 0))
        : Math.max(0, per[PER_BILLED_INPUT_TOTAL] - per[PER_CACHE_READ] - per[PER_INPUT])
      if (observed) agg.totals.cacheObserved += observed
      agg.totals.billedInput += per[PER_BILLED_INPUT_TOTAL]
      agg.totals.cacheRead += per[PER_CACHE_READ]
      agg.totals.cacheWrite += cacheWrite
      agg.totals.billedInputTokens = agg.totals.billedInput
      agg.totals.cacheObservedTokens = agg.totals.cacheObserved
      agg.totals.cacheReadTokens = agg.totals.cacheRead
      agg.totals.cacheWriteTokens = agg.totals.cacheWrite
    }
    if (per[PER_MATCHED]) agg.matchedTokens += per[PER_INPUT] + per[PER_OUTPUT] + per[PER_CACHE]
    agg.totalUsageTokens += per[PER_INPUT] + per[PER_OUTPUT] + per[PER_CACHE]
  }

  function newZeroBucket() {
    return {
      input: 0, output: 0, cache: 0,
      cacheRead: 0, cacheWrite: 0, billedInput: 0, cacheObserved: 0,
      costIn: 0, costOut: 0, costCache: 0,
      durMs: 0, totalMs: 0, sessions: 0, activeMs: 0
    }
  }

  function addPerBucket(g, pg, per) {
    g.input += per[PER_INPUT]; g.output += per[PER_OUTPUT]; g.cache += per[PER_CACHE]
    g.cacheRead += per[PER_CACHE_READ]
    g.cacheWrite += Math.max(0, per[PER_CACHE] - per[PER_CACHE_READ])
    g.billedInput += per[PER_BILLED_INPUT_TOTAL]
    g.cacheObserved += per[PER_OBSERVED_BILLED]
    g.costIn += per[PER_COST_IN]; g.costOut += per[PER_COST_OUT]; g.costCache += per[PER_COST_CACHE]
    if (pg) {
      pg.input += per[PER_INPUT]; pg.output += per[PER_OUTPUT]; pg.cache += per[PER_CACHE]
      pg.cost += per[PER_COST_IN] + per[PER_COST_OUT] + per[PER_COST_CACHE]
    }
  }

  for (let i = 0; i < rollups.length; i++) {
    const r = rollups[i]
    // project dropdown entry (every rollup, independent of window); use cwd ||
    // '__none__' as the canonical key so the filter below is consistent across
    // queryUsage/queryDetail/queryCalendar.
    const cwdKey = r.cwd || '__none__'
    let pl = projectList.get(cwdKey)
    if (!pl) {
      const base = (r.cwd || '').split(/[\\/]/).filter(Boolean).pop() || ''
      pl = { id: cwdKey, title: pathTitle.get(r.cwd) || base || '未分组', sessions: 0 }
      projectList.set(cwdKey, pl)
    }
    pl.sessions += 1

    // project filter: skip aggregation for non-selected projects (dropdown
    // still lists every project, matching the previous behavior)
    if (projectSet !== null && !projectSet.has(cwdKey)) continue

    let inCur = false
    let inPrev = false
    if (r.first !== null && r.last !== null) {
      inCur = r.last >= lo && r.first <= hi
      inPrev = r.last >= plo && r.first <= phi
    }
    if (!inCur && !inPrev) continue

    if (inCur) {
      cur.totals.sessions += 1
      const s = Math.max(r.first, lo)
      const e = Math.min(r.last, hi)
      if (e > s) curInts.push([s, e])
    }
    if (inPrev) {
      prev.totals.sessions += 1
      const s = Math.max(r.first, plo)
      const e = Math.min(r.last, phi)
      if (e > s) prevInts.push([s, e])
    }

    // Compute active Ms by scanning generation interval events (type 6), which
    // keeps TTFT/tool execution out of the metric. isCurrent=true writes to
    // totals/activeHeat/bucketMap; isCurrent=false writes to totals only.
    if (inCur) {
      const sinkCur = {
        totals: cur.totals,
        activeHeat: activeHeat,
        bucketMap: bucketMap
      }
      computeRollupActiveMs(r, lo, hi, gran, sinkCur, true)
    }
    if (inPrev) {
      const sinkPrev = { totals: prev.totals }
      computeRollupActiveMs(r, plo, phi, gran, sinkPrev, false)
    }

    const gkSpan = new Map() // per-rollup gran-key spans → trend totalMs/sessions
    let edgeLastCur = null // { hk, t }: last in-window msg of the lower-edge bucket
    for (const [hk, b] of r.buckets) {
      // bridge the cross-bucket gap pair (lower-edge bucket → THIS bucket):
      // the gap between the edge bucket's last in-window message and this
      // bucket's first in-window message belongs to the edge bucket
      if (edgeLastCur !== null && hk === edgeLastCur.hk + HOUR) {
        const last = edgeLastCur
        edgeLastCur = null
        if (inCur) {
          const firstT = firstInWindow(b, lo, hi)
          if (firstT !== null) {
            const gap = firstT - last.t
            if (gap > 0 && gap <= INTER_MSG_GAP_MS) {
              heatDur[cellOf(last.t)] += gap
              const gk = bucketKey(last.t, gran)
              let g = bucketMap.get(gk)
              if (!g) {
                g = newZeroBucket()
                bucketMap.set(gk, g)
              }
              g.durMs += gap
            }
          }
        }
      }
      const inCurB = inCur && hk + HOUR > lo && hk <= hi
      const inPrevB = inPrev && hk + HOUR > plo && hk <= phi
      if (!inCurB && !inPrevB) continue
      const cell = cellOf(hk)
      // window EDGE buckets (bounds off the hour) are accumulated exactly from
      // per-event detail; all other buckets use the aggregates
      const curEdge = inCurB && isEdgeBucket(hk, lo, hi)
      const prevEdge = inPrevB && isEdgeBucket(hk, plo, phi)

      if (curEdge) {
        const lastT = edgeAccumulate(lo, hi, modelSet, b.evts, cell, {
          totals: cur.totals, heatToken, heatCost, heatDur,
          bucketMap, gran, modelAgg, projectAgg, cwd: cwdKey, gkSpan
        })
        if (lastT !== null) edgeLastCur = { hk, t: lastT }
      } else if (inCurB && b.per.size > 0) {
        if (modelSet === null) {
          for (const [model, per] of b.per) {
            accumulatePer(cur, per)
            heatToken[cell] += per[PER_INPUT] + per[PER_OUTPUT] + per[PER_CACHE]
            heatCost[cell] += per[PER_COST_IN] + per[PER_COST_OUT] + per[PER_COST_CACHE]
            mergeModel(modelAgg, model, per)
          }
        } else {
          for (const [model, per] of b.per) {
            // dropdown / pricing rows list EVERY model in the window
            mergeModel(modelAgg, model, per)
            if (!modelSet.has(model)) continue
            accumulatePer(cur, per)
            heatToken[cell] += per[PER_INPUT] + per[PER_OUTPUT] + per[PER_CACHE]
            heatCost[cell] += per[PER_COST_IN] + per[PER_COST_OUT] + per[PER_COST_CACHE]
          }
        }
      }
      if (prevEdge) {
        edgeAccumulate(plo, phi, modelSet, b.evts, cellOf(plo), {
          totals: prev.totals, heatToken: null, heatCost: null, heatDur: null,
          bucketMap: null, gran, modelAgg: null, projectAgg: null, cwd: null, gkSpan: null
        })
      } else if (inPrevB) {
        if (b.per.size > 0) {
          if (modelSet === null) {
            for (const [model, per] of b.per) accumulatePer(prev, per)
          } else {
            for (const [model, per] of b.per) {
              if (modelSet.has(model)) accumulatePer(prev, per)
            }
          }
        }
        prev.totals.userMessages += b.msg[MSG_USER]
        prev.totals.injectedMessages += b.msg[MSG_INJECTED]
        prev.totals.assistantMessages += b.msg[MSG_ASSISTANT]
        prev.totals.toolCalls += b.msg[MSG_TOOL_CALL]
        prev.totals.toolResults += b.msg[MSG_TOOL_RESULT]
      }

      if (inCurB) {
        if (!curEdge) {
          cur.totals.userMessages += b.msg[MSG_USER]
          cur.totals.injectedMessages += b.msg[MSG_INJECTED]
          cur.totals.assistantMessages += b.msg[MSG_ASSISTANT]
          cur.totals.toolCalls += b.msg[MSG_TOOL_CALL]
          cur.totals.toolResults += b.msg[MSG_TOOL_RESULT]
          heatDur[cell] += b.durGap
          const gk = bucketKey(hk, gran)
          let g = bucketMap.get(gk)
          if (!g) { g = newZeroBucket(); bucketMap.set(gk, g) }
          g.durMs += b.durGap
          if (b.hasMsg) {
            let sp = gkSpan.get(gk)
            if (!sp) { sp = { first: b.first, last: b.last }; gkSpan.set(gk, sp) }
            else {
              if (b.first < sp.first) sp.first = b.first
              if (b.last > sp.last) sp.last = b.last
            }
          }
          if (b.per.size > 0) {
            let pg = projectAgg.get(cwdKey)
            if (!pg) { pg = { input: 0, output: 0, cache: 0, cost: 0 }; projectAgg.set(cwdKey, pg) }
            for (const [model, per] of b.per) {
              if (modelSet !== null && !modelSet.has(model)) continue
              addPerBucket(g, pg, per)
            }
          }
        }
      }
    }
    // one interval per rollup per gran key; the trend totalMs merges them below
    for (const [gk, sp] of gkSpan) {
      let arr = gkInts.get(gk)
      if (!arr) { arr = []; gkInts.set(gk, arr) }
      arr.push([sp.first, sp.last])
    }
  }

  // 总时长 = 窗口内每个会话「首条消息→末条消息」时间跨度的并集：
  // 重叠（并行）会话只计一次，会话之间的间隔不计入，结果不会超过所选
  // 时间范围本身（今天/24H ≤ 24 小时，7D ≤ 7 天……）。
  cur.totals.totalMs = mergeIntervals(curInts)
  prev.totals.totalMs = mergeIntervals(prevInts)
  // 趋势桶采用同样的并集口径（每小时/天去重叠）
  for (const [gk, ints] of gkInts) {
    let g = bucketMap.get(gk)
    if (!g) { g = newZeroBucket(); bucketMap.set(gk, g) }
    g.totalMs = mergeIntervals(ints)
    g.sessions = ints.length
  }

  cur.totals.totalTokens = cur.totals.inputTokens + cur.totals.outputTokens + cur.totals.cacheTokens
  cur.totals.totalMessages = cur.totals.userMessages + cur.totals.injectedMessages + cur.totals.assistantMessages + cur.totals.toolCalls + cur.totals.toolResults
  prev.totals.totalTokens = prev.totals.inputTokens + prev.totals.outputTokens + prev.totals.cacheTokens
  prev.totals.totalMessages = prev.totals.userMessages + prev.totals.injectedMessages + prev.totals.assistantMessages + prev.totals.toolCalls + prev.totals.toolResults
  // Cache metric aliases for totals — use direct fields (set by edgeAccumulate)
  // when available, falling back to token aliases (set by acc()).
  for (const tag of ['cur', 'prev']) {
    const t = tag === 'cur' ? cur.totals : prev.totals
    t.cacheRead ??= t.cacheReadTokens
    t.cacheWrite ??= t.cacheWriteTokens
    t.billedInput ??= t.billedInputTokens
    t.cacheObserved ??= t.cacheObservedTokens
  }
  cur.totals.cacheHitRate = cacheRate(cur.totals.cacheRead, cur.totals.cacheObserved)
  cur.totals.cacheCoverage = cacheCoverage(cur.totals.cacheObserved, cur.totals.billedInput)
  prev.totals.cacheHitRate = cacheRate(prev.totals.cacheRead, prev.totals.cacheObserved)
  prev.totals.cacheCoverage = cacheCoverage(prev.totals.cacheObserved, prev.totals.billedInput)
  cur.totals.previousCacheHitRate = prev.totals.cacheHitRate
  cur.totals.cacheHitRateDeltaPp = cur.totals.cacheHitRate !== null && prev.totals.cacheHitRate !== null
    ? cur.totals.cacheHitRate - prev.totals.cacheHitRate : null

  function pct(c, p) {
    // 以零为基线时百分比没有有限定义；隐藏该项比伪造 +100% 更准确。
    if (!(p > 0)) return null
    return (c - p) / p * 100
  }
  cur.totals.pct = {
    cost: pct(cur.totals.cost, prev.totals.cost),
    totalTokens: pct(cur.totals.totalTokens, prev.totals.totalTokens),
    inputTokens: pct(cur.totals.inputTokens, prev.totals.inputTokens),
    outputTokens: pct(cur.totals.outputTokens, prev.totals.outputTokens),
    cacheTokens: pct(cur.totals.cacheTokens, prev.totals.cacheTokens),
    activeMs: pct(cur.totals.activeMs, prev.totals.activeMs),
    totalMs: pct(cur.totals.totalMs, prev.totals.totalMs),
    sessions: pct(cur.totals.sessions, prev.totals.sessions),
    totalMessages: pct(cur.totals.totalMessages, prev.totals.totalMessages),
    userMessages: pct(cur.totals.userMessages, prev.totals.userMessages)
  }

  // patch window-less pricing metadata (matched / price) onto the model aggregate
  patchModelMeta(modelAgg, rollups)
  finalizeModelAggStats(modelAgg)

  const keys = bucketSeries(lo, hi, gran, presetBucketCount(req.range, gran))
  const buckets = keys.map((bk) => {
    const b = bucketMap.get(bk)
    if (!b) {
      return {
        label: bucketLabel(bk, gran),
        input: 0, output: 0, cache: 0, cacheRead: 0, cacheWrite: 0, billedInput: 0, cacheObserved: 0,
        cacheHitRate: null, cacheCoverage: 0,
        costIn: 0, costOut: 0, costCache: 0,
        durMs: 0, totalMs: 0, sessions: 0, activeMs: 0
      }
    }
    return {
      label: bucketLabel(bk, gran),
      input: b.input, output: b.output, cache: b.cache,
      cacheRead: b.cacheRead, cacheWrite: b.cacheWrite,
      billedInput: b.billedInput, cacheObserved: b.cacheObserved,
      cacheHitRate: b.cacheObserved > 0 ? cacheRate(b.cacheRead, b.cacheObserved) : null,
      cacheCoverage: cacheCoverage(b.cacheObserved, b.billedInput),
      costIn: b.costIn, costOut: b.costOut, costCache: b.costCache,
      durMs: b.durMs, totalMs: b.totalMs, sessions: b.sessions, activeMs: b.activeMs
    }
  })

  // coverage is a FULL-corpus ratio (independent of the model filter, like v0.1)
  let matchedTokensTotal = 0
  let totalUsageTokensTotal = 0
  for (const m of modelAgg.values()) {
    totalUsageTokensTotal += m.input + m.output + m.cache
    if (m.matched !== null) matchedTokensTotal += m.input + m.output + m.cache
  }
  const coverage = totalUsageTokensTotal > 0 ? Math.round(matchedTokensTotal / totalUsageTokensTotal * 100) : 0
  const pricingRows = Array.from(modelAgg.values()).map((m) => ({ model: m.id, matched: m.matched, p: m.p, peak: m.peak || null, off: m.off || null, ds: !!m.ds }))
  const models = Array.from(modelAgg.values()).sort((a, b) => b.cost - a.cost)
  const distModels = (modelSet ? models.filter((m) => modelSet.has(m.id)) : models)
    .map((m) => ({ id: m.id, tokens: m.input + m.output + m.cache, cost: m.cost }))
    .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
  // every project appears in the distribution (zero-value rows included,
  // matching the legacy behavior; the client filters zeros)
  const distProjects = Array.from(projectList.values())
    .map((p) => {
      const agg = projectAgg.get(p.id)
      return { id: p.id, label: p.title, tokens: agg ? agg.input + agg.output + agg.cache : 0, cost: agg ? agg.cost : 0 }
    })
    .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
  const projects = Array.from(projectList.values()).sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  // 模型 → 厂商（系列分组，来自 pricing CSV）；未收录模型归「其他」
  const vendors = {}
  for (const m of models) vendors[m.id] = hasOwn(VENDORS, m.id) ? VENDORS[m.id] : '其他'

  return {
    totals: cur.totals,
    buckets,
    granularity: gran,
    heat: { token: heatToken, cost: heatCost, dur: heatDur, active: activeHeat },
    meta: { models, projects, vendors, pricing: { coverage, rows: pricingRows }, dist: { models: distModels, projects: distProjects } }
  }
}

// Merge overlapping [start,end] intervals and return their total length
// (sorting mutates the caller-owned scratch array).
function mergeIntervals(ints) {
  if (ints.length === 0) return 0
  ints.sort((a, b) => a[0] - b[0])
  let total = 0
  let cs = ints[0][0]
  let ce = ints[0][1]
  for (let i = 1; i < ints.length; i++) {
    const s = ints[i][0]
    const e = ints[i][1]
    if (s <= ce) {
      if (e > ce) ce = e
    } else {
      total += ce - cs
      cs = s
      ce = e
    }
  }
  return total + (ce - cs)
}

function mergeModel(map, model, per) {
  let g = map.get(model)
  if (!g) {
    g = { id: model, calls: 0, input: 0, output: 0, cache: 0, cost: 0, matched: null, p: null,
      cacheRead: 0, cacheWrite: 0, billedInput: 0, cacheObserved: 0,
      responseMsSum: 0, latencyBins: null }
    map.set(model, g)
  }
  g.calls += per[PER_CALLS]
  g.input += per[PER_INPUT]
  g.output += per[PER_OUTPUT]
  g.cache += per[PER_CACHE]
  g.cost += per[PER_COST_IN] + per[PER_COST_OUT] + per[PER_COST_CACHE]
  g.cacheRead += per[PER_CACHE_READ]
  g.cacheWrite += Math.max(0, per[PER_CACHE] - per[PER_CACHE_READ])
  g.billedInput += per[PER_BILLED_INPUT_TOTAL]
  g.cacheObserved += per[PER_OBSERVED_BILLED]
  g.responseMsSum += per[PER_RESP_MS_SUM]
  if (per[PER_LATENCY_BINS]) {
    if (!g.latencyBins) g.latencyBins = newLatencyBins()
    mergeLatencyBins(g.latencyBins, per[PER_LATENCY_BINS])
  }
  // matched/p/ds/peak/off come from the rollup-level modelMeta; mergeModel receives per only,
  // so the caller patches them afterwards (see queryUsage model patching below)
  return g
}

// Finalize per-model stats: cache hit rate, coverage, latency percentiles
function finalizeModelAggStats(modelAgg) {
  for (const m of modelAgg.values()) {
    m.cacheHitRate = cacheRate(m.cacheRead, m.cacheObserved)
    m.cacheCoverage = cacheCoverage(m.cacheObserved, m.billedInput)
    if (m.latencyBins) {
      m.avgResponseMs = m.responseMsSum > 0 ? m.responseMsSum / m.calls : null
      m.p50ResponseMs = quantileFromBins(m.latencyBins, 0.5)
      m.p95ResponseMs = quantileFromBins(m.latencyBins, 0.95)
    }
  }
}

// Exact accumulation of one window EDGE bucket (window bounds rarely align
// with the hour). Iterates the bucket's per-event detail and adds only events
// within [tLo, tHi] to the sink. Non-edge buckets use the aggregates instead.
// evts entry: [t, type, model|null, in, out, cache, costIn, costOut, costCache,
//              durUA, actMs, endT, cacheRead] — type: 0 user, 1 injected, 2 assistant,
//              3 toolCall, 4 toolResult, 5 step/start, 6 generation interval.
//              cache is still cacheRead + cacheWrite; cacheRead is kept separately at index 12.
function edgeAccumulate(tLo, tHi, modelSet, evts, cell, sink) {
  let any = false
  let prevT = null
  let lastT = null
  for (let i = 0; i < evts.length; i++) {
    const e = evts[i]
    const t = e[0]
    if (t < tLo || t > tHi) continue
    any = true
    const type = e[1]
    if (type === 5 || type === 6) {
      // step/start and generation intervals never count as messages or gaps.
      continue
    }
    lastT = t
    if (sink.gkSpan) {
      const gk = bucketKey(t, sink.gran)
      let sp = sink.gkSpan.get(gk)
      if (!sp) { sp = { first: t, last: t }; sink.gkSpan.set(gk, sp) }
      else {
        if (t < sp.first) sp.first = t
        if (t > sp.last) sp.last = t
      }
    }
    if (type <= 1) {
      if (type === 0) sink.totals.userMessages += 1
      else sink.totals.injectedMessages += 1
    } else if (type === 2) {
      sink.totals.assistantMessages += 1
      const model = e[2]
      if (model !== null) {
        const inp = e[3], otp = e[4], cache = e[5], costIn = e[6], costOut = e[7], costCache = e[8]
        const cacheRead = Number(e[12]) || 0
        const cacheKnown = !!e[13]
        const latencyKnown = !!e[14]
        const cacheWrite = Math.max(0, cache - cacheRead)
        // billedInput is always the full charged input; only observed portion counts toward cacheHitRate denominator.
        const billedInput = inp + cache
        const observedBilled = cacheKnown ? billedInput : 0
        const observedInput = cacheKnown ? inp : 0
        // dropdown / pricing rows carry the FULL model aggregate (unfiltered).
        // per: [in,out,cache,costIn,costOut,costCache,calls,responseMsSum,matched,cacheRead,latencyBins,billedInputTotal,observedBilled,observedInput]
        const genDurMs = e[9] || 0
        if (sink.modelAgg) mergeModel(sink.modelAgg, model, [inp, otp, cache, costIn, costOut, costCache, 1, genDurMs, 1, cacheRead, null, billedInput, observedBilled, observedInput])
        if (sink.modelAgg && latencyKnown) {
          const g = sink.modelAgg.get(model)
          if (g) {
            if (!g.latencyBins) g.latencyBins = newLatencyBins()
            g.latencyBins[latencyBin(genDurMs)] += 1
          }
        }
        if (modelSet === null || modelSet.has(model)) {
          sink.totals.cost += costIn + costOut + costCache
          sink.totals.inputTokens += inp
          sink.totals.outputTokens += otp
          sink.totals.cacheTokens += cache
          sink.totals.billedInput += billedInput
          sink.totals.billedInputTokens = sink.totals.billedInput
          sink.totals.cacheReadTokens += cacheRead
          sink.totals.cacheWriteTokens += cacheWrite
          if (cacheKnown) {
            sink.totals.cacheRead += cacheRead
            sink.totals.cacheWrite += cacheWrite
            sink.totals.cacheObserved += observedBilled
          }
          sink.totals.billedInputTokens = sink.totals.billedInput
          sink.totals.cacheObservedTokens = sink.totals.cacheObserved
          if (sink.heatToken) sink.heatToken[cell] += inp + otp + cache
          if (sink.heatCost) sink.heatCost[cell] += costIn + costOut + costCache
          if (sink.bucketMap) {
            const gk = bucketKey(t, sink.gran)
            let g = sink.bucketMap.get(gk)
            if (!g) {
              g = newZeroBucket()
              sink.bucketMap.set(gk, g)
            }
            g.input += inp; g.output += otp; g.cache += cache
            g.costIn += costIn; g.costOut += costOut; g.costCache += costCache
            g.billedInput += billedInput
            if (cacheKnown) {
              g.cacheRead += cacheRead
              g.cacheWrite += cacheWrite
              g.cacheObserved += observedBilled
            }
            if (sink.projectAgg) {
              let pg = sink.projectAgg.get(sink.cwd)
              if (!pg) { pg = { input: 0, output: 0, cache: 0, cost: 0 }; sink.projectAgg.set(sink.cwd, pg) }
              pg.input += inp; pg.output += otp; pg.cache += cache
              pg.cost += costIn + costOut + costCache
            }
          }
        }
      }
    } else if (type === 3) {
      sink.totals.toolCalls += 1
      // activeMs handled in queryUsage loop via computeBucketActiveMs; no double-count here
    } else {
      sink.totals.toolResults += 1
    }
    if (prevT !== null) {
      const gap = t - prevT
      if (gap > 0 && gap <= 600000) {
        if (sink.heatDur) sink.heatDur[cell] += gap
        if (sink.bucketMap) {
          // the gap belongs to the bucket of the EARLIER message
          const gk = bucketKey(prevT, sink.gran)
          let g = sink.bucketMap.get(gk)
          if (!g) {
            g = { input: 0, output: 0, cache: 0, cacheRead: 0, cacheWrite: 0, billedInput: 0, cacheObserved: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0, activeMs: 0 }
            sink.bucketMap.set(gk, g)
          }
          g.durMs += gap
        }
      }
    }
    prevT = t
  }
  // last in-window message time (null when nothing fell in the window) —
  // lets the caller bridge the cross-bucket gap into the NEXT bucket
  return lastT
}

// Pure helper: compute activeMs from generation interval events (type 6).
// Intersects each event's [start, end] with [lo, hi], accumulates to totals/heat/bucketMap.
// isCurrent=true: write to totals.activeMs, activeHeat[cellOf(Math.max(start,lo))],
//               bucketMap[gk].activeMs = (g.activeMs || 0) + dur
// isCurrent=false: write to totals.activeMs only (previous window, no heat/buckets)
function computeRollupActiveMs(r, lo, hi, gran, sink, isCurrent) {
  let totalActive = 0
  for (const [hk, b] of r.buckets) {
    if (hk > hi) break
    if (hk + HOUR <= lo) continue
    for (let i = 0; i < b.evts.length; i++) {
      const e = b.evts[i]
      const type = e[1]
      if (type !== 6) continue // only AI generation intervals
      if (!(typeof e[11] === 'number' && Number.isFinite(e[11]))) continue // skip unclosed interval; require finite end
      const start = e[0]
      const end = e[11]
      if (end <= start) continue
      const isectStart = Math.max(start, lo)
      const isectEnd = Math.min(end, hi)
      if (isectStart >= isectEnd) continue
      const dur = isectEnd - isectStart
      totalActive += dur
      if (isCurrent) {
        // Write to totals.activeMs
        sink.totals.activeMs += dur
        // Write to activeHeat[cellOf(Math.max(start,lo))] — current window only
        const cell = cellOf(Math.max(start, lo))
        sink.activeHeat[cell] += dur
        // Write to bucketMap[gk].activeMs using (g.activeMs || 0) + dur
        const gk = bucketKey(isectStart, gran)
        let g = sink.bucketMap.get(gk)
        if (!g) {
          g = newZeroBucket()
          sink.bucketMap.set(gk, g)
        }
        g.activeMs = (g.activeMs || 0) + dur
      } else {
        // Previous window: only add to totals.activeMs, skip heat/bucketMap
        sink.totals.activeMs += dur
      }
    }
  }
  return totalActive
}

// First event time within [tLo, tHi] in a bucket's detail, or null.
function firstInWindow(b, tLo, tHi) {
  const evts = b.evts
  for (let i = 0; i < evts.length; i++) {
    const t = evts[i][0]
    if (evts[i][1] === 5 || evts[i][1] === 6) continue // ignore non-message timing events
    if (t >= tLo && t <= tHi) return t
  }
  return null
}

// Is this bucket an edge bucket for window [tLo, tHi]?
//   - lower bound: only when it does not fall on the hour (a whole-hour lower
//     bound never cuts through its bucket)
//   - upper bound: ALWAYS — the bound's hour bucket may contain events past
//     tHi even when tHi is a whole hour (events of the next hour)
export function isEdgeBucket(hk, tLo, tHi) {
  const loH = hourOf(tLo)
  return (hk === loH && loH !== tLo) || hk === hourOf(tHi)
}

// patch matched/p onto modelAgg from rollup modelMeta (window-less pricing info)
export function patchModelMeta(modelAgg, rollups) {
  for (const r of rollups) {
    for (const [model, mm] of r.modelMeta) {
      const g = modelAgg.get(model)
      if (g) {
        if (mm.matched !== null) g.matched = mm.matched
        if (mm.p !== null) g.p = mm.p
        if (mm.peak) g.peak = mm.peak
        if (mm.off) g.off = mm.off
        if (mm.ds) g.ds = true
      }
    }
  }
}

// ---------- query: detail records ----------
export function queryDetail(rollups, req) {
  if (!req || !req.range) return { gran: 'hour', total: 0, rows: [] }
  const [lo, hi] = rangeBounds(req)
  let gran = req.range === 'today' || req.range === '24h' ? 'hour' : 'day'
  if (req.range === 'custom') gran = (hi - lo) <= 48 * HOUR ? 'hour' : 'day'
  const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
  const projectSet = Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null

  const bucketMap = new Map() // key: gk \u0000 model \u0000 cwd
  for (let i = 0; i < rollups.length; i++) {
    const r = rollups[i]
    if (projectSet !== null && !projectSet.has(r.cwd || '__none__')) continue
    if (r.first === null || r.last === null || r.last < lo || r.first > hi) continue
    const project = r.projectTitle || '未分组'
    const cwdKey = r.cwd || '__none__'
    for (const [hk, b] of r.buckets) {
      if (hk + HOUR <= lo || hk > hi) continue
      if (isEdgeBucket(hk, lo, hi)) {
        // exact: per-event detail
        for (const e of b.evts) {
          const t = e[0]
          if (t < lo || t > hi) continue
          if (e[1] !== 2) continue
          // Skip assistant events with null model from detail rows;
          // totals assistantMessages still count separately (managed by queryUsage)
          if (e[2] === null) continue
          const model = e[2] || ''
          if (modelSet !== null && !modelSet.has(model)) continue
          const gk = bucketKey(t, gran)
          const key = gk + '\u0000' + model + '\u0000' + cwdKey
          let row = bucketMap.get(key)
          if (!row) {
            row = { t: gk, project, model, input: 0, output: 0, cache: 0, cost: 0 }
            bucketMap.set(key, row)
          }
          row.input += e[3]
          row.output += e[4]
          row.cache += e[5]
          row.cost += e[6] + e[7] + e[8]
        }
        continue
      }
      // aggregate path: skip buckets with no filtered-model contribution
      let hit = false
      if (modelSet === null) {
        hit = b.per.size > 0
      } else {
        for (const model of b.per.keys()) {
          if (modelSet.has(model)) { hit = true; break }
        }
      }
      if (!hit) continue
      const gk = bucketKey(hk, gran)
      for (const [model, per] of b.per) {
        if (modelSet !== null && !modelSet.has(model)) continue
        const key = gk + '\u0000' + (model || '') + '\u0000' + cwdKey
        let row = bucketMap.get(key)
        if (!row) {
          row = { t: gk, project, model: model || '', input: 0, output: 0, cache: 0, cost: 0 }
          bucketMap.set(key, row)
        }
        row.input += per[PER_INPUT]
        row.output += per[PER_OUTPUT]
        row.cache += per[PER_CACHE]
        row.cost += per[PER_COST_IN] + per[PER_COST_OUT] + per[PER_COST_CACHE]
      }
    }
  }
  const rows = Array.from(bucketMap.values())
  rows.sort((a, b) => b.t - a.t || a.project.localeCompare(b.project, 'zh') || a.model.localeCompare(b.model))
  const offset = Math.max(0, Number(req.offset) || 0)
  const limit = Math.min(200, Math.max(1, Number(req.limit) || 100))
  return { gran, total: rows.length, rows: rows.slice(offset, offset + limit) }
}

// ---------- query: calendar (53-week daily activity) ----------
export function queryCalendar(rollups, req) {
  const input = req || {}
  const now = typeof input.now === 'number' && Number.isFinite(input.now) ? input.now : Date.now()
  const thisSunday = bjSundayStart(now)
  const start = thisSunday - 52 * 7 * DAY
  const end = now  // use now instead of fixed Saturday 00:00 (old bug)
  const modelSet = Array.isArray(input.models) && input.models.length ? new Set(input.models) : null
  const projectSet = Array.isArray(input.projects) && input.projects.length ? new Set(input.projects) : null
  const dayMap = new Map()
  const endHour = hourOf(now)  // use now instead of hourOf(end) which was always midnight
  for (let i = 0; i < rollups.length; i++) {
    const r = rollups[i]
    if (projectSet !== null && !projectSet.has(r.cwd || '__none__')) continue
    if (r.first === null || r.last === null || r.last < start || r.first > end) continue
    for (const [hk, b] of r.buckets) {
      if (hk < start || hk > end) continue
      const dk = bucketKey(hk, 'day')
      let total = 0
      if (hk === endHour) {
        // upper edge (whole-hour bound but the bucket may hold later events):
        // exact per-event filter
        for (const e of b.evts) {
          if (e[1] !== 2) continue
          const t = e[0]
          if (t > now) continue  // use now instead of end (which is now)
          const model = e[2]
          if (modelSet !== null && !modelSet.has(model)) continue
          total += e[3] + e[4] + e[5]
        }
      } else if (modelSet === null) {
        for (const per of b.per.values()) total += per[PER_INPUT] + per[PER_OUTPUT] + per[PER_CACHE]
      } else {
        for (const [model, per] of b.per) {
          if (modelSet.has(model)) total += per[PER_INPUT] + per[PER_OUTPUT] + per[PER_CACHE]
        }
      }
      if (total > 0) dayMap.set(dk, (dayMap.get(dk) || 0) + total)
    }
  }
  return {
    start,
    end,
    days: Array.from(dayMap.entries()).map(([t, tokens]) => ({ t, tokens }))
  }
}

// ---------- derived helpers for the host layer ----------
// Build the display string for a session record (title fallback chain).
export function sessionTitle(rec, pathTitle) {
  const hdr = rec.header || {}
  const cwd = hdr.cwd || ''
  const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
  return hdr.title || (hdr.meta && hdr.meta.title) || rec.title || pathTitle.get(cwd) || base || hdr.id || '未知会话'
}





