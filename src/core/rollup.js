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

// 定价表：CSV 美元×7 折算人民币；deepseek-v4-flash 用 DeepSeek 官网官方人民币价 [输入, 输出, 缓存命中] ¥/百万 tokens
export const PRICES = {"claude-3-haiku":[1.75,8.75,0.21],"claude-3-opus":[105,525,10.5],"claude-3.5-haiku":[5.6,28,0.56],"claude-3.5-sonnet":[21,105,2.1],"claude-3.7-sonnet":[21,105,2.1],"claude-fable-5":[70,350,7],"claude-haiku-4-5":[7,35,0.7],"claude-mythos-5":[70,350,7],"claude-opus-4":[105,525,10.5],"claude-opus-4-1":[105,525,10.5],"claude-opus-4-5":[35,175,3.5],"claude-opus-4-6":[35,175,3.5],"claude-opus-4-7":[35,175,3.5],"claude-opus-4-8":[35,175,3.5],"claude-opus-4-8-fast":[70,350,7],"claude-opus-5":[35,175,3.5],"claude-opus-5-fast":[70,350,7],"claude-sonnet-4":[21,105,2.1],"claude-sonnet-4-5":[21,105,2.1],"claude-sonnet-4-6":[21,105,2.1],"claude-sonnet-5":[14,70,1.4],"codex-mini-latest":[10.5,42,2.625],"gpt-3.5-turbo":[3.5,10.5,0],"gpt-4":[210,420,0],"gpt-4-turbo":[70,210,0],"gpt-4.1":[14,56,3.5],"gpt-4.1-mini":[2.8,11.2,0.7],"gpt-4.1-nano":[0.7,2.8,0.175],"gpt-4o":[17.5,70,8.75],"gpt-4o-mini":[1.05,4.2,0.525],"gpt-5":[8.75,70,0.875],"gpt-5-codex":[8.75,70,0.875],"gpt-5-mini":[1.75,14,0.175],"gpt-5-nano":[0.35,2.8,0.035],"gpt-5.1":[8.75,70,0.875],"gpt-5.1-codex":[8.75,70,0.875],"gpt-5.1-codex-max":[8.75,70,0.875],"gpt-5.1-codex-mini":[1.75,14,0.175],"gpt-5.2":[12.25,98,1.225],"gpt-5.2-codex":[12.25,98,1.225],"gpt-5.3-codex":[12.25,98,1.225],"gpt-5.4":[17.5,105,1.75],"gpt-5.4-codex":[17.5,105,1.75],"gpt-5.4-mini":[5.25,31.5,0.525],"gpt-5.4-nano":[1.4,8.75,0.14],"gpt-5.4-pro":[210,1260,0],"gpt-5.5":[35,210,3.5],"gpt-5.5-codex":[17.5,105,1.75],"gpt-5.5-fast":[87.5,525,8.75],"gpt-5.5-flex":[17.5,105,1.75],"gpt-5.5-pro":[210,1260,0],"gpt-5.6-cyber":[87.5,525,8.75],"gpt-5.6-luna":[1.4,8.4,0.14],"gpt-5.6-luna-batch":[0.7,4.2,0.07],"gpt-5.6-luna-fast":[2.8,16.8,0.28],"gpt-5.6-luna-flex":[0.7,4.2,0.07],"gpt-5.6-sol":[35,210,3.5],"gpt-5.6-sol-batch":[17.5,105,1.75],"gpt-5.6-sol-fast":[70,420,7],"gpt-5.6-sol-flex":[17.5,105,1.75],"gpt-5.6-terra":[14,84,1.4],"gpt-5.6-terra-batch":[7,42,0.7],"gpt-5.6-terra-fast":[28,168,2.8],"gpt-5.6-terra-flex":[7,42,0.7],"o1":[105,420,52.5],"o1-mini":[7.7,30.8,3.85],"o1-preview":[105,420,52.5],"o3":[14,56,3.5],"o3-mini":[7.7,30.8,3.85],"o3-pro":[140,560,0],"o4-mini":[7.7,30.8,1.925],"gemini-1.5-flash":[0.525,2.1,0.1313],"gemini-1.5-pro":[24.5,73.5,0],"gemini-2.0-flash":[0.7,2.8,0.175],"gemini-2.0-flash-lite":[0.525,2.1,0.1313],"gemini-2.5-flash":[2.1,17.5,0.21],"gemini-2.5-flash-lite":[0.7,2.8,0.07],"gemini-2.5-pro":[8.75,70,0.875],"gemini-3-flash":[3.5,21,0.35],"gemini-3-flash-preview":[3.5,21,0.35],"gemini-3-pro":[14,84,1.4],"gemini-3-pro-preview":[14,84,1.4],"gemini-3.1-flash-lite":[1.75,10.5,0.175],"gemini-3.1-flash-lite-preview":[1.75,10.5,0.175],"gemini-3.1-pro":[14,84,1.4],"gemini-3.1-pro-preview":[14,84,1.4],"gemini-3.5-flash":[10.5,63,1.05],"gemini-3.5-flash-lite":[2.1,17.5,0.21],"gemini-3.5-flash-preview":[10.5,63,1.05],"gemini-3.6-flash":[10.5,52.5,1.05],"gemini-3.7-flash":[10.5,52.5,1.05],"gemini-3.7-flash-batch":[5.25,26.25,0.525],"gemini-3.7-flash-fast":[18.9,94.5,1.89],"gemini-3.7-flash-flex":[5.25,26.25,0.525],"muse-spark-1.1":[8.75,29.75,1.05],"deepseek-chat":[0.98,1.96,0.0196],"deepseek-coder":[0.98,1.96,0],"deepseek-r1":[3.85,15.33,0.98],"deepseek-reasoner":[0.98,1.96,0.0196],"deepseek-v3":[1.89,7.7,0.49],"deepseek-v3.1":[3.92,11.76,0.49],"deepseek-v3.2":[1.96,2.94,0.196],"deepseek-v4-flash":[0.56,1.4,0.028],"deepseek-v4-pro":[9.24,27.72,0.308],"qwen-coder":[2.1,10.5,0],"qwen-max":[11.2,44.8,0],"qwen-plus":[2.8,8.4,0],"qwen-turbo":[0.35,1.4,0],"qwen3-coder-next":[4.2,16.8,0],"qwen3-coder-plus":[2.8,11.2,0],"qwen3-max":[8.4,42,1.68],"qwen3.5-plus":[2.8,8.4,0],"qwen3.6-flash":[1.75,10.5,0],"qwen3.6-plus":[1.96,11.69,0.392],"qwen3.7-flash":[0.21,0.91,0.042],"qwen3.7-max":[17.5,52.5,0],"qwen3.7-plus":[2.8,11.2,0],"qwen3.8-max":[14,42,1.75],"glm-4.5":[4.2,15.4,0.77],"glm-4.5-air":[1.4,7.7,0.21],"glm-4.5-airx":[7.7,31.5,0],"glm-4.5-x":[15.4,62.3,0],"glm-4.5v":[4.2,12.6,0],"glm-4.6":[4.2,15.4,0.77],"glm-4.7":[4.2,15.4,0.77],"glm-4.7-flashx":[0.49,2.8,0.07],"glm-5":[7,22.4,1.4],"glm-5-code":[8.4,35,2.1],"glm-5-turbo":[8.4,28,1.68],"glm-5.1":[9.8,30.8,1.82],"glm-5.2":[9.8,30.8,1.82],"glm-5v-turbo":[8.4,28,1.68],"k2p6":[6.65,28,1.12],"kimi-for-coding":[4.2,21,0.7],"kimi-for-coding-highspeed":[12.6,63,2.1],"kimi-k2":[4.2,17.5,1.05],"kimi-k2.5":[4.2,21,0.7],"kimi-k2.6":[6.65,28,1.12],"kimi-k2.7-code":[6.65,28,1.33],"kimi-k3":[21,105,2.1],"moonshot-v1-128k":[14,35,0],"moonshot-v1-32k":[7,21,0],"moonshot-v1-8k":[1.4,14,0],"minimax-m2":[2.1,8.4,0.21],"minimax-m2.1":[2.1,8.4,0.21],"minimax-m2.5":[2.1,8.4,0.21],"minimax-m2.7":[2.1,8.4,0.42],"minimax-m2.7-highspeed":[4.2,16.8,0.42],"minimax-m3":[4.2,16.8,0.84],"codestral-2508":[2.1,6.3,0],"ministral-14b-2512":[1.4,1.4,0],"ministral-3b-2512":[0.7,0.7,0],"ministral-8b-2512":[1.05,1.05,0],"mistral-large-2512":[3.5,10.5,0],"mistral-medium-3-5":[10.5,52.5,0],"mistral-small-2603":[1.05,4.2,0],"grok-3-beta":[21,105,5.25],"grok-4":[21,105,5.25],"grok-4-0709":[21,105,5.25],"grok-4-fast-non-reasoning":[1.4,3.5,0.35],"grok-4-fast-reasoning":[1.4,3.5,0.35],"grok-4.20":[8.75,17.5,1.4],"grok-4.20-multi-agent":[8.75,17.5,1.4],"grok-4.20-non-reasoning":[8.75,17.5,1.4],"grok-4.20-reasoning":[8.75,17.5,1.4],"grok-4.3":[8.75,17.5,1.4],"grok-4.5":[14,42,2.1],"grok-4.6":[14,42,3.5],"grok-build-0.1":[7,14,1.4],"grok-code-fast-1":[1.4,10.5,0.14],"auto":[8.75,42,1.75],"composer-1":[8.75,70,0.875],"composer-1.5":[24.5,122.5,2.45],"composer-2":[3.5,17.5,1.4],"composer-2.5":[3.5,17.5,1.4],"hy3":[1.05,4.13,0.2625],"hy3-preview":[1.26,4.13,0.42],"doubao-lite-128k":[0.287,0.581,0.056],"doubao-pro-128k":[0.777,1.939,0.154],"doubao-seed-2.0-code":[3.143,15.974,0.63],"doubao-seed-2.0-lite":[0.581,3.486,0.119],"doubao-seed-2.0-mini":[0.196,1.939,0.042],"doubao-seed-2.0-pro":[3.094,15.491,0.616],"doubao-seed-2.1-pro":[5.803,29.029,1.162],"doubao-seed-2.1-turbo":[2.905,14.511,0.581],"doubao-seed-code":[1.162,7.742,0.231],"mimo-v2-flash":[0.7,2.1,0.07],"mimo-v2-omni":[2.8,14,0.56],"mimo-v2-pro":[7,21,1.4],"mimo-v2.5":[0.98,1.96,0.0196],"mimo-v2.5-pro":[3.045,6.09,0.0252],"mimo-v2.5-pro-ultraspeed":[9.135,18.27,0.0756],"step-3.5-flash":[0.7,2.1,0.14],"step-3.7-flash":[1.4,8.05,0.28],"ling-2.6-1t":[4.375,17.5,0],"ling-2.6-flash":[0.581,1.75,0],"ling-3.0-flash":[0.483,1.456,0],"ring-2.6-1t":[4.375,17.5,0],"longcat-2.0":[4.858,19.446,0.098],"agnes-2.0-flash":[0.21,1.05,0],"agnes-2.5-flash":[0.21,1.05,0],"agnes-2.5-pro":[3.15,6.3,0.0266],"agnes-2.5-pro-alpha":[3.15,6.3,0.0266]}

// 模型 → 定价；未匹配返回 null（不计费）
export function priceFor(model) {
  const id = String(model || '')
  if (!id) return null
  if (PRICES[id]) return { matched: id, p: PRICES[id] }
  const stripped = id.replace(/-free$/, '')
  if (stripped !== id && PRICES[stripped]) return { matched: stripped, p: PRICES[stripped] }
  return null
}

// ---------- time helpers ----------
const HOUR = 3600000
const DAY = 86400000
const WEEK = 7 * DAY

export function num(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}
function pad2(n) { return n < 10 ? '0' + n : String(n) }
export function mondayOf(t) {
  const d = new Date(t)
  const day = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime()
}
export function cellOf(t) {
  const d = new Date(t)
  return d.getDay() * 24 + d.getHours()
}
function weekLabel(monday) {
  const s = new Date(monday)
  const e = new Date(monday + 6 * DAY)
  return (s.getMonth() + 1) + '/' + s.getDate() + '-' + (e.getMonth() + 1) + '/' + e.getDate()
}
export function hourOf(t) {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime()
}
export function rangeBounds(req) {
  const now = Date.now()
  const d = new Date()
  const sod = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  switch (req.range) {
    case 'today': return [sod, now]
    case '24h': return [now - DAY, now]
    case '7d': return [now - 7 * DAY, now]
    case '30d': return [now - 30 * DAY, now]
    case '90d': return [now - 90 * DAY, now]
    case 'custom': return [req.from || 0, req.to || now]
    default: return [0, now]
  }
}
export function prevWindow(range, lo, hi) {
  if (range === 'today') return [lo - DAY, lo]
  const span = hi - lo
  return [lo - span, lo]
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
  const d = new Date(t)
  if (gran === 'hour') return hourOf(t)
  if (gran === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return mondayOf(t)
}
export function bucketLabel(key, gran) {
  const d = new Date(key)
  if (gran === 'hour') return pad2(d.getHours())
  if (gran === 'day') return (d.getMonth() + 1) + '/' + d.getDate()
  return weekLabel(key)
}
export function bucketSeries(lo, hi, gran) {
  const keys = []
  const step = gran === 'hour' ? HOUR : gran === 'day' ? DAY : WEEK
  let k = bucketKey(lo, gran)
  const end = bucketKey(hi, gran)
  let guard = 0
  while (k <= end && guard < 500) {
    keys.push(k)
    k += step
    guard += 1
  }
  return keys
}

// ---------- fold: events → one session rollup ----------
// Bucket layout (sparse hourly):
//   per:    Map<model, [in, out, cache, costIn, costOut, costCache, calls, durUA]>
//   msg:    [user, injected, assistant, toolCalls, toolResults]
//   durGap: sum of ≤10min inter-message gaps starting in this hour (usage durMs)
//   activeMs: step/call wall time attributed to the hour it STARTED
//   first/last/hasMsg: bucket message span (trend totalMs / sessions)
//   evts:   lightweight per-event detail [t, type, model|null, in, out, cache,
//           costIn, costOut, costCache] — used to make window EDGE buckets
//           exact (windows rarely align on the hour: e.g. 7d starts at
//           now-7d, not 00:00). Non-edge buckets use the aggregates.
//           type: 0 user, 1 injected, 2 assistant, 3 toolCall, 4 toolResult
export function foldSession(events) {
  const buckets = new Map()
  const modelMeta = new Map() // model → { matched, p } (full-span; pricing rows)
  let first = Infinity
  let last = -Infinity
  let lastUserT = null
  const openSteps = new Map()   // turn:step → { t, hk }
  const pendingCalls = new Map() // callId → { t, hk }
  const times = [] // [t, hk] pairs of message-like events, ascending

  function bucketAt(hk) {
    let b = buckets.get(hk)
    if (!b) {
      b = { per: new Map(), msg: [0, 0, 0, 0, 0], durGap: 0, activeMs: 0, first: 0, last: 0, hasMsg: false, evts: [] }
      buckets.set(hk, b)
    }
    return b
  }
  function bucketAtTime(t) { return bucketAt(hourOf(t)) }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    const t = ev.time
    switch (ev.type) {
      case 'user/message': {
        if (t < first) first = t
        if (t > last) last = t
        const src = ev.data && ev.data.source
        const b = bucketAtTime(t)
        if (src && src.kind === 'user') b.msg[0] += 1
        else b.msg[1] += 1
        lastUserT = t
        b.hasMsg = true
        if (t < b.first || !b.first) b.first = t
        if (t > b.last) b.last = t
        b.evts.push([t, src && src.kind === 'user' ? 0 : 1, null, 0, 0, 0, 0, 0, 0])
        times.push([t, hourOf(t)])
        break
      }
      case 'assistant/message': {
        if (t < first) first = t
        if (t > last) last = t
        const hk = hourOf(t)
        const b = bucketAt(hk)
        b.msg[2] += 1
        b.hasMsg = true
        if (t < b.first || !b.first) b.first = t
        if (t > b.last) b.last = t
        times.push([t, hk])
        const stepKey = ev.data.turn + ':' + ev.data.step
        const open = openSteps.get(stepKey)
        if (open) {
          const diff = Math.max(0, t - open.t)
          bucketAt(open.hk).activeMs += diff
          // backfill the exact duration onto the step/start event detail so
          // window EDGE buckets can filter activeMs precisely
          if (open.evtIdx >= 0 && open.bucketEvts) open.bucketEvts[open.evtIdx][10] += diff
          openSteps.delete(stepKey)
        }
        const usage = ev.data.usage
        if (usage) {
          const msg = ev.data.message
          const model = msg && msg.source ? String(msg.source.model || '') : ''
          const pr = priceFor(model)
          const inp = num(usage.inputTokens)
          const otp = num(usage.outputTokens)
          const cr = num(usage.cacheReadTokens)
          const cw = num(usage.cacheWriteTokens)
          let costIn = 0, costOut = 0, costCache = 0
          if (pr) {
            costIn = inp * pr.p[0] / 1e6
            costOut = otp * pr.p[1] / 1e6
            costCache = (cr * pr.p[2] + cw * pr.p[0]) / 1e6
          }
          b.evts.push([t, 2, model, inp, otp, cr + cw, costIn, costOut, costCache, lastUserT !== null ? Math.max(0, t - lastUserT) : 0])
          let per = b.per.get(model)
          if (!per) {
            per = [0, 0, 0, 0, 0, 0, 0, 0, 0] // in, out, cache, costIn, costOut, costCache, calls, durUA, matched
            b.per.set(model, per)
          }
          per[0] += inp
          per[1] += otp
          per[2] += cr + cw
          per[3] += costIn
          per[4] += costOut
          per[5] += costCache
          per[6] += 1
          per[8] = pr ? 1 : per[8]
          if (lastUserT !== null) per[7] += Math.max(0, t - lastUserT)
          if (pr && !modelMeta.has(model)) modelMeta.set(model, { matched: pr.matched, p: pr.p })
        }
        break
      }
      case 'tool/call': {
        if (t < first) first = t
        if (t > last) last = t
        const hk = hourOf(t)
        const b = bucketAt(hk)
        b.msg[3] += 1
        b.hasMsg = true
        if (t < b.first || !b.first) b.first = t
        if (t > b.last) b.last = t
        b.evts.push([t, 3, null, 0, 0, 0, 0, 0, 0, 0, 0])
        times.push([t, hk])
        if (ev.data && ev.data.callId) pendingCalls.set(ev.data.callId, { t, hk, evtIdx: b.evts.length - 1, bucketEvts: b.evts })
        break
      }
      case 'tool/result': {
        if (t < first) first = t
        if (t > last) last = t
        const hk = hourOf(t)
        const b = bucketAt(hk)
        b.msg[4] += 1
        b.hasMsg = true
        if (t < b.first || !b.first) b.first = t
        if (t > b.last) b.last = t
        b.evts.push([t, 4, null, 0, 0, 0, 0, 0, 0])
        times.push([t, hk])
        const src = ev.data && ev.data.message && ev.data.message.source
        if (src && src.callId) {
          const open = pendingCalls.get(src.callId)
          if (open) {
            const diff = Math.max(0, t - open.t)
            bucketAt(open.hk).activeMs += diff
            if (open.evtIdx >= 0 && open.bucketEvts) open.bucketEvts[open.evtIdx][10] += diff
            pendingCalls.delete(src.callId)
          }
        }
        break
      }
      case 'step/start': {
        const stepKey = ev.data.turn + ':' + ev.data.step
        const b = bucketAtTime(t)
        b.evts.push([t, 5, null, 0, 0, 0, 0, 0, 0, 0, 0])
        openSteps.set(stepKey, { t, hk: hourOf(t), evtIdx: b.evts.length - 1, bucketEvts: b.evts })
        break
      }
      default:
        break
    }
  }

  // inter-message gaps ≤ 10min → attributed to the hour of the EARLIER message
  for (let k = 0; k < times.length - 1; k++) {
    const gap = times[k + 1][0] - times[k][0]
    if (gap > 0 && gap <= 600000) bucketAt(times[k][1]).durGap += gap
  }

  return {
    first: Number.isFinite(first) ? first : null,
    last: last >= 0 ? last : null,
    buckets,
    modelMeta
  }
}

// ---------- query: usage (totals + trend + heat + distributions) ----------
// Single pass over the rollups; the current window and the previous
// (comparison) window are accumulated in the same traversal.
export function queryUsage(rollups, req, opts) {
  const [lo, hi] = rangeBounds(req)
  const gran = pickGranularity(req, lo, hi)
  const [plo, phi] = prevWindow(req.range, lo, hi)
  const modelSet = opts && opts.modelSet ? opts.modelSet : (Array.isArray(req.models) && req.models.length ? new Set(req.models) : null)
  const projectSet = opts && opts.projectSet ? opts.projectSet : (Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null)
  const pathTitle = (opts && opts.pathTitle) || new Map()

  const mk = () => ({
    totals: {
      cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0,
      activeMs: 0, totalMs: 0, sessions: 0,
      userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, totalMessages: 0
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
  const modelAgg = new Map()      // model → { id, calls, input, output, cache, cost, matched, p }
  const projectAgg = new Map()    // cwd → { input, output, cache, cost }
  const projectList = new Map()   // cwd → { id, title, sessions } (all rollups)

  const acc = (agg, per) => {
    agg.totals.cost += per[3] + per[4] + per[5]
    agg.totals.inputTokens += per[0]
    agg.totals.outputTokens += per[1]
    agg.totals.cacheTokens += per[2]
    if (per[8]) agg.matchedTokens += per[0] + per[1] + per[2]
    agg.totalUsageTokens += per[0] + per[1] + per[2]
  }

  for (let i = 0; i < rollups.length; i++) {
    const r = rollups[i]
    const cwd = r.cwd || ''
    // project dropdown entry (every rollup, independent of window)
    const id = cwd || '__none__'
    let pl = projectList.get(id)
    if (!pl) {
      const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
      pl = { id, title: pathTitle.get(cwd) || base || '未分组', sessions: 0 }
      projectList.set(id, pl)
    }
    pl.sessions += 1

    // project filter: skip aggregation for non-selected projects (dropdown
    // still lists every project, matching the previous behavior)
    if (projectSet !== null && !projectSet.has(cwd)) continue

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
            if (gap > 0 && gap <= 600000) {
              heatDur[cellOf(last.t)] += gap
              const gk = bucketKey(last.t, gran)
              let g = bucketMap.get(gk)
              if (!g) {
                g = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
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
        const lastT = edgeAccumulate(lo, hi, modelSet, b.evts, cellOf(lo), {
          totals: cur.totals, heatToken, heatCost, heatDur,
          bucketMap, gran, modelAgg, projectAgg, cwd, gkSpan
        })
        if (lastT !== null) edgeLastCur = { hk, t: lastT }
      } else if (inCurB && b.per.size > 0) {
        if (modelSet === null) {
          for (const [model, per] of b.per) {
            acc(cur, per)
            heatToken[cell] += per[0] + per[1] + per[2]
            heatCost[cell] += per[3] + per[4] + per[5]
            mergeModel(modelAgg, model, per)
          }
        } else {
          for (const [model, per] of b.per) {
            // dropdown / pricing rows list EVERY model in the window
            mergeModel(modelAgg, model, per)
            if (!modelSet.has(model)) continue
            acc(cur, per)
            heatToken[cell] += per[0] + per[1] + per[2]
            heatCost[cell] += per[3] + per[4] + per[5]
          }
        }
      }
      if (prevEdge) {
        edgeAccumulate(plo, phi, modelSet, b.evts, cellOf(plo), {
          totals: prev.totals, heatToken: null, heatCost: null, heatDur: null,
          bucketMap: null, gran, modelAgg: null, projectAgg: null, cwd: null, gkSpan: null
        })
      } else if (inPrevB && b.per.size > 0) {
        if (modelSet === null) {
          for (const [model, per] of b.per) acc(prev, per)
        } else {
          for (const [model, per] of b.per) {
            if (modelSet.has(model)) acc(prev, per)
          }
        }
      }

      if (inCurB) {
        // activeMs: edge buckets contribute their EXACT per-event value via
        // edgeAccumulate (step/call durations backfilled in evts); aggregate
        // buckets use the folded value
        if (!curEdge) cur.totals.activeMs += b.activeMs
        if (!curEdge) {
          cur.totals.userMessages += b.msg[0]
          cur.totals.injectedMessages += b.msg[1]
          cur.totals.assistantMessages += b.msg[2]
          cur.totals.toolCalls += b.msg[3]
          cur.totals.toolResults += b.msg[4]
          heatDur[cell] += b.durGap
          const gk = bucketKey(hk, gran)
          let g = bucketMap.get(gk)
          if (!g) {
            g = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
            bucketMap.set(gk, g)
          }
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
            let pg = projectAgg.get(cwd)
            if (!pg) { pg = { input: 0, output: 0, cache: 0, cost: 0 }; projectAgg.set(cwd, pg) }
            if (modelSet === null) {
              for (const per of b.per.values()) {
                g.input += per[0]; g.output += per[1]; g.cache += per[2]
                g.costIn += per[3]; g.costOut += per[4]; g.costCache += per[5]
                pg.input += per[0]; pg.output += per[1]; pg.cache += per[2]
                pg.cost += per[3] + per[4] + per[5]
              }
            } else {
              for (const [model, per] of b.per) {
                if (!modelSet.has(model)) continue
                g.input += per[0]; g.output += per[1]; g.cache += per[2]
                g.costIn += per[3]; g.costOut += per[4]; g.costCache += per[5]
                pg.input += per[0]; pg.output += per[1]; pg.cache += per[2]
                pg.cost += per[3] + per[4] + per[5]
              }
            }
          }
        }
      }
      if (inPrevB) {
        if (!prevEdge) prev.totals.activeMs += b.activeMs
        if (!prevEdge) {
          prev.totals.userMessages += b.msg[0]
          prev.totals.injectedMessages += b.msg[1]
          prev.totals.assistantMessages += b.msg[2]
          prev.totals.toolCalls += b.msg[3]
          prev.totals.toolResults += b.msg[4]
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
    const g = bucketMap.get(gk)
    if (!g) continue
    g.totalMs = mergeIntervals(ints)
    g.sessions = ints.length
  }

  cur.totals.totalTokens = cur.totals.inputTokens + cur.totals.outputTokens + cur.totals.cacheTokens
  cur.totals.totalMessages = cur.totals.userMessages + cur.totals.injectedMessages + cur.totals.assistantMessages + cur.totals.toolCalls + cur.totals.toolResults
  prev.totals.totalTokens = prev.totals.inputTokens + prev.totals.outputTokens + prev.totals.cacheTokens
  prev.totals.totalMessages = prev.totals.userMessages + prev.totals.injectedMessages + prev.totals.assistantMessages + prev.totals.toolCalls + prev.totals.toolResults

  function pct(c, p) {
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

  const keys = bucketSeries(lo, hi, gran)
  const buckets = keys.map((bk) => {
    const b = bucketMap.get(bk)
    return {
      label: bucketLabel(bk, gran),
      input: b ? b.input : 0,
      output: b ? b.output : 0,
      cache: b ? b.cache : 0,
      costIn: b ? b.costIn : 0,
      costOut: b ? b.costOut : 0,
      costCache: b ? b.costCache : 0,
      durMs: b ? b.durMs : 0,
      totalMs: b ? b.totalMs : 0,
      sessions: b ? b.sessions : 0
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
  const pricingRows = Array.from(modelAgg.values()).map((m) => ({ model: m.id, matched: m.matched, p: m.p }))
  const models = Array.from(modelAgg.values()).sort((a, b) => b.cost - a.cost)
  const distModels = (modelSet ? models.filter((m) => modelSet.has(m.id)) : models)
    .map((m) => ({ id: m.id, tokens: m.input + m.output + m.cache, cost: m.cost }))
    .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
  // every project appears in the distribution (zero-value rows included,
  // matching the legacy behavior; the client filters zeros)
  const distProjects = Array.from(projectList.values())
    .map((p) => {
      const agg = projectAgg.get(p.id === '__none__' ? '' : p.id)
      return { id: p.id, label: p.title, tokens: agg ? agg.input + agg.output + agg.cache : 0, cost: agg ? agg.cost : 0 }
    })
    .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
  const projects = Array.from(projectList.values()).sort((a, b) => a.title.localeCompare(b.title, 'zh'))

  return {
    totals: cur.totals,
    buckets,
    granularity: gran,
    heat: { token: heatToken, cost: heatCost, dur: heatDur },
    meta: { models, projects, pricing: { coverage, rows: pricingRows }, dist: { models: distModels, projects: distProjects } }
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
    g = { id: model, calls: 0, input: 0, output: 0, cache: 0, cost: 0, matched: null, p: null }
    map.set(model, g)
  }
  g.calls += per[6]
  g.input += per[0]
  g.output += per[1]
  g.cache += per[2]
  g.cost += per[3] + per[4] + per[5]
  // matched/p come from the rollup-level modelMeta; mergeModel receives per only,
  // so the caller patches matched/p afterwards (see queryUsage model patching below)
  return g
}

// Exact accumulation of one window EDGE bucket (window bounds rarely align
// with the hour). Iterates the bucket's per-event detail and adds only events
// within [tLo, tHi] to the sink. Non-edge buckets use the aggregates instead.
// evts entry: [t, type, model|null, in, out, cache, costIn, costOut, costCache,
//              durUA, actMs] — type: 0 user, 1 injected, 2 assistant, 3 toolCall,
//              4 toolResult, 5 step/start (actMs backfilled at close)
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
    if (type === 5) {
      // step/start: contributes only its exact (backfilled) activeMs;
      // it is not a message — no counts, spans, or gap participation
      const am = e[10] || 0
      if (am > 0) sink.totals.activeMs += am
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
        // dropdown / pricing rows carry the FULL model aggregate (unfiltered)
        if (sink.modelAgg) mergeModel(sink.modelAgg, model, [inp, otp, cache, costIn, costOut, costCache, 1, 0, 1])
        if (modelSet === null || modelSet.has(model)) {
          sink.totals.cost += costIn + costOut + costCache
          sink.totals.inputTokens += inp
          sink.totals.outputTokens += otp
          sink.totals.cacheTokens += cache
          sink.totals.totalUsageTokens += inp + otp + cache
          if (priceFor(model)) sink.totals.matchedTokens += inp + otp + cache
          if (sink.heatToken) sink.heatToken[cell] += inp + otp + cache
          if (sink.heatCost) sink.heatCost[cell] += costIn + costOut + costCache
          if (sink.bucketMap) {
            const gk = bucketKey(t, sink.gran)
            let g = sink.bucketMap.get(gk)
            if (!g) {
              g = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
              sink.bucketMap.set(gk, g)
            }
            g.input += inp; g.output += otp; g.cache += cache
            g.costIn += costIn; g.costOut += costOut; g.costCache += costCache
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
      const am = e[10] || 0
      if (am > 0) sink.totals.activeMs += am
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
            g = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
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

// First event time within [tLo, tHi] in a bucket's detail, or null.
function firstInWindow(b, tLo, tHi) {
  const evts = b.evts
  for (let i = 0; i < evts.length; i++) {
    const t = evts[i][0]
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
      }
    }
  }
}

// ---------- query: detail records ----------
export function queryDetail(rollups, req) {
  const [lo, hi] = rangeBounds(req)
  let gran = req.range === 'today' || req.range === '24h' ? 'hour' : 'day'
  if (req.range === 'custom') gran = (hi - lo) <= 48 * HOUR ? 'hour' : 'day'
  const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
  const projectSet = Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null

  const bucketMap = new Map() // key: gk \u0000 model \u0000 cwd
  for (let i = 0; i < rollups.length; i++) {
    const r = rollups[i]
    if (projectSet !== null && !projectSet.has(r.cwd || '')) continue
    if (r.first === null || r.last === null || r.last < lo || r.first > hi) continue
    const project = r.projectTitle || '未分组'
    const cwdKey = r.cwd || ''
    for (const [hk, b] of r.buckets) {
      if (hk + HOUR <= lo || hk > hi) continue
      if (isEdgeBucket(hk, lo, hi)) {
        // exact: per-event detail
        for (const e of b.evts) {
          const t = e[0]
          if (t < lo || t > hi) continue
          if (e[1] !== 2) continue
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
        row.input += per[0]
        row.output += per[1]
        row.cache += per[2]
        row.cost += per[3] + per[4] + per[5]
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
  const now = Date.now()
  const d = new Date()
  const thisSunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime()
  const start = thisSunday - 52 * 7 * DAY
  const end = thisSunday + 6 * DAY
  const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
  const projectSet = Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null
  const dayMap = new Map()
  const endHour = hourOf(end)
  for (let i = 0; i < rollups.length; i++) {
    const r = rollups[i]
    if (projectSet !== null && !projectSet.has(r.cwd || '')) continue
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
          if (t > end) continue
          const model = e[2]
          if (modelSet !== null && !modelSet.has(model)) continue
          total += e[3] + e[4] + e[5]
        }
      } else if (modelSet === null) {
        for (const per of b.per.values()) total += per[0] + per[1] + per[2]
      } else {
        for (const [model, per] of b.per) {
          if (modelSet.has(model)) total += per[0] + per[1] + per[2]
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
