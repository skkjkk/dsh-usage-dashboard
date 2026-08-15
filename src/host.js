// dsh-usage-dashboard — host half (glue layer).
//
// v0.2 performance architecture:
//   * Pure aggregation lives in ./core/rollup.js (foldSession / queryUsage /
//     queryDetail / queryCalendar) — no ctx, no IO, fully testable.
//   * This layer owns I/O and caching:
//       - getRollups(): lists sessions via persistence.listSnapshots() which
//         returns a cheap stat-derived REVISION per session; only sessions
//         whose revision changed (or that are new) are re-read and re-folded.
//         All other requests aggregate in memory from cached rollups.
//       - request-level cache (5 min TTL + stale-while-revalidate) with
//         single-flight aggregation per key.
//   * Result: after the first fold, every dashboard view (usage / detail /
//     calendar, any range / filter) is served from memory in milliseconds.

import { foldSession, queryUsage, queryDetail, queryCalendar, sessionTitle } from './core/rollup.js'

export function apply(ctx, config) {
  const TTL = 5 * 60 * 1000
  const MAX_SESSIONS = 500
  const CONCURRENCY = 8

  // request-level response cache: key → { at, data }
  const cache = new Map()
  // session rollup cache: session id → { rev, rollup, at }
  const rollupCache = new Map()
  // in-flight single-flight handles
  let rollupsPromise = null
  const inflight = new Map() // cache key → Promise

  // ---------- load: revision-delta rollup materialization ----------
  function pathTitles() {
    const pathTitle = new Map()
    try {
      const wr = ctx.get('workspaceRegistry')
      if (wr) for (const w of wr.list()) pathTitle.set(w.path, w.title)
    } catch (e) { /* ignore */ }
    return pathTitle
  }

  async function getRollups() {
    if (rollupsPromise) return rollupsPromise
    rollupsPromise = (async () => {
      const persist = ctx.get('sessionPersistence')
      const q = ctx.get('sessionQuery')
      if (q === undefined) return []
      const pathTitle = pathTitles()
      let snapshots = []
      if (persist) {
        try { snapshots = await persist.listSnapshots() } catch (e) { snapshots = [] }
      }
      let records = []
      try { records = await q.listSessions() } catch (e) { records = [] }
      const snapById = new Map(snapshots.map((s) => [s.header.id, s]))

      const toBuild = []
      const seen = new Set()
      for (const rec of records) {
        const id = rec.header.id
        if (seen.has(id)) continue
        seen.add(id)
        const snap = snapById.get(id)
        const rev = snap ? snap.revision : null
        const hit = rollupCache.get(id)
        if (hit && hit.rev === rev) continue
        toBuild.push({ rec, rev })
      }

      let cursor = 0
      async function worker() {
        while (cursor < toBuild.length) {
          const idx = cursor++
          const { rec, rev } = toBuild[idx]
          try {
            let events = null
            if (persist) {
              try {
                const read = await persist.readFrom(rec.header.id, 0)
                events = read && read.events ? read.events : null
              } catch (e) { events = null }
            }
            if (!events) {
              const snap = await q.readSession(rec.header.id)
              events = snap.events
            }
            if (!events || events.length === 0) continue
            const rollup = foldSession(events)
            rollup.id = rec.header.id
            rollup.cwd = rec.header.cwd || ''
            rollup.title = sessionTitle(rec, pathTitle)
            const base = (rollup.cwd || '').split(/[\\/]/).filter(Boolean).pop() || ''
            rollup.projectTitle = pathTitle.get(rollup.cwd) || base || '未分组'
            rollup.rev = rev
            rollupCache.set(rec.header.id, { rev, rollup, at: Date.now() })
          } catch (e) { /* skip failed session */ }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))

      // evict oldest beyond capacity
      if (rollupCache.size > MAX_SESSIONS * 1.5) {
        const entries = Array.from(rollupCache.entries()).sort((a, b) => a[1].at - b[1].at)
        for (let i = 0; i < entries.length - MAX_SESSIONS; i++) rollupCache.delete(entries[i][0])
      }

      return Array.from(rollupCache.values())
        .map((e) => e.rollup)
        .filter((r) => r.last !== null)
        .sort((a, b) => (b.last || 0) - (a.last || 0))
        .slice(0, MAX_SESSIONS)
    })().finally(() => { rollupsPromise = null })
    return rollupsPromise
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

  // pre-warm the default view shortly after startup: first open is instant
  const timer = ctx.get('timer')
  if (timer) {
    ctx.effect(() => timer.timeout(() => {
      getRollups().then((rollups) => {
        const data = queryUsage(rollups, { range: 'today' }, { pathTitle: pathTitles() })
        cache.set(JSON.stringify({ range: 'today', from: null, to: null, models: null, projects: null }), { at: Date.now(), data })
      }).catch(() => {})
    }, 1500))
  }
}
