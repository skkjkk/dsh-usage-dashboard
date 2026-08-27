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
  const TTL = 30 * 1000 // 与客户端 30s 轮询对齐：查询本身 ~1-2ms，缓存只为并发去重，不冻结旧数据
  const RECONCILE_MS = 60000
  const FAST_FILE_BYTES = 1024 * 1024 // 冷启动快批次阈值：活跃会话 + ≤1MB 文件先加载

  // request-level response cache: key → { at, data, failCount }
  const cache = new Map()
  let dataVersion = 0
  const CACHE_MAX_FAIL = 3
  const CACHE_STALE_MULTIPLIER = 2 // 清理阈值：TTL * 2
  // session rollup state: session id → { rollup, cwd, title, at, pending[], needsReload }
  const states = new Map()
  let ready = false
  let initPromise = null
  const inflight = new Map() // cache key → Promise

  // ---------- helpers ----------

  function normalizePath(value) {
    let s = String(value || '').trim().replace(/\\/g, '/')
    while (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
    // Windows paths are case-insensitive; keeping one spelling prevents
    // workspace/session aliases from becoming separate project rows.
    if (/^[a-z]:\//i.test(s)) s = s.toLowerCase()
    return s
  }

  function workspaceInfo() {
    const pathTitle = new Map()
    const sessionProject = new Map()
    try {
      const wr = ctx.get('workspaceRegistry')
      if (wr) for (const w of wr.list()) {
        const cwd = normalizePath(w.path)
        if (cwd) pathTitle.set(cwd, w.title)
        for (const id of (w.sessionIds || [])) {
          sessionProject.set(String(id), { cwd, title: w.title })
        }
      }
    } catch (e) { /* ignore */ }
    return { pathTitle, sessionProject }
  }

  function pathTitles() {
    return workspaceInfo().pathTitle
  }

  function ensureState(id, header) {
    let st = states.get(id)
    if (st) st.lastEventAt = Date.now()
    if (!st) {
      st = { rollup: emptyRollup(), cwd: (header && header.cwd) || '', title: null, at: Date.now(), lastEventAt: 0, pending: [], needsReload: false, loading: false, loadingPromise: null }
      states.set(id, st)
    } else {
      if (st.needsReload === undefined) st.needsReload = false
    }
    return st
  }

  function annotate(st, rec, info) {
    const header = rec.header || {}
    const membership = info.sessionProject.get(String(header.id))
    const rawCwd = header.cwd || (membership && membership.cwd) || ''
    st.cwd = normalizePath(rawCwd)
    st.title = sessionTitle(rec, info.pathTitle)
    const base = st.cwd.split('/').filter(Boolean).pop() || ''
    st.rollup.id = header.id
    st.rollup.cwd = st.cwd
    st.rollup.title = st.title
    st.rollup.projectTitle = info.pathTitle.get(st.cwd) || (membership && membership.title) || base || '未分组'
  }

  // Load one session's FULL history once: live sessions come from the
  // in-memory Session object (no parse); others via persistence.readFrom.
  async function loadSession(rec) {
    const id = rec.header.id
    const st = ensureState(id, rec.header)
    if (st.loading) return st.loadingPromise || undefined
    st.loading = true
    const promise = loadSessionBody(rec, st)
    st.loadingPromise = promise
    try {
      return await promise
    } finally {
      st.loading = false
      st.loadingPromise = null
    }
  }

  async function loadSessionBody(rec, st) {
    const id = rec.header.id
    let events = null
    let loaded = false
    let attempted = false

    // A live session is authoritative even when its log is currently empty.
    // Falling through to persistence here can turn a valid new session into a
    // perpetual retry loop before its first flush.
    try {
      const sessions = ctx.get('sessions')
      const live = sessions && sessions.get(id)
      if (live && Array.isArray(live.events)) {
        events = live.events
        loaded = true
      }
    } catch (e) { /* fall through to persistence */ }

    async function readFrom(reader) {
      attempted = true
      const result = await reader()
      if (!result || !Array.isArray(result.events)) throw new Error('session read returned no event list')
      events = result.events
      loaded = true
    }

    if (!loaded) {
      try {
        const persist = ctx.get('sessionPersistence')
        if (persist && typeof persist.readFrom === 'function') {
          await readFrom(() => persist.readFrom(id, 0))
        }
      } catch (e) { /* try the query service below */ }
    }
    if (!loaded) {
      try {
        const q = ctx.get('sessionQuery')
        if (q && typeof q.readSession === 'function') {
          await readFrom(() => q.readSession(id))
        }
      } catch (e) { /* preserve the existing rollup and retry later */ }
    }

    if (!loaded && attempted) {
      // Keep the last known rollup usable while the backend is unavailable.
      // Events observed during the failed read are still incorporated once.
      if (st.pending && st.pending.length) {
        for (const ev of st.pending) foldAppend(st.rollup, ev)
        st.pending = []
      }
      st.needsReload = true
      invalidate()
      return
    }

    // No reader is available: treat this as an empty, successfully loaded
    // session rather than manufacturing a retry storm.
    if (!loaded) {
      events = []
      loaded = true
    }

    const rollup = st.rollup || emptyRollup()
    st.rollup = rollup
    annotate(st, rec, workspaceInfo())

    if (events.length === 0) {
      if (st.pending && st.pending.length) {
        for (const ev of st.pending) foldAppend(st.rollup, ev)
      }
      st.pending = []
      st.needsReload = false
      st.at = Date.now()
      invalidate()
      return
    }

    const folded = foldSession(events)
    st.rollup = folded
    annotate(st, rec, workspaceInfo())
    st.at = Date.now()

    // Merge events streamed during the catch-up read, deduplicated by history seq.
    const maxSeq = events.reduce((max, ev) => {
      if (typeof ev.seq === 'number') return Math.max(max, ev.seq)
      return max
    }, -Infinity)
    if (st.pending && st.pending.length) {
      for (const ev of st.pending) {
        if (typeof ev.seq === 'number' && ev.seq <= maxSeq) continue
        foldAppend(st.rollup, ev)
      }
      st.pending = []
    }

    st.needsReload = false
    invalidate()
  }

  function currentRollups() {
    return Array.from(states.values())
      .map((st) => st.rollup)
      .filter((r) => r && r.last !== null)
      .sort((a, b) => (b.last || 0) - (a.last || 0))
  }

  function invalidate() {
    dataVersion += 1
  }

  // Materialize every known session once, then serve all queries from the
  // event-driven in-memory states. A request can still trigger loading for a
  // session created before the plugin's event listener was attached.
  async function getRollups() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const q = ctx.get('sessionQuery')
      if (!q) {
        ready = true
        return currentRollups()
      }
      let records = []
      try { records = await q.listSessions() } catch (e) {
        return currentRollups()
      }
      if (records.length === 0 && states.size > 0) {
        ready = true
        return currentRollups()
      }
      const seen = new Set()
      const toLoad = []
      for (const rec of records) {
        const header = rec && rec.header
        const id = header && header.id
        if (!id || seen.has(id)) continue
        seen.add(id)
        const st = states.get(id)
        if (!st || st.needsReload || st.rollup.last === null) toLoad.push({ header })
      }
      let cursor = 0
      async function worker() {
        while (cursor < toLoad.length) {
          const rec = toLoad[cursor++]
          try { await loadSession(rec) } catch (e) { /* isolate one bad session */ }
        }
      }
      await Promise.all(Array.from({ length: 4 }, () => worker()))
      const now = Date.now()
      for (const id of Array.from(states.keys())) {
        if (seen.has(id)) continue
        const st = states.get(id)
        if (st.loading || (st.pending && st.pending.length)) continue
        if (st.lastEventAt && now - st.lastEventAt < RECONCILE_MS * 2) continue
        states.delete(id)
      }
      ready = true
      return currentRollups()
    })().finally(() => { initPromise = null })
    return initPromise
  }

  // ---------- event stream ----------

  ctx.on('session/event', (session, event) => {
    // Keep newly observed sessions alive until the corpus index catches up.
    const id = session && (session.id || (session.header && session.header.id))
    if (!id || !event || typeof event.time !== 'number') return
    invalidate()
    let st = states.get(id)
    if (st) st.lastEventAt = Date.now()
    if (!st) {
      // brand-new session: create state and start history load
      st = ensureState(id, (session && session.header) || {})
      st.lastEventAt = Date.now()
      st.pending.push(event)
      loadSession({ header: session.header || { id } })
      return
    }
    if (st.loading) {
      // history still loading — buffer event with seq dedup
      const already = st.pending.find((e) => e && typeof e.seq === 'number' && e.seq === event.seq)
      if (!already) st.pending.push(event)
    } else {
      // history loaded: append directly (no pending)
      foldAppend(st.rollup, event)
      st.at = Date.now()
    }
  })

  // reconcile: load newly created sessions, drop removed ones
  // all states participate in stats; reconcile reloads sessions with needsReload
  // or empty rollup, without truncation cap
  const timer = ctx.get('timer')
  if (timer) {
    ctx.effect(() => timer.setInterval(async () => {
      const q = ctx.get('sessionQuery')
      if (!q || !ready) return
      let recs = []
      try { recs = await q.listSessions() } catch (e) { return }
      if (recs.length === 0 && states.size > 0) return
      const seen = new Set(recs.map((r) => r.header.id))
      const now = Date.now()
      for (const id of Array.from(states.keys())) {
        if (seen.has(id)) continue
        const st = states.get(id)
        if (st.loading || (st.pending && st.pending.length)) continue
        if (st.lastEventAt && now - st.lastEventAt < RECONCILE_MS * 2) continue
        states.delete(id)
      }
      // reload sessions that have needsReload or empty rollup
      // fixed 4 workers, no infinite creation
      const WORKER_COUNT = 4
      let cursor = 0
      async function worker() {
        while (cursor < recs.length) {
          const rec = recs[cursor++]
          const st = states.get(rec.header.id)
          if (!st || st.needsReload || st.rollup.last === null) {
            try { await loadSession(rec) } catch (e) { /* skip failed session */ }
          }
        }
      }
      await Promise.all(Array.from({ length: WORKER_COUNT }, () => worker()))
    }, RECONCILE_MS), 'usage-dashboard: reconcile')
  }

  // pre-warm the cold load right after startup: first open is instant
  if (timer) {
    ctx.effect(() => timer.timeout(() => { getRollups().catch(() => {}) }, 500), 'usage-dashboard: prewarm')
  }

  // ---------- single-flight request helpers ----------

  async function cached(key, compute) {
    const now = Date.now()
    // Clean up entries older than TTL * 2 (but not inflight entries)
    for (const [k, v] of cache.entries()) {
      if (!inflight.has(k) && now - v.at >= TTL * CACHE_STALE_MULTIPLIER) {
        cache.delete(k)
      }
    }
    let hit = cache.get(key)
    const versionStale = !!(hit && hit.version !== dataVersion)
    // if entry exceeded max failures, drop it and recompute
    if (hit && (hit.failCount || 0) >= CACHE_MAX_FAIL) {
      cache.delete(key)
      hit = null
    }
    // Fresh entries from the current data version can return immediately.
    if (hit && !versionStale && now - hit.at < TTL) return hit.data

    if (hit) {
      // Serve the last coherent result while refreshing in the background.
      // A version captured before compute must never overwrite newer data.
      if (!inflight.has(key)) {
        const startVersion = dataVersion
        const promise = compute().then((data) => {
          if (dataVersion === startVersion) {
            cache.set(key, { at: Date.now(), data, failCount: 0, version: startVersion })
          }
          return data
        }).catch((e) => {
          const entry = cache.get(key)
          if (entry) {
            cache.set(key, { at: entry.at, data: entry.data, failCount: (entry.failCount || 0) + 1, version: entry.version })
          }
          return null
        })
        promise.then(() => inflight.delete(key), () => inflight.delete(key))
        inflight.set(key, promise)
      }
      return hit.data
    }

    // No hit at all: compute a fresh result and propagate failures.
    if (inflight.has(key)) return inflight.get(key)
    const startVersion = dataVersion
    const p = compute().then((data) => {
      if (dataVersion === startVersion) {
        cache.set(key, { at: Date.now(), data, failCount: 0, version: startVersion })
      }
      return data
    }).catch((e) => {
      inflight.delete(key)
      throw e
    })
    inflight.set(key, p)
    try {
      return await p
    } finally {
      inflight.delete(key)
    }
  }

  // ---------- harness API endpoints ----------

  harness.handle('usage', (args) => {
    // normalize range to 'today' so cache key and actual query are consistent
    const input = args || {}
    const normalized = { ...input, range: input.range || 'today' }
    return cached(JSON.stringify(normalized), async () => {
      const rollups = await getRollups()
      return queryUsage(rollups, normalized, { pathTitle: pathTitles() })
    })
  })

  harness.handle('detail', (args) => {
    const input = args || {}
    // Construct normalized args: range defaults to today, safely handle undefined
    const normalized = {
      range: input.range || 'today',
      from: input.from != null ? input.from : null,
      to: input.to != null ? input.to : null,
      models: input.models != null ? input.models : null,
      projects: input.projects != null ? input.projects : null,
      offset: Math.max(0, Number(input.offset) || 0),
      limit: Math.min(200, Math.max(1, Number(input.limit) || 100))
    }
    return cached(JSON.stringify(normalized), async () => {
      const rollups = await getRollups()
      return queryDetail(rollups, normalized)
    })
  })

  harness.handle('calendar', (args) => {
    const input = args || {}
    const normalized = {
      models: input.models != null ? input.models : null,
      projects: input.projects != null ? input.projects : null,
      now: typeof input.now === 'number' ? input.now : null
    }
    return cached(JSON.stringify(normalized), async () => {
      const rollups = await getRollups()
      return queryCalendar(rollups, normalized)
    })
  })
}