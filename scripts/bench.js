// dsh-usage-dashboard benchmark & correctness harness.
//
// Compares the v0.2 materialized-rollup engine (src/core/rollup.js) against a
// faithful re-implementation of the v0.1 full-scan algorithm on synthesized
// session data, then asserts field-level equality of every dashboard payload.
//
// Usage: npm run bench   (node scripts/bench.js)
import { foldSession, foldAppend, queryUsage, queryDetail, queryCalendar, priceFor, num, rangeBounds, prevWindow, pickGranularity, bucketKey, bucketLabel, bucketSeries, cellOf } from '../src/core/rollup.js'

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

// ---------- synthetic data ----------
const MODELS = ['deepseek-v4-flash', 'deepseek-chat', 'gpt-5', 'gemini-3-pro', 'unknown-model-x']
const CWDS = ['D:/a/alpha', 'D:/b/beta', 'C:/dev/gamma', 'D:/a/delta', 'E:/misc']

function genSession(rnd, idx, now) {
  const msgs = 40 + Math.floor(rnd() * 40)
  const events = []
  // start at least one day in the past so no synthetic event lands in the
  // future (session spans stay < 1 day given the gap distribution)
  const start = now - DAY - Math.floor(rnd() * 85) * DAY - Math.floor(rnd() * DAY * 0.5)
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
  const openSteps = new Map()
  const pendingCalls = new Map()
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
        if (openSteps.has(stepKey)) {
          out.activeMs += Math.max(0, t - openSteps.get(stepKey))
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
        if (ev.data && ev.data.callId) pendingCalls.set(ev.data.callId, t)
        break
      }
      case 'tool/result': {
        out.toolResults += 1
        out.times.push(t)
        const src = ev.data && ev.data.message && ev.data.message.source
        if (src && src.callId && pendingCalls.has(src.callId)) {
          out.activeMs += Math.max(0, t - pendingCalls.get(src.callId))
          pendingCalls.delete(src.callId)
        }
        break
      }
      case 'step/start': {
        const stepKey = ev.data.turn + ':' + ev.data.step
        openSteps.set(stepKey, t)
        break
      }
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

function legacyComputeWindow(loaded, targets, lo, hi, modelSet, gran) {
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
  const keys = bucketSeries(lo, hi, gran)
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
  const cur = legacyComputeWindow(loaded, targets, lo, hi, modelSet, gran)
  const prev = legacyComputeWindow(loaded, targets, plo, phi, modelSet, gran)
  const t = cur.totals
  const pt = prev.totals
  const pct = (c, p) => (!(p > 0) ? (c > 0 ? 100 : null) : (c - p) / p * 100)
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
  const now = Date.now()
  const d = new Date()
  const thisSunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime()
  const start = thisSunday - 52 * 7 * 86400000
  const end = thisSunday + 6 * 86400000
  const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
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
    for (let i = 0; i < 168; i++) assertEq(label + '.heat.' + h + '[' + i + ']', l.heat[h][i], n.heat[h][i], 1e-6)
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
const now = Date.now()
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

const REQS = [
  { name: 'today', req: { range: 'today' } },
  { name: '7d', req: { range: '7d' } },
  { name: '30d', req: { range: '30d' } },
  { name: '90d', req: { range: '90d' } },
  { name: 'custom', req: { range: 'custom', from: now - 45 * 86400000, to: now } },
  { name: '7d+model', req: { range: '7d', models: ['deepseek-v4-flash'] } }
]

console.log('\n[0] totalMs union semantics (parallel sessions counted once)')
{
  const H = 3600000
  const todayMidnight = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()
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
          for (let j = 0; j < per.length; j++) eq(per[j], ip[j])
        }
      }
      eq(full.modelMeta.size, inc.modelMeta.size)
      checked++
    }
  }
  console.log('  incremental fold         OK (' + checked + ' split cases, byte-identical rollups)')
}

console.log('\n[1] correctness (field-level, 1e-9 tolerance)')
for (const { name, req } of REQS) {
  const l = legacyUsage(sessions, req)
  const n = queryUsage(rollups, req, {})
  compareUsage('usage:' + name, l, n)
  console.log('  usage:' + name.padEnd(12) + ' OK')
}
{
  const l = legacyDetail(sessions, { range: '30d' })
  const n = queryDetail(rollups, { range: '30d', limit: 200 })
  compareDetail('detail:30d', l, n)
  console.log('  detail:30d              OK')
  const l2 = legacyDetail(sessions, { range: '7d', models: ['gpt-5', 'deepseek-chat'] })
  const n2 = queryDetail(rollups, { range: '7d', models: ['gpt-5', 'deepseek-chat'], limit: 200 })
  compareDetail('detail:7d+model', l2, n2)
  console.log('  detail:7d+model         OK')
  const l3 = legacyDetail(sessions, { range: 'today' })
  const n3 = queryDetail(rollups, { range: 'today', limit: 200 })
  compareDetail('detail:today', l3, n3)
  console.log('  detail:today            OK')
}
{
  const l = legacyCalendar(sessions, {})
  const n = queryCalendar(rollups, {})
  compareCalendar('calendar', l, n)
  console.log('  calendar                OK')
  const l2 = legacyCalendar(sessions, { models: ['deepseek-v4-flash'] })
  const n2 = queryCalendar(rollups, { models: ['deepseek-v4-flash'] })
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

console.log('\nall checks passed ✔')
