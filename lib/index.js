// dsh-usage-dashboard — host half (adapted from the src/host.js glue layer).
// Registers three JSON GET routes under /dash-api/* serving usage aggregation
// over the local session store. Aggregation itself lives in ./core/rollup.js.

import { foldSession, foldAppend, emptyRollup, queryUsage, queryDetail, queryCalendar, sessionTitle } from './core/rollup.js'

function parseQueryArgs(url) {
  const u = new URL(url, 'http://dsh.local')
  const args = {}
  for (const [k, v] of u.searchParams) {
    if (k === 'models' || k === 'projects') {
      args[k] = v ? v.split(',').filter(Boolean) : null
    } else if (v === '') {
      args[k] = null
    } else if (k === 'range' || k === 'gran') {
      args[k] = v
    } else {
      const n = Number(v)
      args[k] = Number.isFinite(n) && String(n) === v ? n : v
    }
  }
  return args
}

function registerJsonRoute(ctx, pathname, fn) {
  ctx.effect(() => ctx.get('webServer').register({
    kind: 'exact',
    path: pathname,
    handler: async (req, res) => {
      try {
        const data = await fn(parseQueryArgs(req.url))
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(data))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: String((e && e.message) || e) }))
      }
    }
  }), 'usage-dashboard: ' + pathname)
}

export function apply(ctx, config) {
  // 与 cordis-host-runner 动态插件沙盒同构的桥：handle(method, fn) → GET /dash-api/<method>
  const harness = { handle: (method, fn) => registerJsonRoute(ctx, '/dash-api/' + method, fn) }

  const TTL = 30 * 1000 // 与客户端 30s 轮询对齐：查询本身 ~1-2ms，缓存只为并发去重，不冻结旧数据
  const MAX_SESSIONS = 500
  const RECONCILE_MS = 60000
  const FAST_FILE_BYTES = 1024 * 1024 // 冷启动快批次阈值：活跃会话 + ≤1MB 文件先加载

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
    // 快批次 = 活跃会话（内存事件，零解析）+ 小文件会话；慢批次 = 大文件会话
    // （readFrom 对打包块日志的全量展开很贵：大会话可达 ~30s）。先加载快批次，
    // 首次请求秒级出数；慢批次在后台补载，随后续轮询自动补全。
    let sizeById = new Map()
    try {
      const persist = ctx.get('sessionPersistence')
      const snaps = await persist.listSnapshots()
      // revision token: dev:ino:size:mtimeNs:ctimeNs → size 在第三段
      sizeById = new Map(snaps.map((s) => {
        const parts = String((s && s.revision) || '').split(':')
        return [s && s.header && s.header.id, Number(parts[2]) || 0]
      }))
    } catch (e) { /* no sizes available */ }
    const sessions = ctx.get('sessions')
    const isLive = (id) => { try { return !!(sessions && sessions.get(id)) } catch (e) { return false } }
    const fast = []
    const slow = []
    for (const rec of recs) {
      const id = rec.header.id
      ;(isLive(id) || (sizeById.get(id) || 0) <= FAST_FILE_BYTES ? fast : slow).push(rec)
    }
    const loadAll = async (list) => {
      let cursor = 0
      async function worker() {
        while (cursor < list.length) {
          const rec = list[cursor++]
          try { await loadSession(rec) } catch (e) { /* skip failed session */ }
        }
      }
      await Promise.all(Array.from({ length: 8 }, worker))
    }
    const annotateAll = (list) => {
      for (const rec of list) {
        const st = states.get(rec.header.id)
        if (st) { try { annotate(st, rec, pathTitle) } catch (e) { /* ignore */ } }
      }
    }
    await loadAll(fast)
    annotateAll(fast)
    ready = true
    // 大会话后台继续加载（不阻塞请求）；完成后数据自动就绪
    loadAll(slow).then(() => {
      annotateAll(slow)
      // 后台补载可能改变统计结果：清空请求缓存，避免冷启动不完整数据
      // 被 5 分钟 TTL 冻结（首个请求命中不完整快照后要等缓存过期才更新）
      cache.clear()
    }).catch(() => {})
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

export const inject = ["webServer", "sessionQuery", "sessionPersistence", "workspaceRegistry", "timer", "sessions"]
