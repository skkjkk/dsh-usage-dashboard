// dsh-usage-dashboard benchmark & correctness harness.
//
// Compares the v0.2 materialized-rollup engine (src/core/rollup.js) against a
// faithful re-implementation of the v0.1 full-scan algorithm on synthesized
// session data, then asserts field-level equality of every dashboard payload.
//
// Usage: npm run bench   (node scripts/bench.js)
import { execFileSync } from 'node:child_process'
import { foldSession, foldAppend, emptyRollup, queryUsage, queryDetail, queryCalendar, priceFor, priceForAt, resolveDSModel, num, rangeBounds, prevWindow, pickGranularity, bucketKey, bucketLabel, bucketSeries, presetBucketCount, cellOf } from '../src/core/rollup.js'

const HOUR = 3600000
const DAY = 86400000

// ---------- deterministic RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// DS_PEAK_SINCE: 2026-08-17 00:00 北京时间 = 2026-08-16 16:00 UTC
// Before this timestamp, priceForAt falls back to priceFor (static CSV pricing).
// Used for fairness comparison against the v0.1 legacy algorithm.
const DS_PEAK_SINCE = Date.UTC(2026, 7, 16, 16)
const fixedNow = DS_PEAK_SINCE - 1 // one ms before the threshold ensures CSV pricing

// ---------- synthetic data ----------
const MODELS = ['deepseek-v4-flash', 'deepseek-chat', 'gpt-5', 'gemini-3-pro', 'unknown-model-x']
const CWDS = ['D:/a/alpha', 'D:/b/beta', 'C:/dev/gamma', 'D:/a/delta', 'E:/misc']

function genSession(rnd, idx, now) {
  const msgs = 40 + Math.floor(rnd() * 40)
  const events = []
  // Keep a few deterministic sessions inside today's window so the today
  // edge path is exercised, while leaving enough historical sessions for all
  // rolling-window comparisons. The 8h recent offset is larger than the
  // generated session duration, so no event lands in the future.
  const start = idx < 8
    ? now - 8 * HOUR - Math.floor(rnd() * 2 * HOUR)
    : now - DAY - Math.floor(rnd() * 85) * DAY - Math.floor(rnd() * DAY * 0.5)
  const cwd = CWDS[idx % CWDS.length]
  let t = start
  let turn = 0
  let step = 0
  let callSeq = 0
  for (let m = 0; m < msgs; m++) {
    const gap = 2000 + Math.floor(rnd() * 240000) // 2s..4min mostly, some >10min
    t += gap
    if (rnd() < 0.12) t += 700000 // occasional >10min gap (duration boundary)
    const model = MODELS[Math.floor(rnd() * MODELS.length)]
    if (rnd() < 0.42) {
      turn += 1; step = 0
      events.push({ type: 'user/message', time: t, data: { source: { kind: 'user' } } })
      events.push({ type: 'step/start', time: t + 1, data: { turn, step } })
      t += 1
      const inp = Math.floor(rnd() * 4000)
      const otp = Math.floor(rnd() * 3000)
      const cr = Math.floor(rnd() * 8000)
      const cw = Math.floor(rnd() * 200)
      const outputStart = t + 800 + Math.floor(rnd() * 1200) // TTFT (excluded)
      const outputEnd = outputStart + 100 + Math.floor(rnd() * 900) // generation only
      events.push({ type: 'assistant/chunk', time: outputStart, data: { turn, step, chunk: { type: 'text-delta', index: 0, text: 'x' } } })
      events.push({ type: 'assistant/chunk', time: outputEnd, data: { turn, step, chunk: { type: 'finish', reason: 'stop' } } })
      t = outputEnd
      events.push({
        type: 'assistant/message', time: t,
        data: {
          turn, step,
          usage: { inputTokens: inp, outputTokens: otp, cacheReadTokens: cr, cacheWriteTokens: cw },
          message: { source: { model } }
        }
      })
      step += 1
      if (rnd() < 0.5) {
        const callId = 'c' + (callSeq++)
        t += 1000
        events.push({ type: 'tool/call', time: t, data: { callId } })
        t += 5000
        events.push({ type: 'tool/result', time: t, data: { message: { source: { callId } } } })
      }
    } else {
      // assistant-only continuation (no user message in between)
      const inp = Math.floor(rnd() * 2000)
      const otp = Math.floor(rnd() * 2500)
      const outputStart = t + 500 + Math.floor(rnd() * 1000)
      const outputEnd = outputStart + 100 + Math.floor(rnd() * 700)
      events.push({ type: 'assistant/chunk', time: outputStart, data: { turn, step, chunk: { type: 'text-delta', index: 0, text: 'x' } } })
      events.push({ type: 'assistant/chunk', time: outputEnd, data: { turn, step, chunk: { type: 'finish', reason: 'stop' } } })
      t = outputEnd
      events.push({
        type: 'assistant/message', time: t,
        data: {
          turn, step,
          usage: { inputTokens: inp, outputTokens: otp, cacheReadTokens: 0, cacheWriteTokens: 0 },
          message: { source: { model } }
        }
      })
      step += 1
    }
  }
  events.sort((a, b) => a.time - b.time)
  return { id: 'sess-' + idx, header: { id: 'sess-' + idx, cwd, title: '会话' + idx, meta: {} }, events }
}

// =====================================================================
// v0.1 legacy full-scan algorithm (faithful port of the old src/host.js)
// =====================================================================
function legacyProcessSession(events, lo, hi, modelSet, gran) {
  const out = {
    cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, activeMs: 0,
    matchedTokens: 0, totalUsageTokens: 0,
    inRange: false,
    userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0,
    buckets: new Map(), bucketSpan: new Map(),
    heatToken: new Array(168).fill(0), heatCost: new Array(168).fill(0), heatDur: new Array(168).fill(0),
    times: [], models: new Map()
  }
  const openGenerations = new Map()
  for (const ev of events) {
    const t = ev.time
    if (t < lo || t > hi) continue
    out.inRange = true
    switch (ev.type) {
      case 'user/message': {
        const src = ev.data && ev.data.source
        if (src && src.kind === 'user') out.userMessages += 1
        else out.injectedMessages += 1
        out.times.push(t)
        break
      }
      case 'assistant/message': {
        out.assistantMessages += 1
        out.times.push(t)
        const stepKey = ev.data.turn + ':' + ev.data.step
        if (openGenerations.has(stepKey)) {
          out.activeMs += Math.max(0, t - openGenerations.get(stepKey))
          openGenerations.delete(stepKey)
        }
        const usage = ev.data.usage
        if (usage) {
          const msg = ev.data.message
          const model = msg && msg.source ? String(msg.source.model || '') : ''
          // 与 v0.3 引擎共享同一取价函数（含 DeepSeek 峰谷按事件时间定价）
          const pr = priceForAt(model, t)
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
          let mm = out.models.get(model)
          if (!mm) {
            mm = { id: model, calls: 0, input: 0, output: 0, cache: 0, cost: 0, matched: pr ? pr.matched : null, p: pr ? pr.p : null }
            out.models.set(model, mm)
          }
          mm.calls += 1
          mm.input += inp
          mm.output += otp
          mm.cache += cr + cw
          mm.cost += costIn + costOut + costCache
          out.totalUsageTokens += inp + otp + cr + cw
          if (pr) out.matchedTokens += inp + otp + cr + cw
          if (modelSet !== null && !modelSet.has(model)) break
          out.cost += costIn + costOut + costCache
          out.inputTokens += inp
          out.outputTokens += otp
          out.cacheTokens += cr + cw
          const bk = bucketKey(t, gran)
          let b = out.buckets.get(bk)
          if (!b) {
            b = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
            out.buckets.set(bk, b)
          }
          b.input += inp
          b.output += otp
          b.cache += cr + cw
          b.costIn += costIn
          b.costOut += costOut
          b.costCache += costCache
          const c = cellOf(t)
          out.heatToken[c] += inp + otp + cr + cw
          out.heatCost[c] += costIn + costOut + costCache
        }
        break
      }
      case 'tool/call': {
        out.toolCalls += 1
        out.times.push(t)
        break
      }
      case 'tool/result': {
        out.toolResults += 1
        out.times.push(t)
        break
      }
      case 'assistant/chunk': {
        const data = ev.data || {}
        const chunk = data.chunk || {}
        const stepKey = data.turn + ':' + data.step
        if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta' || chunk.type === 'tool-call-delta') {
          if (!openGenerations.has(stepKey)) openGenerations.set(stepKey, t)
        } else if (chunk.type === 'finish' && openGenerations.has(stepKey)) {
          out.activeMs += Math.max(0, t - openGenerations.get(stepKey))
          openGenerations.delete(stepKey)
        }
        break
      }
      case 'step/end': {
        const stepKey = ev.data.turn + ':' + ev.data.step
        if (openGenerations.has(stepKey)) {
          out.activeMs += Math.max(0, t - openGenerations.get(stepKey))
          openGenerations.delete(stepKey)
        }
        break
      }
      case 'step/start':
        break
      default:
        break
    }
  }
  out.times.sort((a, b) => a - b)
  for (let k = 0; k < out.times.length; k++) {
    const t = out.times[k]
    const bk = bucketKey(t, gran)
    let sp = out.bucketSpan.get(bk)
    if (!sp) { sp = { first: t, last: t }; out.bucketSpan.set(bk, sp) }
    if (t < sp.first) sp.first = t
    if (t > sp.last) sp.last = t
    if (k < out.times.length - 1) {
      const gap = out.times[k + 1] - t
      if (gap > 0 && gap <= 600000) {
        out.heatDur[cellOf(t)] += gap
        let b = out.buckets.get(bk)
        if (!b) {
          b = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
          out.buckets.set(bk, b)
        }
        b.durMs += gap
      }
    }
  }
  for (const [bk, sp] of out.bucketSpan) {
    let b = out.buckets.get(bk)
    if (!b) {
      b = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
      out.buckets.set(bk, b)
    }
    b.totalMs = Math.max(0, sp.last - sp.first)
    b.sessions = 1
  }
  return out
}

function legacyComputeWindow(loaded, targets, lo, hi, modelSet, gran, range) {
  const totals = {
    cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0,
    activeMs: 0, totalMs: 0, sessions: 0,
    userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, totalMessages: 0
  }
  const bucketMap = new Map()
  const heatToken = new Array(168).fill(0)
  const heatCost = new Array(168).fill(0)
  const heatDur = new Array(168).fill(0)
  const modelAgg = new Map()
  const projectAgg = new Map()
  let matchedTokens = 0
  let totalUsageTokens = 0
  for (let i = 0; i < loaded.length; i++) {
    const events = loaded[i]
    if (!events) continue
    const r = legacyProcessSession(events, lo, hi, modelSet, gran)
    if (r.inRange) {
      totals.sessions += 1
    }
    totals.cost += r.cost
    totals.inputTokens += r.inputTokens
    totals.outputTokens += r.outputTokens
    totals.cacheTokens += r.cacheTokens
    totals.activeMs += r.activeMs
    totals.userMessages += r.userMessages
    totals.injectedMessages += r.injectedMessages
    totals.assistantMessages += r.assistantMessages
    totals.toolCalls += r.toolCalls
    totals.toolResults += r.toolResults
    matchedTokens += r.matchedTokens
    totalUsageTokens += r.totalUsageTokens
    {
      const cwd = (targets[i].header && targets[i].header.cwd) || ''
      let pg = projectAgg.get(cwd)
      if (!pg) { pg = { input: 0, output: 0, cache: 0, cost: 0 }; projectAgg.set(cwd, pg) }
      pg.input += r.inputTokens
      pg.output += r.outputTokens
      pg.cache += r.cacheTokens
      pg.cost += r.cost
    }
    for (const [model, mm] of r.models) {
      let g = modelAgg.get(model)
      if (!g) { g = { id: model, calls: 0, input: 0, output: 0, cache: 0, cost: 0, matched: mm.matched, p: mm.p }; modelAgg.set(model, g) }
      g.calls += mm.calls
      g.input += mm.input
      g.output += mm.output
      g.cache += mm.cache
      g.cost += mm.cost
    }
    for (const [bk, b] of r.buckets) {
      let g = bucketMap.get(bk)
      if (!g) {
        g = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
        bucketMap.set(bk, g)
      }
      g.input += b.input
      g.output += b.output
      g.cache += b.cache
      g.costIn += b.costIn
      g.costOut += b.costOut
      g.costCache += b.costCache
      g.durMs += b.durMs
      g.totalMs += b.totalMs
      g.sessions += b.sessions
    }
    for (let k = 0; k < 168; k++) {
      heatToken[k] += r.heatToken[k]
      heatCost[k] += r.heatCost[k]
      heatDur[k] += r.heatDur[k]
    }
  }
  totals.totalTokens = totals.inputTokens + totals.outputTokens + totals.cacheTokens
  totals.totalMessages = totals.userMessages + totals.injectedMessages + totals.assistantMessages + totals.toolCalls + totals.toolResults
  const keys = bucketSeries(lo, hi, gran, presetBucketCount(range, gran))
  const buckets = keys.map((bk) => {
    const b = bucketMap.get(bk)
    return {
      label: bucketLabel(bk, gran),
      input: b ? b.input : 0, output: b ? b.output : 0, cache: b ? b.cache : 0,
      costIn: b ? b.costIn : 0, costOut: b ? b.costOut : 0, costCache: b ? b.costCache : 0,
      durMs: b ? b.durMs : 0, totalMs: b ? b.totalMs : 0, sessions: b ? b.sessions : 0
    }
  })
  return {
    totals, buckets, heat: { token: heatToken, cost: heatCost, dur: heatDur },
    models: Array.from(modelAgg.values()).sort((a, b) => b.cost - a.cost),
    projectAgg, matchedTokens, totalUsageTokens
  }
}

function legacyUsage(sessions, req) {
  const [lo, hi] = rangeBounds(req)
  const gran = pickGranularity(req, lo, hi)
  const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
  const loaded = sessions.map((s) => s.events)
  const targets = sessions.map((s) => ({ header: s.header }))
  const [plo, phi] = prevWindow(req.range, lo, hi)
  const cur = legacyComputeWindow(loaded, targets, lo, hi, modelSet, gran, req.range)
  const prev = legacyComputeWindow(loaded, targets, plo, phi, modelSet, gran, req.range)
  const t = cur.totals
  const pt = prev.totals
  const pct = (c, p) => (!(p > 0) ? null : (c - p) / p * 100)
  t.pct = {
    cost: pct(t.cost, pt.cost), totalTokens: pct(t.totalTokens, pt.totalTokens),
    inputTokens: pct(t.inputTokens, pt.inputTokens), outputTokens: pct(t.outputTokens, pt.outputTokens),
    cacheTokens: pct(t.cacheTokens, pt.cacheTokens), activeMs: pct(t.activeMs, pt.activeMs),
    totalMs: pct(t.totalMs, pt.totalMs), sessions: pct(t.sessions, pt.sessions),
    totalMessages: pct(t.totalMessages, pt.totalMessages), userMessages: pct(t.userMessages, pt.userMessages)
  }
  const coverage = cur.totalUsageTokens > 0 ? Math.round(cur.matchedTokens / cur.totalUsageTokens * 100) : 0
  const pricingRows = cur.models.map((m) => ({ model: m.id, matched: m.matched, p: m.p }))
  const distModels = (modelSet ? cur.models.filter((m) => modelSet.has(m.id)) : cur.models)
    .map((m) => ({ id: m.id, tokens: m.input + m.output + m.cache, cost: m.cost }))
    .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
  const distProjects = Array.from(cur.projectAgg.entries())
    .map(([cwd, p]) => {
      const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
      return { id: cwd || '__none__', label: base || '未分组', tokens: p.input + p.output + p.cache, cost: p.cost }
    })
    .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
  const projects = []
  for (const s of sessions) {
    const cwd = s.header.cwd || ''
    const id = cwd || '__none__'
    let p = projects.find((x) => x.id === id)
    if (!p) {
      const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
      projects.push({ id, title: base || '未分组', sessions: 0 })
      p = projects[projects.length - 1]
    }
    p.sessions += 1
  }
  projects.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  return {
    totals: t, buckets: cur.buckets, granularity: gran, heat: cur.heat,
    meta: { models: cur.models, projects, pricing: { coverage, rows: pricingRows }, dist: { models: distModels, projects: distProjects } }
  }
}

function legacyDetail(sessions, req) {
  const [lo, hi] = rangeBounds(req)
  let gran = req.range === 'today' || req.range === '24h' ? 'hour' : 'day'
  if (req.range === 'custom') gran = (hi - lo) <= 48 * 3600000 ? 'hour' : 'day'
  const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
  // rows grouped by (time bucket, model, project), matching queryDetail
  const bucketMap = new Map()
  for (const s of sessions) {
    const hdr = s.header || {}
    const cwd = hdr.cwd || ''
    const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
    const project = base || '未分组'
    for (const ev of s.events) {
      const t = ev.time
      if (t < lo || t > hi) continue
      if (ev.type !== 'assistant/message') continue
      const usage = ev.data && ev.data.usage
      if (!usage) continue
      const msg = ev.data.message
      const model = msg && msg.source ? String(msg.source.model || '') : ''
      if (modelSet !== null && !modelSet.has(model)) continue
      const pr = priceFor(model)
      const inp = num(usage.inputTokens)
      const otp = num(usage.outputTokens)
      const cr = num(usage.cacheReadTokens)
      const cw = num(usage.cacheWriteTokens)
      let cost = 0
      if (pr) cost = (inp * pr.p[0] + otp * pr.p[1] + cr * pr.p[2] + cw * pr.p[0]) / 1e6
      const gk = bucketKey(t, gran)
      const key = gk + '|' + model + '|' + cwd
      let b = bucketMap.get(key)
      if (!b) {
        b = { t: gk, project, model, input: 0, output: 0, cache: 0, cost: 0 }
        bucketMap.set(key, b)
      }
      b.input += inp
      b.output += otp
      b.cache += cr + cw
      b.cost += cost
    }
  }
  const rows = Array.from(bucketMap.values())
  rows.sort((a, b) => b.t - a.t || a.project.localeCompare(b.project, 'zh') || a.model.localeCompare(b.model))
  // same pagination as queryDetail (offset 0, limit capped at 200)
  return { gran, total: rows.length, rows: rows.slice(0, 200) }
}

function legacyCalendar(sessions, req) {
  const input = req || {}
  const now = typeof input.now === 'number' ? input.now : Date.now()
  const thisSunday = bucketKey(now, 'day') - Math.floor(cellOf(now) / 24) * DAY
  const start = thisSunday - 52 * 7 * 86400000
  const end = now
  const modelSet = Array.isArray(input.models) && input.models.length ? new Set(input.models) : null
  const dayMap = new Map()
  for (const s of sessions) {
    for (const ev of s.events) {
      const t = ev.time
      if (t < start || t > end) continue
      if (ev.type !== 'assistant/message') continue
      const usage = ev.data && ev.data.usage
      if (!usage) continue
      const msg = ev.data.message
      const model = msg && msg.source ? String(msg.source.model || '') : ''
      if (modelSet !== null && !modelSet.has(model)) continue
      const k = bucketKey(t, 'day')
      dayMap.set(k, (dayMap.get(k) || 0) + num(usage.inputTokens) + num(usage.outputTokens) + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens))
    }
  }
  return {
    start, end,
    days: Array.from(dayMap.entries()).map(([t, tokens]) => ({ t, tokens }))
  }
}

// ---------- comparison helpers ----------
function near(a, b, tol = 1e-9) {
  if (a === b) return true
  if (a === null || b === null) return false
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), 1) * tol
}
function assertEq(label, a, b, tol) {
  if (!near(a, b, tol)) throw new Error(label + ': ' + a + ' != ' + b)
}

function compareUsage(label, l, n) {
  const lt = l.totals
  const nt = n.totals
  for (const k of ['cost', 'inputTokens', 'outputTokens', 'cacheTokens', 'totalTokens', 'sessions', 'userMessages', 'injectedMessages', 'assistantMessages', 'toolCalls', 'toolResults', 'totalMessages']) {
    assertEq(label + '.totals.' + k, lt[k], nt[k], 1e-6)
  }
  // activeMs: the only retained approximation — a step STARTING inside the
  // edge hour but before the window bound (legacy drops it, v0.2 counts it).
  // Bounded by one hour per window; assert with a relative tolerance.
  assertEq(label + '.totals.activeMs', lt.activeMs, nt.activeMs, 0.02)
  // totalMs intentionally differs (v0.2 fixes the v0.1 always-zero bug)
  for (const k of Object.keys(lt.pct || {})) {
    // totalMs: v0.2 fixes the v0.1 always-zero bug (legacy pct is null)
    if (k === 'totalMs') continue
    // activeMs tolerance inherits the edge-hour approximation
    const tol = k === 'activeMs' ? 0.1 : 1e-6
    assertEq(label + '.pct.' + k, lt.pct[k], nt.pct[k], tol)
  }
  assertEq(label + '.buckets.length', l.buckets.length, n.buckets.length)
  for (let i = 0; i < l.buckets.length; i++) {
    for (const k of ['input', 'output', 'cache', 'costIn', 'costOut', 'costCache', 'durMs', 'sessions']) {
      assertEq(label + '.buckets[' + i + '].' + k, l.buckets[i][k], n.buckets[i][k], 1e-6)
    }
  }
  for (const h of ['token', 'cost', 'dur']) {
    for (let i = 0; i < 168; i++) assertEq(label + '.heat.' + h + '[' + i + ']', l.heat[h][i], n.heat[h][i], 0.5)
  }
  assertEq(label + '.meta.models.length', l.meta.models.length, n.meta.models.length)
  for (let i = 0; i < l.meta.models.length; i++) {
    const lm = l.meta.models[i]
    const nm = n.meta.models[i]
    assertEq(label + '.models[' + i + '].id', lm.id, nm.id)
    for (const k of ['calls', 'input', 'output', 'cache', 'cost']) assertEq(label + '.models[' + i + '].' + k, lm[k], nm[k], 1e-6)
    assertEq(label + '.models[' + i + '].matched', lm.matched, nm.matched)
  }
  assertEq(label + '.meta.projects.length', l.meta.projects.length, n.meta.projects.length)
  assertEq(label + '.meta.pricing.coverage', l.meta.pricing.coverage, n.meta.pricing.coverage)
  assertEq(label + '.meta.dist.models.length', l.meta.dist.models.length, n.meta.dist.models.length)
  assertEq(label + '.meta.dist.projects.length', l.meta.dist.projects.length, n.meta.dist.projects.length)
  const projectTokens = n.meta.dist.projects.reduce((sum, p) => sum + p.tokens, 0)
  const projectCost = n.meta.dist.projects.reduce((sum, p) => sum + p.cost, 0)
  assertEq(label + '.meta.dist.projects.tokens', projectTokens, nt.totalTokens, 1e-6)
  assertEq(label + '.meta.dist.projects.cost', projectCost, nt.cost, 1e-6)
}

function assertUsageMeaningful(label, req, result) {
  const [lo, hi] = rangeBounds(req)
  if (!(result.totals.sessions > 0 && result.totals.totalTokens > 0)) {
    throw new Error(label + ': synthetic window unexpectedly empty')
  }
  if (result.totals.totalMs < 0 || result.totals.totalMs > hi - lo) {
    throw new Error(label + ': totalMs outside window bounds: ' + result.totals.totalMs)
  }
}

function compareDetail(label, l, n) {
  assertEq(label + '.gran', l.gran, n.gran)
  assertEq(label + '.total', l.total, n.total)
  assertEq(label + '.rows.length', l.rows.length, n.rows.length)
  for (let i = 0; i < l.rows.length; i++) {
    const lr = l.rows[i]
    const nr = n.rows[i]
    assertEq(label + '.rows[' + i + '].t', lr.t, nr.t)
    assertEq(label + '.rows[' + i + '].project', lr.project, nr.project)
    assertEq(label + '.rows[' + i + '].model', lr.model, nr.model)
    for (const k of ['input', 'output', 'cache', 'cost']) assertEq(label + '.rows[' + i + '].' + k, lr[k], nr[k], 1e-6)
  }
}

function compareCalendar(label, l, n) {
  assertEq(label + '.start', l.start, n.start)
  assertEq(label + '.end', l.end, n.end)
  assertEq(label + '.days.length', l.days.length, n.days.length)
  const lm = new Map(l.days.map((d) => [d.t, d.tokens]))
  const nm = new Map(n.days.map((d) => [d.t, d.tokens]))
  for (const [t, v] of lm) assertEq(label + '.days[' + t + ']', v, nm.get(t) || 0, 1e-6)
}

function time(label, fn) {
  const t0 = process.hrtime.bigint()
  const r = fn()
  const t1 = process.hrtime.bigint()
  const ms = Number(t1 - t0) / 1e6
  console.log('  ' + label.padEnd(44) + ms.toFixed(2).padStart(10) + ' ms')
  return { ms, r }
}

// ---------- main ----------
const SESSIONS = Number(process.env.BENCH_SESSIONS || 300)
const REPEAT = Number(process.env.BENCH_REPEAT || 50)

const rnd = mulberry32(20260815)
const now = fixedNow
const sessions = []
for (let i = 0; i < SESSIONS; i++) sessions.push(genSession(rnd, i, now))
const totalEvents = sessions.reduce((s, x) => s + x.events.length, 0)
console.log('sessions=' + SESSIONS + ' events=' + totalEvents)

// new engine: fold once (cold materialization), then query repeatedly
const rollups = sessions.map((s) => {
  const r = foldSession(s.events)
  r.id = s.id
  r.cwd = s.header.cwd
  r.title = s.header.title
  const base = (r.cwd || '').split(/[\\/]/).filter(Boolean).pop() || ''
  r.projectTitle = base || '未分组'
  return r
})

// Regenerate sessions with fixedNow (before DS_PEAK_SINCE) so that priceForAt
// falls back to priceFor (static CSV pricing), making costs match between the
// v0.2 engine and the v0.1 legacy algorithm. The peak-val pricing semantics are
// verified separately in [4].
const fixedSessions = []
const rndFixed = mulberry32(20260815) // same seed for reproducibility
for (let i = 0; i < SESSIONS; i++) {
  fixedSessions.push(genSession(rndFixed, i, fixedNow))
}
const fixedTotalEvents = fixedSessions.reduce((s, x) => s + x.events.length, 0)
console.log('fixed sessions=' + SESSIONS + ' events=' + fixedTotalEvents)

// new engine: fold once (cold materialization), then query repeatedly
const fixedRollups = fixedSessions.map((s) => {
  const r = foldSession(s.events)
  r.id = s.id
  r.cwd = s.header.cwd
  r.title = s.header.title
  const base = (r.cwd || '').split(/[\\/]/).filter(Boolean).pop() || ''
  r.projectTitle = base || '未分组'
  return r
})

const REQS = [
  { name: 'today', req: { range: 'today', now } },
  { name: '7d', req: { range: '7d', now } },
  { name: '30d', req: { range: '30d', now } },
  { name: '90d', req: { range: '90d', now } },
  { name: 'custom', req: { range: 'custom', now, from: now - 45 * DAY, to: now } },
  { name: '7d+model', req: { range: '7d', now, models: ['deepseek-v4-flash'] } }
]

console.log('\n[0a] activeMs generation semantics (TTFT/tool wait excluded)')
{
  const t0 = Date.now() - 600000
  const events = [
    { type: 'user/message', time: t0, data: { source: { kind: 'user' } } },
    { type: 'step/start', time: t0 + 100, data: { turn: 0, step: 0 } },
    { type: 'assistant/chunk', time: t0 + 2000, data: { turn: 0, step: 0, chunk: { type: 'text-delta', index: 0, text: 'hello' } } },
    { type: 'assistant/chunk', time: t0 + 2500, data: { turn: 0, step: 0, chunk: { type: 'text-delta', index: 0, text: ' world' } } },
    { type: 'assistant/chunk', time: t0 + 3000, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
    { type: 'assistant/message', time: t0 + 3001, data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } },
    { type: 'tool/call', time: t0 + 4000, data: { callId: 'tool-0' } },
    { type: 'tool/result', time: t0 + 14000, data: { message: { source: { callId: 'tool-0' } } } }
  ]
  const r = foldSession(events)
  r.id = 'active-semantics'
  r.cwd = 'D:/u'
  r.projectTitle = 'u'
  const q = queryUsage([r], { range: 'custom', from: t0, to: t0 + 20000 }, {})
  assertEq('activeMs.generationOnly', q.totals.activeMs, 1000)
  assertEq('totalMs.messageSpan', q.totals.totalMs, 14000)
  console.log('  activeMs generation   OK (TTFT and 10s tool wait excluded)')
}

console.log('\n[0a2] activeMs step-interval fallback (chunkless DSH v2+ logs)')
{
  const t0 = fixedNow - 1200000
  const asst = (time, turn, step) => ({
    type: 'assistant/message', time,
    data: { turn, step, usage: { inputTokens: 10, outputTokens: 5 }, message: { source: { model: 'qwen3.8-flash' } } }
  })
  const events = [
    { type: 'user/message', time: t0, data: { source: { kind: 'user' } } },
    // step 0: DSH v2+ persistence (no chunks) → interval [step/start, assistant/message]
    { type: 'step/start', time: t0 + 100, data: { turn: 0, step: 0 } },
    asst(t0 + 5100, 0, 0),
    { type: 'tool/call', time: t0 + 5200, data: { callId: 'c0' } },
    { type: 'tool/result', time: t0 + 15200, data: { message: { source: { callId: 'c0' } } } },
    { type: 'step/end', time: t0 + 15300, data: { turn: 0, step: 0 } },
    // step 1: interrupted without any message → contributes nothing
    { type: 'step/start', time: t0 + 16000, data: { turn: 1, step: 0 } },
    { type: 'step/end', time: t0 + 40000, data: { turn: 1, step: 0 } },
    // step 2: legacy chunked log → chunk interval wins; the message close is a no-op
    { type: 'step/start', time: t0 + 50000, data: { turn: 2, step: 0 } },
    { type: 'assistant/chunk', time: t0 + 52000, data: { turn: 2, step: 0, chunk: { type: 'reasoning-delta', index: 0 } } },
    { type: 'assistant/chunk', time: t0 + 55000, data: { turn: 2, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
    asst(t0 + 55001, 2, 0)
  ]
  const r = foldSession(events)
  r.id = 'active-step-fallback'
  r.cwd = 'D:/u'
  r.projectTitle = 'u'
  const q = queryUsage([r], { range: 'custom', from: t0 - 1, to: t0 + 60000 }, {})
  // step0: 5000ms + step1: 0 + step2: 3000ms (chunk) — no double-count at the message close
  assertEq('activeMs.stepFallback', q.totals.activeMs, 8000)
  // the live event stream (foldAppend per event) must produce the identical result
  const r2 = emptyRollup()
  for (const ev of events) foldAppend(r2, ev)
  r2.id = r.id; r2.cwd = r.cwd; r2.projectTitle = r.projectTitle
  const q2 = queryUsage([r2], { range: 'custom', from: t0 - 1, to: t0 + 60000 }, {})
  assertEq('activeMs.stepFallback.append', q2.totals.activeMs, q.totals.activeMs)
  // qwen3.8-flash must be priced (CSV row 127; cost 0 regression guard)
  const pr = priceFor('qwen3.8-flash')
  if (!pr) throw new Error('qwen3.8-flash missing from the generated PRICES table')
  assertEq('pricing.qwen38flash.in', pr.p[0], 0.8)
  assertEq('pricing.qwen38flash.out', pr.p[1], 2.7)
  assertEq('pricing.qwen38flash.cache', pr.p[2], 0.1)
  console.log('  activeMs step fallback OK (message close 5s + chunk 3s, abort excluded; qwen3.8-flash priced)')
}

console.log('\n[0a3] proximity join: interval credited to a keyless (migrated) message')
{
  const t0 = fixedNow - 3 * HOUR
  const mkMsg = (time) => ({
    type: 'assistant/message', time,
    data: { usage: { inputTokens: 10, outputTokens: 5 }, message: { source: { model: 'deepseek-chat' } } }
  })
  const events = [
    { type: 'user/message', time: t0, data: { source: { kind: 'user' } } },
    { type: 'step/start', time: t0 + 50, data: { turn: 1, step: 1 } },
    { type: 'assistant/chunk', time: t0 + 1500, data: { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'x' } } },
    { type: 'assistant/chunk', time: t0 + 4200, data: { turn: 1, step: 1, chunk: { type: 'finish', reason: 'stop' } } },
    // message envelope lost turn/step in migration — key pairing impossible
    mkMsg(t0 + 4205),
    // no new finish before this one → must NOT be timed (no double-credit)
    mkMsg(t0 + 5000)
  ]
  const r = foldSession(events)
  r.id = 'join'; r.cwd = 'D:/u'; r.projectTitle = 'u'
  const q = queryUsage([r], { range: 'custom', from: t0 - 1, to: t0 + 60000 }, {})
  const m = q.meta.models.find((x) => x.id === 'deepseek-chat')
  assertEq('join.activeMs', q.totals.activeMs, 2700)
  assertEq('join.avg', m.avgResponseMs, 2700)
  assertEq('join.timedCalls', m.timedCalls, 1)
  assertEq('join.calls', m.calls, 2)
  console.log('  proximity join       OK (adjacent interval credited once; keyless strays stay un-timed)')
}

console.log('\n[0b] range and percentage boundaries')
{
  const bounds = rangeBounds({ range: 'custom', now: 1000, from: 0, to: 100 })
  assertEq('range.custom.zeroFrom', bounds[0], 0)
  assertEq('range.custom.explicitTo', bounds[1], 100)
  const reversed = rangeBounds({ range: 'custom', now: 1000, from: 900, to: 100 })
  assertEq('range.custom.reverse.from', reversed[0], 100)
  assertEq('range.custom.reverse.to', reversed[1], 900)
  const r = foldSession([
    { type: 'user/message', time: fixedNow, data: { source: { kind: 'user' } } },
    { type: 'assistant/chunk', time: fixedNow + 1000, data: { turn: 0, step: 0, chunk: { type: 'text-delta', index: 0, text: 'x' } } },
    { type: 'assistant/chunk', time: fixedNow + 2000, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
    { type: 'assistant/message', time: fixedNow + 2000, data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } }
  ])
  const q = queryUsage([r], { range: 'custom', from: fixedNow, to: fixedNow + 3000 }, {})
  assertEq('pct.zeroBaseline', q.totals.pct.totalTokens, null)
  console.log('  boundaries             OK (explicit zero, reverse custom, zero-baseline pct)')
}

console.log('\n[0c] preset trend bucket counts')
{
  const probeNow = Date.UTC(2026, 7, 19, 5, 30, 0, 0) // 13:30 Beijing time
  const minimum = { today: 14, '24h': 24, '7d': 7, '30d': 30, '90d': 13 }
  for (const range of Object.keys(minimum)) {
    const [lo, hi] = rangeBounds({ range, now: probeNow })
    const gran = pickGranularity({ range }, lo, hi)
    const count = presetBucketCount(range, gran)
    const step = gran === 'hour' ? 3600000 : gran === 'day' ? DAY : 7 * DAY
    const end = bucketKey(hi, gran)
    const naturalStart = count ? end - step * (count - 1) : bucketKey(lo, gran)
    const expectedStart = Math.min(naturalStart, bucketKey(lo, gran))
    const expectedCount = Math.floor((end - expectedStart) / step) + 1
    const keys = bucketSeries(lo, hi, gran, count)
    assertEq('preset.' + range + '.minimum', keys.length >= minimum[range], true)
    assertEq('preset.' + range + '.bucketCount', keys.length, expectedCount)
  }
  console.log('  preset counts           OK (minimum preset span plus any partial lower-edge bucket)')
}

console.log('\n[0d] targeted edge and boundary regressions')
{
  const H = 3600000
  const MIN = 60000
  const probeNow = Date.UTC(2026, 7, 19, 7, 30) // 15:30 Beijing time
  const hour = bucketKey(probeNow, 'hour')
  const day = bucketKey(probeNow, 'day')
  const assistant = (time, model = 'deepseek-v4-flash', cr = 0, cw = 0) => ({
    type: 'assistant/message', time,
    data: {
      message: { source: { model } },
      usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: cr, cacheWriteTokens: cw }
    }
  })
  const noUsage = (time) => ({
    type: 'assistant/message', time,
    data: { message: { source: { model: 'deepseek-v4-flash' } } }
  })
  const user = (time) => ({ type: 'user/message', time, data: { source: { kind: 'user' } } })

  const edge = hour + 10 * MIN
  const edgeUsage = queryUsage([foldSession([assistant(edge, 'deepseek-v4-flash', 100)])], { range: 'today', now: probeNow })
  assertEq('edgeHeat.eventCell', edgeUsage.heat.token[cellOf(edge)], 103)
  assertEq('edgeHeat.beijingMidnight', edgeUsage.heat.token[cellOf(day)], 0)

  const filtered = queryUsage([foldSession([
    assistant(hour + 5 * MIN, 'deepseek-v4-flash', 123),
    assistant(hour + 10 * MIN, 'deepseek-v4-pro', 456)
  ])], { range: 'custom', from: hour, to: probeNow, models: ['deepseek-v4-flash'] })
  assertEq('edgeFilter.cacheRead', filtered.totals.cacheReadTokens, 123)
  assertEq('edgeFilter.cache', filtered.totals.cacheTokens, 123)

  const messageUsage = queryUsage([foldSession([user(hour + MIN), noUsage(hour + 5 * MIN)])], { range: 'custom', from: hour, to: probeNow })
  assertEq('messageOnly.user', messageUsage.totals.userMessages, 1)
  assertEq('messageOnly.assistant', messageUsage.totals.assistantMessages, 1)
  assertEq('messageOnly.total', messageUsage.totals.totalMessages, 2)
  const isolatedUsage = queryUsage([foldSession([noUsage(edge)])], { range: 'custom', from: hour, to: probeNow })
  const isolatedBucket = isolatedUsage.buckets.find((b) => b.sessions === 1)
  if (!isolatedBucket) throw new Error('messageOnly.isolated trend bucket missing')
  assertEq('messageOnly.isolated.totalMs', isolatedBucket.totalMs, 0)

  const comparisonLo = day + 10 * H
  const comparisonHi = comparisonLo + 5 * H - 1
  const comparisonTimes = [
    comparisonLo - 4 * H + 10 * MIN,
    comparisonLo - 3 * H + 10 * MIN,
    comparisonLo - 2 * H + 10 * MIN,
    comparisonLo + H + 10 * MIN,
    comparisonLo + 2 * H + 10 * MIN
  ]
  const comparison = queryUsage([foldSession(comparisonTimes.map(user))], { range: 'custom', from: comparisonLo, to: comparisonHi })
  assertEq('previousMessages.current', comparison.totals.userMessages, 2)
  assertEq('previousMessages.pct', comparison.totals.pct.userMessages, -33.33333333333333, 1e-9)

  const rollingLo = probeNow - DAY
  const lowerEdge = bucketKey(rollingLo, 'hour') + 40 * MIN
  const rolling = queryUsage([foldSession([assistant(lowerEdge)])], { range: '24h', now: probeNow })
  const trendTokens = rolling.buckets.reduce((sum, b) => sum + b.input + b.output + b.cache, 0)
  assertEq('rollingTrend.coverage', trendTokens, rolling.totals.totalTokens)

  assertEq('longSeries.bucketCount', bucketSeries(0, 1000 * DAY, 'day').length, 1001)
  const [previousLo, previousHi] = prevWindow('custom', 100, 200)
  assertEq('previousWindow.start', previousLo, 0)
  assertEq('previousWindow.end', previousHi, 99)
  const [zeroLo, zeroHi] = prevWindow('custom', 100, 100)
  if (!(zeroHi < zeroLo)) throw new Error('previousWindow.zeroRange overlaps current range')

  const prototypeRollup = foldSession([assistant(Date.UTC(2026, 8, 1), 'toString')])
  const prototypeUsage = queryUsage([prototypeRollup], { range: 'custom', from: Date.UTC(2026, 8, 1) - 1, to: Date.UTC(2026, 8, 1) + 1 })
  assertEq('prototype.priceFor', priceFor('toString'), null)
  assertEq('prototype.priceForAt', priceForAt('toString', Date.UTC(2026, 8, 1)), null)
  assertEq('prototype.cost', prototypeUsage.totals.cost, 0)

  assertEq('timezone.todayStart', rangeBounds({ range: 'today', now: probeNow })[0], day)
  assertEq('timezone.hourCell', cellOf(probeNow), 3 * 24 + 15)
  assertEq('timezone.hourLabel', bucketLabel(hour, 'hour'), '15')
  console.log('  targeted regressions     OK (edge heat/filter/message, rolling coverage, long series, comparison span, prototype keys, UTC+8)')
}

console.log('\n[0d] UTC+8 calendar buckets across DST')
{
  const code = [
    "import { bucketSeries } from './src/core/rollup.js'",
    "const now = new Date(2024, 2, 11, 12, 0, 0, 0).getTime()",
    "const day = 86400000",
    "const bjOffset = 8 * 3600000",
    "const expected = Array.from({ length: 8 }, (_, i) => Date.UTC(2024, 2, 5 + i) - bjOffset)",
    "const actual = bucketSeries(now - 7 * day, now, 'day', 7)",
    "if (actual.length !== expected.length || actual.some((v, i) => v !== expected[i])) throw new Error(JSON.stringify({ actual, expected }))"
  ].join('\n')
  execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: 'America/New_York' },
    stdio: 'inherit'
  })
  console.log('  UTC+8 calendar buckets OK (America/New_York spring transition)')
}

console.log('\n[0e] deterministic cache-metric regression assertions')
{
  const T0 = Date.UTC(2026, 7, 16, 10, 0, 0, 0) - 8 * HOUR // 2026-08-16 18:00 UTC (before peak threshold, static pricing)
  const H = 3600000
  const msg = (t, model, inp, otp, cr, cw) => ({
    type: 'assistant/message', time: t,
    data: {
      turn: 0, step: 0,
      usage: { inputTokens: inp, outputTokens: otp, cacheReadTokens: cr, cacheWriteTokens: cw },
      message: { source: { model } }
    }
  })
  const user = (t) => ({ type: 'user/message', time: t, data: { source: { kind: 'user' } } })

  // --- (a) input=100, cacheRead=800, cacheWrite=100 → expected totals ---
  // billedInput = input + cacheRead + cacheWrite = 100 + 800 + 100 = 1000
  // cacheHitRate = cacheRead / cacheObserved * 100 = 800 / 1000 * 100 = 80
  // cacheCoverage = cacheObserved / billedInput * 100 = 1000 / 1000 * 100 = 100
  const evtsA = [
    user(T0),
    msg(T0 + HOUR, 'deepseek-v4-flash', 100, 50, 800, 100)
  ]
  const rollA = foldSession(evtsA)
  rollA.id = 'cache-a'
  rollA.cwd = 'D:/u'
  rollA.projectTitle = 'u'
  const qA = queryUsage([rollA], { range: 'custom', from: T0, to: T0 + 2 * HOUR }, {})
  const tA = qA.totals
  assertEq('cache.a.cacheRead', tA.cacheRead, 800)
  assertEq('cache.a.cacheWrite', tA.cacheWrite, 100)
  assertEq('cache.a.billedInput', tA.billedInput, 1000)
  assertEq('cache.a.cacheObserved', tA.cacheObserved, 1000)
  assertEq('cache.a.cacheHitRate', tA.cacheHitRate, 80)
  assertEq('cache.a.cacheCoverage', tA.cacheCoverage, 100)
  assertEq('cache.a.billedInputTokens alias', tA.billedInputTokens, 1000)
  assertEq('cache.a.cacheObservedTokens alias', tA.cacheObservedTokens, 1000)
  assertEq('cache.a.cacheReadTokens alias', tA.cacheReadTokens, 800)
  assertEq('cache.a.cacheWriteTokens alias', tA.cacheWriteTokens, 100)
  console.log('  cache basic totals           OK (input=100, cr=800, cw=100 → hitRate=80, coverage=100)')

  // --- (b) weighted rate across two buckets/sessions uses sums not average ---
  // Session 1: input=200, cr=400, cw=0 → billedInput=600, hitRate=400/600*100≈66.67
  // Session 2: input=100, cr=100, cw=0  → billedInput=200, hitRate=100/200*100=50
  // Sum-based: totalCr=500, totalObserved=800 → hitRate=500/800*100=62.5
  // Average-of-rates would give (66.67+50)/2=58.33 — MUST NOT be this value
  const s1T = T0 + 2 * HOUR
  const evtsB = [
    user(s1T),
    msg(s1T + HOUR, 'deepseek-v4-flash', 200, 50, 400, 0),
    user(s1T + 2 * HOUR),
    msg(s1T + 3 * HOUR, 'deepseek-v4-flash', 100, 50, 100, 0)
  ]
  const rollB = foldSession(evtsB)
  rollB.id = 'cache-b'
  rollB.cwd = 'D:/u'
  rollB.projectTitle = 'u'
  const qB = queryUsage([rollB], { range: 'custom', from: s1T, to: s1T + 4 * HOUR }, {})
  const tB = qB.totals
  assertEq('cache.b.cacheRead', tB.cacheRead, 500)
  assertEq('cache.b.billedInput', tB.billedInput, 800)
  assertEq('cache.b.cacheObserved', tB.cacheObserved, 800)
  assertEq('cache.b.cacheHitRate (sum-based)', tB.cacheHitRate, 62.5)
  // Verify it's NOT the naive average-of-rates
  if (Math.abs(tB.cacheHitRate - 58.333333333333336) < 0.01) throw new Error('cacheHitRate is average-of-rates, not sum-based')
  console.log('  cache weighted rate          OK (two-session sum, not average of rates)')

  // --- (c) missing cache fields: cacheObserved=0, cacheHitRate=null, coverage=0 ---
  // An assistant/message without cache fields (cacheReadTokens/cacheWriteTokens absent)
  // produces billedInput=inputTokens (10), cacheObserved=0, cacheHitRate=null,
  // and cacheCoverage=0% (core coverage refactor: unknown-input coverage is 0%).
  const noCacheMsg = (t) => ({
    type: 'assistant/message', time: t,
    data: {
      turn: 0, step: 0,
      usage: { inputTokens: 10, outputTokens: 5 }, // no cache fields at all
      message: { source: { model: 'deepseek-v4-flash' } }
    }
  })
  const evtsC = [
    user(T0),
    noCacheMsg(T0 + HOUR)
  ]
  const rollC = foldSession(evtsC)
  rollC.id = 'cache-c'
  rollC.cwd = 'D:/u'
  rollC.projectTitle = 'u'
  const qC = queryUsage([rollC], { range: 'custom', from: T0, to: T0 + 2 * HOUR }, {})
  const tC = qC.totals
  assertEq('cache.c.billedInput (no fields)', tC.billedInput, 10)
  assertEq('cache.c.cacheObserved (no fields)', tC.cacheObserved, 0)
  assertEq('cache.c.cacheHitRate (no fields)', tC.cacheHitRate, null)
  assertEq('cache.c.cacheCoverage (no fields)', tC.cacheCoverage, 0)
  // Also verify the totalTokens is just input+output (no cache contribution)
  assertEq('cache.c.totalTokens', tC.totalTokens, 15)
  console.log('  cache missing fields         OK (billedInput=10, cacheObserved=0, hitRate=null, coverage=0%)')

  // --- (d) edge-window result matches full-window result for in-window events ---
  // Use unaligned bounds (offset by 12345ms) so the lower-edge bucket is
  // definitely an edge bucket, forcing edgeAccumulate to process the event
  // per-entry rather than relying on the aggregate path.
  const OFFSET = 12345
  const evtsD = [
    user(T0 + HOUR),
    msg(T0 + HOUR + 1800000, 'deepseek-v4-flash', 100, 50, 800, 100)
  ]
  const rollD = foldSession(evtsD)
  rollD.id = 'cache-d'
  rollD.cwd = 'D:/u'
  rollD.projectTitle = 'u'
  const qFull = queryUsage([rollD], { range: 'custom', from: T0, to: T0 + 3 * HOUR }, {})
  const qEdge = queryUsage([rollD], { range: 'custom', from: T0 + HOUR + OFFSET, to: T0 + 2 * HOUR + OFFSET }, {})
  assertEq('cache.edge.cacheRead', qEdge.totals.cacheRead, qFull.totals.cacheRead)
  assertEq('cache.edge.cacheWrite', qEdge.totals.cacheWrite, qFull.totals.cacheWrite)
  assertEq('cache.edge.billedInput', qEdge.totals.billedInput, qFull.totals.billedInput)
  assertEq('cache.edge.cacheObserved', qEdge.totals.cacheObserved, qFull.totals.cacheObserved)
  assertEq('cache.edge.cacheHitRate', qEdge.totals.cacheHitRate, qFull.totals.cacheHitRate)
  assertEq('cache.edge.cacheCoverage', qEdge.totals.cacheCoverage, qFull.totals.cacheCoverage)
  // Also verify per-bucket consistency for the narrow window
  const edgeBuckets = qEdge.buckets.filter((b) => b.cacheRead > 0 || b.billedInput > 0)
  if (edgeBuckets.length === 0) throw new Error('edge-window: no bucket with cache data')
  const edgeTotalCache = edgeBuckets.reduce((s, b) => s + b.cacheRead, 0)
  const edgeTotalBilled = edgeBuckets.reduce((s, b) => s + b.billedInput, 0)
  assertEq('cache.edge.bucketCacheSum', edgeTotalCache, qFull.totals.cacheRead)
  assertEq('cache.edge.bucketBilledSum', edgeTotalBilled, qFull.totals.billedInput)
  console.log('  cache edge-window            OK (unaligned bounds, edgeAccumulate preserves cache metrics)')

  // --- (e) model meta exposes cacheHitRate, avgResponseMs, p50ResponseMs, p95ResponseMs, calls ---
  // Build 3 messages with known generation durations via step/start+chunk+finish pattern.
  // Durations: 500ms, 1500ms, 3000ms — all captured by the latency histogram
  // (latencyHistAdd now correctly creates a histogram when starting from null).
  const genDur = (baseT, dur) => {
    const t = baseT
    return [
      user(t),
      { type: 'step/start', time: t + 100, data: { turn: 0, step: 0 } },
      { type: 'assistant/chunk', time: t + 200, data: { turn: 0, step: 0, chunk: { type: 'text-delta', index: 0, text: 'x' } } },
      { type: 'assistant/chunk', time: t + 200 + dur, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
      msg(t + 200 + dur + 1, 'deepseek-v4-flash', 100, 50, 800, 100)
    ]
  }
  const evtsE = [
    ...genDur(T0, 500),     // 500ms
    ...genDur(T0 + 2 * HOUR, 1500), // 1500ms
    ...genDur(T0 + 4 * HOUR, 3000)  // 3000ms
  ]
  const rollE = foldSession(evtsE)
  rollE.id = 'cache-e'
  rollE.cwd = 'D:/u'
  rollE.projectTitle = 'u'
  const qE = queryUsage([rollE], { range: 'custom', from: T0, to: T0 + 6 * HOUR }, {})
  const models = qE.meta.models
  const flash = models.find((m) => m.id === 'deepseek-v4-flash')
  if (!flash) throw new Error('model meta missing deepseek-v4-flash')
  assertEq('cache.meta.calls', flash.calls, 3)
  if (flash.cacheHitRate == null) throw new Error('model cacheHitRate missing')
  if (flash.avgResponseMs == null) throw new Error('model avgResponseMs missing')
  if (flash.p50ResponseMs == null) throw new Error('model p50ResponseMs missing')
  if (flash.p95ResponseMs == null) throw new Error('model p95ResponseMs missing')
  assertEq('cache.meta.cacheHitRate', flash.cacheHitRate, 80)
  // avgResponseMs = mean of the MEASURED chunk spans [500, 1500, 3000] — the
  // finish-recorded span is reused by the message (the old user→assistant
  // fallback span is gone), so the mean is exactly 5000/3.
  assertEq('cache.meta.avgResponseMs', flash.avgResponseMs, 5000 / 3, 1e-6)
  // bins: 500→upper500, 1500→upper2000, 3000→upper3000.
  // p50: target=ceil(0.5*3)=2 → 2nd sample (1500) → bin upper 2000
  assertEq('cache.meta.p50ResponseMs', flash.p50ResponseMs, 2000, 1e-6)
  // p95: target=ceil(0.95*3)=3 → 3rd sample (3000) → bin upper 3000
  assertEq('cache.meta.p95ResponseMs', flash.p95ResponseMs, 3000, 1e-6)
  assertEq('cache.meta.timedCalls', flash.timedCalls, 3)
  console.log('  cache meta row fields      OK (cacheHitRate=' + flash.cacheHitRate + ', calls=' + flash.calls + ', avgResponseMs=' + flash.avgResponseMs.toFixed(2) + ', p50=' + flash.p50ResponseMs + ', p95=' + flash.p95ResponseMs + ')')
}

console.log('\n[0f] malformed events fold without throwing')
{
  // The live event stream feeds foldAppend directly; a single malformed event
  // must never crash the host process or poison the whole session.
  const junk = [
    { type: 'user/message', time: fixedNow }, // no data
    { type: 'assistant/message', time: fixedNow + 1000 }, // no data at all
    { type: 'assistant/message', time: fixedNow + 2000, data: {} }, // no usage/turn/step
    { type: 'tool/call', time: fixedNow + 3000 },
    { type: 'tool/result', time: fixedNow + 4000 },
    { type: 'step/start', time: fixedNow + 4500 }, // no data
    { type: 'step/end', time: fixedNow + 5000 },
    { type: 'assistant/chunk', time: fixedNow + 5500 }, // no data
    { type: 'assistant/chunk', time: fixedNow + 6000, data: { turn: 9, step: 9, chunk: { type: 'finish' } } }, // never opened
    { type: 'assistant/message', time: fixedNow + 7000, data: { turn: 0, step: 0, usage: null, message: null } },
    { type: 'unknown/event', time: fixedNow + 8000, data: { x: 1 } }
  ]
  const r = foldSession(junk) // must not throw
  r.id = 'junk'
  r.cwd = 'D:/u'
  r.projectTitle = 'u'
  const q = queryUsage([r], { range: 'custom', from: fixedNow - 1, to: fixedNow + 9000 }, {})
  assertEq('junk.injected', q.totals.injectedMessages, 1) // user/message without data reads as injected (existing semantics)
  assertEq('junk.assistant', q.totals.assistantMessages, 3)
  assertEq('junk.toolCalls', q.totals.toolCalls, 1)
  assertEq('junk.activeMs', q.totals.activeMs, 0)
  assertEq('junk.cost', q.totals.cost, 0)
  console.log('  malformed events       OK (no throw, sane totals)')
}

console.log('\n[0g] edge-bucket latency stats match the aggregate path')
{
  // actMs is carried on type-2 detail events so a window that cuts through
  // the hour (edge path) reports the same per-model response stats as an
  // hour-aligned window reading the aggregates.
  const H = 3600000
  const hour = fixedNow - (fixedNow % H)
  const stepMsg = (turn, step, start, dur) => ([
    { type: 'step/start', time: start, data: { turn, step } },
    { type: 'assistant/message', time: start + dur, data: { turn, step, usage: { inputTokens: 10, outputTokens: 5 }, message: { source: { model: 'deepseek-chat' } } } }
  ])
  const events = [
    { type: 'user/message', time: hour + 60000, data: { source: { kind: 'user' } } },
    ...stepMsg(0, 0, hour + 61000, 5000),
    ...stepMsg(0, 1, hour + 70000, 6000),
    ...stepMsg(0, 2, hour + 80000, 9000)
  ]
  const r = foldSession(events)
  r.id = 'latency-consistency'
  r.cwd = 'D:/u'
  r.projectTitle = 'u'
  const agg = queryUsage([r], { range: 'custom', from: hour, to: hour + 2 * H }, {})
  const edge = queryUsage([r], { range: 'custom', from: hour, to: hour + 30 * 60000 }, {})
  const am = agg.meta.models.find((m) => m.id === 'deepseek-chat')
  const em = edge.meta.models.find((m) => m.id === 'deepseek-chat')
  if (!am || !em) throw new Error('latency model row missing')
  assertEq('latency.calls.agree', em.calls, am.calls)
  assertEq('latency.avg.agree', em.avgResponseMs, am.avgResponseMs, 1e-6)
  assertEq('latency.p50.agree', em.p50ResponseMs, am.p50ResponseMs)
  assertEq('latency.p95.agree', em.p95ResponseMs, am.p95ResponseMs)
  assertEq('latency.avg.value', am.avgResponseMs, 20000 / 3, 1e-6)
  console.log('  latency edge/aggregate OK (avg=' + am.avgResponseMs.toFixed(1) + 'ms on both paths)')
}

console.log('\n[0] totalMs union semantics (parallel sessions counted once)')
{
  const H = 3600000
  const todayMidnight = bucketKey(Date.now(), 'day')
  const mk = (id, ts) => {
    const events = []
    let turn = 0
    for (const t of ts) {
      events.push({ type: 'user/message', time: t, data: { source: { kind: 'user' } } })
      events.push({ type: 'assistant/message', time: t, data: { turn, step: 0, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } })
      turn += 1
    }
    const r = foldSession(events)
    r.id = id
    r.cwd = 'D:/u'
    r.projectTitle = 'u'
    return r
  }
  const unrolls = [
    mk('A', [todayMidnight, todayMidnight + 0.5 * H, todayMidnight + H, todayMidnight + 1.5 * H, todayMidnight + 2 * H, todayMidnight + 2.5 * H]), // 00:00–02:30
    mk('B', [todayMidnight + H, todayMidnight + 1.5 * H, todayMidnight + 2 * H, todayMidnight + 2.5 * H]), // 01:00–02:30, inside A
    mk('C', [todayMidnight + 5 * H, todayMidnight + 5.5 * H]), // 05:00–05:30, gap after A
    mk('D', [todayMidnight - 2 * H, todayMidnight - H, todayMidnight, todayMidnight + 0.5 * H]) // yesterday 22:00 → today 00:30 (cross-day)
  ]
  const q = queryUsage(unrolls, { range: 'custom', from: todayMidnight, to: todayMidnight + 8 * H }, {})
  // naive sum would be 2.5 + 1.5 + 0.5 + 0.5 = 5h; union = A∪B∪D∩today (2.5h) + C (0.5h) → 3h
  assertEq('totalMs.union', q.totals.totalMs, 3 * H)
  assertEq('totalMs.sessions', q.totals.sessions, 4)
  const byLabel = {}
  for (const b of q.buckets) byLabel[b.label] = b
  assertEq('bucket[00].totalMs', byLabel['00'].totalMs, 0.5 * H)
  assertEq('bucket[01].totalMs', byLabel['01'].totalMs, 0.5 * H)
  assertEq('bucket[02].totalMs', byLabel['02'].totalMs, 0.5 * H)
  assertEq('bucket[05].totalMs', byLabel['05'].totalMs, 0.5 * H)
  // a trailing step/start (interrupted generation) must NOT extend the span
  const tail = foldSession([
    { type: 'user/message', time: todayMidnight, data: { source: { kind: 'user' } } },
    { type: 'assistant/message', time: todayMidnight, data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } },
    { type: 'step/start', time: todayMidnight + 30 * 60000, data: { turn: 1, step: 0 } }
  ])
  assertEq('firstLast.stepTailExcluded', tail.last, todayMidnight)
  console.log('  totalMs union           OK (5h sum → 3h union, cross-day clipped, step tail excluded)')
}

console.log('\n[3] incremental fold equivalence (foldAppend == foldSession)')
{
  let checked = 0
  for (const s of sessions.slice(0, 12)) {
    const evs = s.events
    const full = foldSession(evs)
    for (const split of [1, 3, 7]) {
      const k = Math.max(1, Math.floor(evs.length * split / 10))
      const inc = foldSession(evs.slice(0, k))
      for (let i = k; i < evs.length; i++) foldAppend(inc, evs[i])
      const eq = (a, b) => { if (a !== b) throw new Error('inc-fold mismatch: ' + a + ' != ' + b) }
      eq(full.first, inc.first)
      eq(full.last, inc.last)
      eq(full.buckets.size, inc.buckets.size)
      for (const [hk, b] of full.buckets) {
        const ib = inc.buckets.get(hk)
        if (!ib) throw new Error('inc-fold missing bucket ' + hk)
        eq(JSON.stringify(b.msg), JSON.stringify(ib.msg))
        eq(b.durGap, ib.durGap)
        eq(b.activeMs, ib.activeMs)
        eq(b.first, ib.first)
        eq(b.last, ib.last)
        eq(b.evts.length, ib.evts.length)
        for (let i = 0; i < b.evts.length; i++) {
          eq(b.evts[i].length, ib.evts[i].length)
          for (let j = 0; j < b.evts[i].length; j++) eq(b.evts[i][j], ib.evts[i][j])
        }
        eq(b.per.size, ib.per.size)
        for (const [model, per] of b.per) {
          const ip = ib.per.get(model)
          if (!ip) throw new Error('inc-fold missing model ' + model)
          // per arrays may contain histogram objects (index 10) that are
          // structurally identical but not reference-equal; compare via JSON.
          eq(JSON.stringify(per), JSON.stringify(ip))
        }
      }
      eq(full.modelMeta.size, inc.modelMeta.size)
      checked++
    }
  }
  console.log('  incremental fold         OK (' + checked + ' split cases, byte-identical rollups)')
}

console.log('\n[1] correctness (field-level, 1e-9 tolerance)')
// Use fixedSessions / fixedRollups (before DS_PEAK_SINCE) so that priceForAt
// falls back to priceFor (static CSV pricing), making costs match between the
// v0.2 engine and the v0.1 legacy algorithm. The peak-val pricing semantics are
// verified separately in [4].
for (const { name, req } of REQS) {
  const l = legacyUsage(fixedSessions, req)
  const n = queryUsage(fixedRollups, req, {})
  assertUsageMeaningful('usage:' + name, req, n)
  compareUsage('usage:' + name, l, n)
  console.log('  usage:' + name.padEnd(12) + ' OK')
}
{
  // Detail comparison using fixedSessions / fixedRollups (before threshold,
  // so priceForAt uses CSV pricing and costs match the legacy algorithm).
  const l = legacyDetail(fixedSessions, { range: '30d', now: fixedNow })
  const n = queryDetail(fixedRollups, { range: '30d', now: fixedNow, limit: 200 })
  compareDetail('detail:30d', l, n)
  console.log('  detail:30d              OK')
  const l2 = legacyDetail(fixedSessions, { range: '7d', now: fixedNow, models: ['gpt-5', 'deepseek-chat'] })
  const n2 = queryDetail(fixedRollups, { range: '7d', now: fixedNow, models: ['gpt-5', 'deepseek-chat'], limit: 200 })
  compareDetail('detail:7d+model', l2, n2)
  console.log('  detail:7d+model         OK')
  const l3 = legacyDetail(fixedSessions, { range: 'today', now: fixedNow })
  const n3 = queryDetail(fixedRollups, { range: 'today', now: fixedNow, limit: 200 })
  compareDetail('detail:today', l3, n3)
  console.log('  detail:today            OK')
}
// Calendar comparison using fixedSessions / fixedRollups (before threshold)
// so that end timestamps are consistent. The current-now semantics are verified
// separately in [4].
{
  const calendarNow = fixedNow
  const l = legacyCalendar(fixedSessions, { now: calendarNow })
  const n = queryCalendar(fixedRollups, { now: calendarNow })
  compareCalendar('calendar', l, n)
  console.log('  calendar                OK')
  const l2 = legacyCalendar(fixedSessions, {
    models: ['deepseek-v4-flash'],
    now: calendarNow
  })
  const n2 = queryCalendar(fixedRollups, { models: ['deepseek-v4-flash'], now: calendarNow })
  compareCalendar('calendar+model', l2, n2)
  console.log('  calendar+model          OK')
}

console.log('\n[2] performance (sessions=' + SESSIONS + ', events=' + totalEvents + ')')
// legacy full scan (both windows)
time('legacy usage 7d (cur+prev full scan)', () => legacyUsage(sessions, { range: '7d' }))
// new: fold once (cold) — the only disk-bound phase, amortized across all queries
time('new fold all sessions (cold)', () => {
  for (const s of sessions) foldSession(s.events)
  return null
})
// new: repeated queries from materialized rollups
let qms = 0
for (let i = 0; i < REPEAT; i++) {
  const t0 = process.hrtime.bigint()
  queryUsage(rollups, { range: '7d' }, {})
  const t1 = process.hrtime.bigint()
  qms += Number(t1 - t0) / 1e6
}
console.log('  new queryUsage 7d (avg of ' + REPEAT + ' runs)'.padEnd(44) + (qms / REPEAT).toFixed(3).padStart(10) + ' ms')

// incremental: touch K sessions → new engine folds only the delta
const K = 10
const touched = new Set()
for (let i = 0; i < K; i++) touched.add(sessions[i].id)
const t0 = process.hrtime.bigint()
for (const s of sessions) {
  if (touched.has(s.id)) foldSession(s.events)
}
const t1 = process.hrtime.bigint()
console.log('  new incremental refold (' + K + ' changed)'.padEnd(44) + ((Number(t1 - t0) / 1e6)).toFixed(2).padStart(10) + ' ms')
console.log('  legacy would rescan all ' + SESSIONS + ' sessions on every refresh')

console.log('\n[4] DeepSeek 峰谷定价（现行两型号：deepseek-flash / deepseek-v4-pro）')
{
  // 北京时间构造函数：月/日/时 → UTC。星期：2026-08-17 周一、08-22 周六。
  const bj8 = (d, h, m = 0) => Date.UTC(2026, 7, d, h - 8, m)   // 8 月（legacy 价）
  const bj9 = (d, h, m = 0) => Date.UTC(2026, 8, d, h - 8, m)   // 9 月（V4.1 Flash 新价）
  const flash = 'deepseek-flash'
  const pro = 'deepseek-v4-pro'
  // legacy（V4.1 Flash 新价生效前）
  const oldFlashPeak = [3.0, 9.0, 0.10], oldFlashOff = [1.5, 4.5, 0.05]
  const oldProPeak = [9.0, 27.0, 0.30], oldProOff = [4.5, 13.5, 0.15]
  // v41（2026-09-10 12:00 起）
  const newPeak = [2.0, 8.0, 0.04], newOff = [1.0, 4.0, 0.02]
  const cases = [
    // ---- 生效前（2026-08-17 周一）：feish 旧价 / pro 自身价 ----
    [flash, bj8(17, 10), oldFlashPeak, flash],
    [flash, bj8(17, 13), oldFlashOff, flash],
    [pro, bj8(17, 10), oldProPeak, pro],
    [pro, bj8(17, 13), oldProOff, pro],
    // 峰谷边界：12:00/18:00 高峰结束；8:59、13:59 空闲；19:00 空闲
    [flash, bj8(17, 11, 59), oldFlashPeak, flash],
    [flash, bj8(17, 12), oldFlashOff, flash],
    [flash, bj8(17, 14), oldFlashPeak, flash],
    [flash, bj8(17, 17, 59), oldFlashPeak, flash],
    [flash, bj8(17, 18), oldFlashOff, flash],
    [flash, bj8(17, 8, 59), oldFlashOff, flash],
    [flash, bj8(17, 0), oldFlashOff, flash],
    // 周末全天空闲（08-22 周六 10:00 本是高峰时段）
    [flash, bj8(22, 10), oldFlashOff, flash],
    // ---- 比生效日更早（2026-08-16 23:00）：仍按 CSV 静态价 ----
    [flash, bj8(16, 23), priceFor('deepseek-v4-flash').p, 'deepseek-v4-flash'],
    [pro, bj8(16, 23), priceFor('deepseek-v4-pro').p, 'deepseek-v4-pro'],
    // ---- V4.1 Flash 新价生效后（2026-09-10 12:00 起），周一 09-14 ----
    [flash, bj9(14, 10), newPeak, flash],
    [flash, bj9(14, 13), newOff, flash],
    [flash, bj9(14, 15), newPeak, flash],
    [flash, bj9(14, 19), newOff, flash],
    // 生效瞬间前 1ms 仍是 legacy 价，生效后恰好 12:00 是新价
    [flash, bj9(10, 11, 59) + 999, oldFlashPeak, flash],
    [flash, bj9(10, 12), newOff, flash],
    // Pro 在 09-14 12:00 前仍按自身价目（空闲 4.5/13.5/0.15）
    [pro, bj9(10, 13), oldProOff, pro],
    [pro, bj9(14, 11, 59), oldProPeak, pro],
    // Pro 路由到 Flash 后：按 Flash 计费（周一 09-14 15:00 高峰）
    [pro, bj9(14, 15), newPeak, pro],
    [pro, bj9(14, 19), newOff, pro],
    // ---- 旧名与第三方变体名：一律路由到 V4.1 Flash 并按 Flash 计费 ----
    ['deepseek-v4-flash', bj9(14, 10), newPeak, 'deepseek-v4-flash'],
    ['deepseek-v4-flash-vision-exp', bj9(14, 10), newPeak, 'deepseek-v4-flash-vision-exp'],
    ['deepseek-ai/DeepSeek-V4-Flash-0731', bj9(14, 10), newPeak, 'deepseek-ai/DeepSeek-V4-Flash-0731'],
    ['deepseek/deepseek-v4-pro', bj9(14, 15), newPeak, 'deepseek/deepseek-v4-pro'],
    ['deepseek-v4.1-flash', bj9(14, 10), newPeak, 'deepseek-v4.1-flash'],
    ['deepseek-v4-pro-0813', bj9(14, 15), newPeak, 'deepseek-v4-pro-0813'],
    // Pro 变体名在路由生效前（09-14 10:00）仍按 Pro 自身价
    ['deepseek/deepseek-v4-pro', bj9(14, 10), oldProPeak, 'deepseek/deepseek-v4-pro'],
    // 非 DeepSeek 模型不受影响
    ['gpt-5', bj8(17, 10), priceFor('gpt-5').p, 'gpt-5']
  ]
  for (const [model, t, expect, matched] of cases) {
    const r = priceForAt(model, t)
    if (!r || r.matched !== matched) throw new Error('peak matched: ' + model + ' @ ' + t + ' -> ' + JSON.stringify(r))
    for (let i = 0; i < 3; i++) assertEq('peak ' + model + ' @' + t + ' p[' + i + ']', r.p[i], expect[i], 1e-9)
  }
  // 峰谷标记与区间价随行返回
  const pk = priceForAt(flash, bj9(14, 10))
  if (!pk.ds || pk.peak[0] !== 2.0 || pk.off[0] !== 1.0) throw new Error('peak flag/range missing: ' + JSON.stringify(pk))
  // 规范名归类：两型号名 + 变体名都能归一，无关模型为 null
  const canon = [
    ['deepseek-flash', flash], ['deepseek-v4.1-flash', flash],
    ['deepseek-ai/DeepSeek-V4-Flash-0731', flash], ['deepseek-v4-flash-vision-exp', flash],
    ['deepseek-v4-pro', pro], ['deepseek-v4-pro-0813', pro], ['deepseek/deepseek-v4-pro', pro],
    ['gpt-5', null], ['deepseek-chat', null], ['deepseek-v3.2', null], ['', null]
  ]
  for (const [id, want] of canon) {
    const got = resolveDSModel(id)
    if (got !== want) throw new Error('resolveDSModel(' + id + ') = ' + got + ', want ' + want)
  }
  // 折叠计费与手工验算一致：V4.1 Flash 高峰 1M 输入 + 1M 输出 + 1M 缓存读取 = 2 + 8 + 0.04
  const evts = [
    { type: 'user/message', time: bj9(14, 10), data: { source: { kind: 'user' } } },
    { type: 'assistant/message', time: bj9(14, 10), data: { turn: 0, step: 0, usage: { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 1e6, cacheWriteTokens: 0 }, message: { source: { model: flash } } } }
  ]
  const roll = foldSession(evts)
  const u = queryUsage([roll], { range: 'custom', from: bj9(14, 0), to: bj9(14, 23) }, {})
  assertEq('peak fold cost', u.totals.cost, (2.0 + 8.0 + 0.04), 1e-9)
  // 已下线的旧名同样计费（此前为 ¥0 的回归点）
  const rollOld = foldSession([
    { type: 'user/message', time: bj9(14, 10), data: { source: { kind: 'user' } } },
    { type: 'assistant/message', time: bj9(14, 10), data: { turn: 0, step: 0, usage: { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } }
  ])
  const uOld = queryUsage([rollOld], { range: 'custom', from: bj9(14, 0), to: bj9(14, 23) }, {})
  assertEq('retired name still billed', uOld.totals.cost, 2.0, 1e-9)
  // 厂商分组：现行两型号与第三方变体名归到 DeepSeek（CSV 中已无这些行）
  const vRoll = foldSession([
    { type: 'assistant/message', time: bj9(14, 15), data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: flash } } } },
    { type: 'assistant/message', time: bj9(14, 15), data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-ai/DeepSeek-V4-Flash-0731' } } } },
    { type: 'assistant/message', time: bj9(14, 15), data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'some-unknown-model' } } } }
  ])
  vRoll.id = 'v'; vRoll.cwd = 'D:/v'; vRoll.projectTitle = 'v'
  const uV = queryUsage([vRoll], { range: 'custom', from: bj9(14, 0), to: bj9(14, 23) }, {})
  const vv = uV.meta.vendors
  if (vv[flash] !== 'DeepSeek') throw new Error('vendor(deepseek-flash) = ' + vv[flash])
  if (vv['deepseek-ai/DeepSeek-V4-Flash-0731'] !== 'DeepSeek') throw new Error('vendor(variant) = ' + vv['deepseek-ai/DeepSeek-V4-Flash-0731'])
  if (vv['some-unknown-model'] !== '其他') throw new Error('vendor(unknown) = ' + vv['some-unknown-model'])
  console.log('  峰谷取价/边界/生效日/变体名归一/厂商分组/折叠计费 OK (' + cases.length + ' cases)')
}

console.log('\nall checks passed ✔')
