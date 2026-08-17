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
    if (!st) {
      st = { rollup: emptyRollup(), cwd: (header && header.cwd) || '', title: null, at: Date.now(), pending: [], needsReload: false, loadingPromise: null }
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
    let readError = false

    try {
      const sessions = ctx.get('sessions')
      const live = sessions && sessions.get(id)
      if (live && live.events && live.events.length) events = live.events
    } catch (e) { /* fall through to persistence */ }

    if (!events) {
      let attempted = false
      try {
        const persist = ctx.get('sessionPersistence')
        if (persist && typeof persist.readFrom === 'function') {
          attempted = true
          const read = await persist.readFrom(id, 0)
          events = read && read.events ? read.events : null
        }
      } catch (e) { /* try the query service below */ }
      if (!events) {
        try {
          const q = ctx.get('sessionQuery')
          if (q && typeof q.readSession === 'function') {
            attempted = true
            const snap = await q.readSession(id)
            events = snap && snap.events ? snap.events : null
          }
        } catch (e) { /* preserve the existing rollup and retry later */ }
      }
      readError = attempted && !events
    }

    if (readError) {
        // readFrom threw: fold current pending into current rollup, clear pending,
        // set needsReload=true, finally loading=false
        if (st.pending && st.pending.length) {
          for (const ev of st.pending) {
            foldAppend(st.rollup, ev)
          }
          st.pending = []
        }
        st.needsReload = true
        invalidate()
        return
      }

      // Preserve existing rollup when readFrom returns empty; do not re-initialize
      const rollup = st.rollup || emptyRollup()
      st.rollup = rollup

      // Annotate rollup with cwd/title/projectTitle (uses pathTitles())
      // Must be called after st.rollup assignment to ensure cwd/title/projectTitle are not lost
      annotate(st, rec, workspaceInfo())

      if (!events || events.length === 0) {
        // readFrom returned empty: preserve existing rollup, fold pending events
        // (do not treat as failure / clear retry marker)
        if (st.pending && st.pending.length) {
          for (const ev of st.pending) {
            foldAppend(st.rollup, ev)
          }
        }
        st.pending = []
        st.needsReload = false  // clear needsReload since read was successful (even if empty)
        st.at = Date.now()
        invalidate()
        return
      }

      // Fold full history
      const folded = foldSession(events)
      st.rollup = folded
      annotate(st, rec, workspaceInfo())  // re-annotate after rollup assignment to preserve metadata
      st.at = Date.now()

      // Merge pending events that streamed in during the catch-up read
      // Dedup by history max seq: only append events with seq > maxSeq
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
    cache.clear()
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
      for (const id of Array.from(states.keys())) {
        if (!seen.has(id)) states.delete(id)
      }
      ready = true
      return currentRollups()
    })().finally(() => { initPromise = null })
    return initPromise
  }

  // ---------- event stream ----------

  ctx.on('session/event', (session, event) => {
    const id = session && (session.id || (session.header && session.header.id))
    if (!id || !event || typeof event.time !== 'number') return
    invalidate()
    let st = states.get(id)
    if (!st) {
      // brand-new session: create state and start history load
      st = ensureState(id, (session && session.header) || {})
      st.pending.push(event)
      loadSession({ header: session.header || {id} })
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
      const seen = new Set(recs.map((r) => r.header.id))
      for (const id of Array.from(states.keys())) {
        if (!seen.has(id)) states.delete(id)
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
    if (hit && hit.version !== dataVersion) {
      cache.delete(key)
      hit = null
    }
    // if entry exceeded max failures, drop it and recompute
    if (hit && (hit.failCount || 0) >= CACHE_MAX_FAIL) {
      cache.delete(key)
      hit = null
    }
    // if hit exists and not expired, return it (stale-while-revalidate)
    if (hit && now - hit.at < TTL) {
      return hit.data
    }
    if (hit) {
      // stale-while-revalidate: serve stale data, refresh in background (single-flight)
      if (!inflight.has(key)) {
        const promise = compute().then((data) => {
          // success: store with fresh timestamp, reset failCount
          cache.set(key, { at: Date.now(), data, failCount: 0, version: dataVersion })
          return data
        }).catch((e) => {
          // increment failure count, keep stale data
          const entry = cache.get(key)
          if (entry) {
            cache.set(key, { at: entry.at, data: entry.data, failCount: (entry.failCount || 0) + 1, version: entry.version })
          }
          return null
        })
        // always clean up inflight after promise settles (either way)
        promise.then(() => inflight.delete(key), () => inflight.delete(key))
        inflight.set(key, promise)
      }
      return hit.data
    }
    // no hit at all: compute fresh result
    // first compute failure should NOT cache data:null; instead allow the
    // promise to propagate the error; the caller handles graceful degradation
    if (inflight.has(key)) return inflight.get(key)
    const p = compute().then((data) => {
      // success: store with fresh timestamp, reset failCount
      cache.set(key, { at: Date.now(), data, failCount: 0, version: dataVersion })
      return data
    }).catch((e) => {
      // compute failure: do NOT cache data:null; instead let the caller receive
      // a graceful degradation by re-throwing after cleaning up inflight
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