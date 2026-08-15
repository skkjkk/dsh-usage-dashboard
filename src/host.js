// dsh-usage-dashboard — host half (glue layer).
//
// v0.3 performance architecture (event-driven rollups):
//   * Pure aggregation lives in ./core/rollup.js (foldSession / foldAppend /
//     queryUsage / queryDetail / queryCalendar) — no ctx, no IO.
//   * This layer keeps per-session ROLLUPS fresh in memory and NEVER
//     re-parses full session logs on refresh:
//       - init(): lists sessions once; live sessions load their events
//         directly from the in-memory Session object (zero parse); persisted
//         sessions are read via persistence.readFrom once.
//       - ctx.on('session/event') streams every new event into the matching
//         rollup via foldAppend (µs per event) — no disk reads at all while
//         DSH runs.
//       - a 60s reconcile timer loads newly created sessions and drops
//         removed ones.
//   * Request-level cache (5 min TTL + stale-while-revalidate, single-flight)
//     still guards repeated identical queries.
//   * Result: after boot, every dashboard view (any range / filter) is served
//     from memory in milliseconds; the only slow phase is the one-time cold
//     load, warmed right after startup.

import { foldSession, foldAppend, emptyRollup, queryUsage, queryDetail, queryCalendar, sessionTitle } from './core/rollup.js'

export function apply(ctx, config) {
  const TTL = 5 * 60 * 1000
  const MAX_SESSIONS = 500
  const RECONCILE_MS = 60000

  // request-level response cache: key → { at, data }
  const cache = new Map()
  // session rollup state: session id → { rollup, cwd, title, at, pending[] }
  const states = new Map()
  let ready = false
  let initPromise = null
  const inflight = new Map() // cache key → Promise

  // ---------- helpers ----------
  function pathTitles() {
    const pathTitle = new Map()
    try {
      const wr = ctx.get('workspaceRegistry')
      if (wr) for (const w of wr.list()) pathTitle.set(w.path, w.title)
    } catch (e) { /* ignore */ }
    return pathTitle
  }

  function ensureState(id, header) {
    let st = states.get(id)
    if (!st) {
      st = { rollup: emptyRollup(), cwd: (header && header.cwd) || '', title: null, at: Date.now(), pending: null }
      states.set(id, st)
    }
    return st
  }

  function annotate(st, rec, pathTitle) {
    st.cwd = rec.header.cwd || ''
    st.title = sessionTitle(rec, pathTitle)
    const base = (st.cwd || '').split(/[\\/]/).filter(Boolean).pop() || ''
    st.rollup.id = rec.header.id
    st.rollup.cwd = st.cwd
    st.rollup.title = st.title
    st.rollup.projectTitle = pathTitle.get(st.cwd) || base || '未分组'
  }

  // Load one session's FULL history once: live sessions come from the
  // in-memory Session object (no parse); others via persistence.readFrom.
  async function loadSession(rec) {
    const id = rec.header.id
    const st = ensureState(id, rec.header)
    let events = null
    try {
      const sessions = ctx.get('sessions')
      const live = sessions && sessions.get(id)
      if (live && live.events && live.events.length) events = live.events
    } catch (e) { /* fall through to persistence */ }
    if (!events) {
      try {
        const persist = ctx.get('sessionPersistence')
        const read = await persist.readFrom(id, 0)
        events = read && read.events ? read.events : null
      } catch (e) { events = null }
    }
    if (!events || events.length === 0) return
    const rollup = foldSession(events)
    st.rollup = rollup
    st.at = Date.now()
    // events that streamed in while the catch-up read was in flight
    if (st.pending && st.pending.length) {
      const lastSeq = events[events.length - 1] && typeof events[events.length - 1].seq === 'number' ? events[events.length - 1].seq : -1
      for (const ev of st.pending) {
        if (typeof ev.seq === 'number' && ev.seq <= lastSeq) continue
        foldAppend(rollup, ev)
      }
      st.pending = null
    }
  }

  async function init() {
    const q = ctx.get('sessionQuery')
    if (q === undefined) { ready = true; return }
    const pathTitle = pathTitles()
    let recs = []
    try { recs = await q.listSessions() } catch (e) { recs = [] }
    let cursor = 0
    async function worker() {
      while (cursor < recs.length) {
        const rec = recs[cursor++]
        try { await loadSession(rec) } catch (e) { /* skip failed session */ }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker))
    for (const rec of recs) {
      const st = states.get(rec.header.id)
      if (st) { try { annotate(st, rec, pathTitle) } catch (e) { /* ignore */ } }
    }
    ready = true
  }

  function listRollups() {
    return Array.from(states.values())
      .map((s) => s.rollup)
      .filter((r) => r.last !== null)
      .sort((a, b) => (b.last || 0) - (a.last || 0))
      .slice(0, MAX_SESSIONS)
  }

  function getRollups() {
    if (!ready) {
      if (!initPromise) initPromise = init().catch(() => {}).finally(() => { initPromise = null; ready = true })
      return initPromise.then(listRollups)
    }
    return Promise.resolve(listRollups())
  }

  // ---------- event-driven incremental updates ----------
  // Every new session event streams straight into the matching rollup:
  // no disk reads, no full-log re-parses, always fresh.
  ctx.on('session/event', (session, event) => {
    const id = session && (session.id || (session.header && session.header.id))
    if (!id || !event || typeof event.time !== 'number') return
    const st = states.get(id)
    if (st && st.pending === null) {
      foldAppend(st.rollup, event)
      st.at = Date.now()
    } else if (st) {
      // history still loading — buffer and merge after the catch-up read
      st.pending.push(event)
    } else {
      // brand-new session: buffer, then catch up its history once
      const ns = ensureState(id, (session && session.header) || {})
      ns.pending = [event]
      try {
        ctx.get('sessionPersistence').readFrom(id, 0).then((read) => {
          if (!read || !read.events || !read.events.length) return
          const rollup = foldSession(read.events)
          const lastSeq = read.events[read.events.length - 1] && typeof read.events[read.events.length - 1].seq === 'number' ? read.events[read.events.length - 1].seq : -1
          const pending = ns.pending || []
          ns.pending = null
          for (const ev of pending) {
            if (typeof ev.seq === 'number' && ev.seq <= lastSeq) continue
            foldAppend(rollup, ev)
          }
          ns.rollup = rollup
          ns.at = Date.now()
          ns.cwd = (read.meta && read.meta.cwd) || ns.cwd
        }).catch(() => { ns.pending = null })
      } catch (e) { ns.pending = null }
    }
  })

  // reconcile: load newly created sessions, drop removed ones
  const timer = ctx.get('timer')
  if (timer) {
    ctx.effect(() => timer.setInterval(async () => {
      const q = ctx.get('sessionQuery')
      if (!q || !ready) return
      let recs = []
      try { recs = await q.listSessions() } catch (e) { return }
      const seen = new Set(recs.map((r) => r.header.id))
      for (const id of Array.from(states.keys())) {
        if (!seen.has(id)) states.delete(id)
      }
      let cursor = 0
      async function worker() {
        while (cursor < recs.length) {
          const rec = recs[cursor++]
          const st = states.get(rec.header.id)
          if (!st || st.rollup.last === null) {
            try { await loadSession(rec) } catch (e) { /* skip */ }
          }
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker))
    }, RECONCILE_MS), 'usage-dashboard: reconcile')
  }

  // pre-warm the cold load right after startup: first open is instant
  if (timer) {
    ctx.effect(() => timer.timeout(() => { getRollups().catch(() => {}) }, 500), 'usage-dashboard: prewarm')
  }

  // ---------- single-flight request helpers ----------
  async function cached(key, compute) {
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && now - hit.at < TTL) return hit.data
    if (hit) {
      // stale-while-revalidate: serve stale, refresh in background (single-flight)
      if (!inflight.has(key)) {
        inflight.set(key, compute().then((data) => {
          cache.set(key, { at: Date.now(), data })
          return data
        }).catch(() => null).finally(() => inflight.delete(key)))
      }
      return hit.data
    }
    if (inflight.has(key)) return inflight.get(key)
    const p = compute().then((data) => {
      cache.set(key, { at: now, data })
      return data
    })
    inflight.set(key, p)
    try {
      return await p
    } finally {
      inflight.delete(key)
    }
  }

  // ---------- endpoints ----------
  harness.handle('usage', (args) => cached(JSON.stringify({
    range: args.range || 'today', from: args.from || null, to: args.to || null,
    models: args.models || null, projects: args.projects || null
  }), async () => {
    const rollups = await getRollups()
    return queryUsage(rollups, args || {}, { pathTitle: pathTitles() })
  }))

  harness.handle('detail', (args) => cached(JSON.stringify({
    range: args.range || 'today', from: args.from || null, to: args.to || null,
    models: args.models || null, projects: args.projects || null,
    offset: Math.max(0, Number(args.offset) || 0), limit: Math.min(200, Math.max(1, Number(args.limit) || 100))
  }), async () => {
    const rollups = await getRollups()
    return queryDetail(rollups, args || {})
  }))

  harness.handle('calendar', (args) => cached(JSON.stringify({
    models: args.models || null, projects: args.projects || null
  }), async () => {
    const rollups = await getRollups()
    return queryCalendar(rollups, args || {})
  }))
}