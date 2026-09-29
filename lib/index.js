// dsh-usage-dashboard — host half (adapted from the src/host.js glue layer).
// Registers three JSON GET routes under /dash-api/* serving usage aggregation
// over the local session store. Aggregation itself lives in ./core/rollup.js.

import { foldSession, foldAppend, emptyRollup, queryUsage, queryDetail, queryCalendar, sessionTitle, pruneRollup } from './core/rollup.js'

function parseQueryArgs(url) {
  const u = new URL(url, 'http://dsh.local')
  const args = {}
  for (const [k, v] of u.searchParams) {
    // never let a query key shadow prototype members onto the args object
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
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
        res.end(JSON.stringify({ error: 'internal_error' }))
      }
    }
  }), 'usage-dashboard: ' + pathname)
}

export function apply(ctx, config) {
  // 与 cordis-host-runner 动态插件沙盒同构的桥：handle(method, fn) → GET /dash-api/<method>
  const harness = { handle: (method, fn) => registerJsonRoute(ctx, '/dash-api/' + method, fn) }

  // ---- named constants (replace scattered magic numbers) ----
  // IMPORTANT: keep these INSIDE apply(). scripts/regenerate.cjs extracts only
  // the body of `export function apply(...)` into lib/index.js, so anything
  // declared at module scope is silently dropped from the bundle (the build
  // guard in regenerate.cjs now fails the build when a referenced
  // UPPER_SNAKE_CASE constant is not declared inside the bundle).
  const CACHE_TTL_MS = 30 * 1000
  const RECONCILE_INTERVAL_MS = 60000
  const CACHE_MAX_FAILURES = 3
  const CACHE_STALE_MULTIPLIER = 2
  const PREWARM_DELAY_MS = 150
  // How long a settled rollup list stays authoritative before getRollups()
  // re-lists sessions. Re-listing 100+ sessions is the dominant cost of a
  // dashboard recompute, so background revalidates must not re-list on every
  // key miss.
  const ROLLUP_SNAPSHOT_MS = 5000
  // Minimum spacing between corpus listings. The store walk is cheap
  // (readdir + stat per session), but there is no reason to run it more often
  // than the reconcile cadence.
  const LIST_MIN_INTERVAL_MS = 20000
  // Cold-read workers. Each worker materializes one stored session at a time;
  // the store walk is ordered newest-first, so the ranges users actually look
  // at (today / 24H) become correct long before the whole corpus is done.
  const LOAD_WORKERS = 4
  // The very first dashboard request waits for the background pass so the
  // first paint shows COMPLETE data. The cap only ever bites on the one-time
  // cold build of a huge store; afterwards the pass is already settled.
  const FIRST_LOAD_WAIT_MS = 90000
  const WAIT_POLL_MS = 50
  // Disk cache format version — bump to invalidate every cached rollup.
  // v2: step-interval fallback + qwen3.8-flash. v3: bucket shape / edge-align.
  // v4: honest response times (fallback removed, timedCalls denominator).
  // v5: proximity join for migrated logs whose message envelope lost turn/step.
  // v6: DeepSeek 现行两型号名（deepseek-flash / deepseek-v4-pro）峰谷价 + V4.1 Flash 新价。
  //     Costs are baked into cached rollups, so a pricing change MUST bump this.
  // v7: 大小写不敏感取价兜底（Qwen3.8-Flash / MiniMax-M3 等 provider 目录原样大小写
  //     此前漏计为 ¥0）；缓存里已固化的 ¥0 必须随版本一起失效重算。
  // v8: fork-seed 切断 + usage 重放去重 + 日期后缀取价。
  // v9: 移除 presentMs 在场时长（桶字段变化，0.3.13）。
  //     Costs are baked into cached rollups, so a pricing/semantics change MUST bump this.
  // v10: Claude Opus 5.5 / Sonnet 5.5 / Mythos 5.1 / Fable 5.1（连字符 API id）、
  //      GPT-6 系列（gpt-6.1-sol / gpt-6-luna / gpt-6-astra 各模式）、chat-latest、
  //      MiMo-V2.6 三型 + Batch；并修正 gpt-5.6-sol 现行促销价（$4/$20 → ¥28/¥140）。
  //      Costs are baked into cached rollups, so a pricing change MUST bump this.
  const CACHE_FORMAT_VERSION = 10
  // Optional diagnostics for the disk rollup cache (set debugCache: true in
  // the plugin config to trace cache writes).
  const debugCache = !!(config && config.debugCache)

  // request-level response cache: key → { at, data, failCount, version }
  const cache = new Map()
  let dataVersion = 0
  // session rollup state: session id → { rollup, cwd, title, at, pending[], ... }
  const states = new Map()
  let ready = false
  let initPromise = null // single-flight listing pass (not the session loads)
  let lastListAt = 0 // throttle for corpus listings
  let backgroundLoad = null // current background materialization pass
  let backgroundQueue = [] // sessions waiting for the next pass
  let rollupSnapshot = null
  let rollupSnapshotAt = 0
  let initialLoadDone = false // true once the very first full load completes
  const inflight = new Map() // cache key → { version, promise }
  let eventEpoch = 0

  // ---- node builtins (dynamic import: module scope never reaches the bundle) ----
  let nodeModsPromise = null
  function nodeMods() {
    if (!nodeModsPromise) {
      nodeModsPromise = Promise.all([
        import('node:fs/promises'),
        import('node:path'),
        import('node:os')
      ]).then(([fsp, pathMod, osMod]) => ({ fsp, path: pathMod, os: osMod })).catch(() => null)
    }
    return nodeModsPromise
  }

  // ---- store walk + disk rollup cache ----
  let storeRoot = null // e.g. ~/.dsh/sessions
  let cacheDir = null // e.g. ~/.dsh/usage-dashboard-cache
  let storeReady = false
  const cacheIndex = new Map() // id → { file, mtimeMs, size, header, rollup, seq }
  const cacheDirty = new Set()

  async function initStore() {
    if (storeReady) return
    storeReady = true
    const mods = await nodeMods()
    if (!mods) return
    // Only trust a root advertised by the persistence service itself. When the
    // service is absent entirely (embedding tests) fall back to the standard
    // location; a present-but-rootless service (smoke stubs) disables the walk
    // so tests exercise the q.listSessions() fallback path instead.
    const persist = getCtxService('sessionPersistence')
    let root = persist && typeof persist.root === 'string' ? persist.root : ''
    if (!root && !persist) {
      try { root = mods.path.join(mods.os.homedir(), '.dsh', 'sessions') } catch (e) { root = '' }
    }
    if (!root) return
    storeRoot = root
    cacheDir = mods.path.join(mods.path.dirname(root), 'usage-dashboard-cache')
    try {
      const names = await mods.fsp.readdir(cacheDir)
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        try {
          const raw = JSON.parse(await mods.fsp.readFile(mods.path.join(cacheDir, name), 'utf8'))
          if (!raw || raw.v !== CACHE_FORMAT_VERSION || !raw.id || !raw.rollup) continue
          cacheIndex.set(raw.id, {
            file: raw.file,
            mtimeMs: raw.mtimeMs,
            size: raw.size,
            header: raw.header || { id: raw.id },
            rollup: deserializeRollup(raw.rollup),
            seq: typeof raw.seq === 'number' ? raw.seq : -Infinity
          })
        } catch (e) { /* corrupt entry: it will be rewritten on next load */ }
      }
    } catch (e) { /* no cache dir yet */ }
  }

  function pickLogFile(files) {
    for (const f of files) if (/^session\.v\d+\.jsonl\.zstd$/.test(f)) return f
    for (const f of files) if (/^session\.v\d+\.jsonl$/.test(f)) return f
    if (files.includes('session.jsonl.zstd')) return 'session.jsonl.zstd'
    if (files.includes('session.jsonl')) return 'session.jsonl'
    return null
  }

  async function walkStore() {
    const mods = await nodeMods()
    if (!mods || !storeRoot) return null
    let projects = []
    try { projects = await mods.fsp.readdir(storeRoot, { withFileTypes: true }) } catch (e) { return null }
    const out = []
    for (const proj of projects) {
      if (!proj.isDirectory()) continue
      const projPath = mods.path.join(storeRoot, proj.name)
      let sessions = []
      try { sessions = await mods.fsp.readdir(projPath, { withFileTypes: true }) } catch (e) { continue }
      for (const sd of sessions) {
        // Only the current session-<id> layout. Legacy bare <uuid> directories
        // (old subagent logs) are outside the dashboard's scope by decision:
        // they are never queued, never read, never retried.
        if (!sd.isDirectory() || !/^session-/.test(sd.name)) continue
        const dir = mods.path.join(projPath, sd.name)
        let files = []
        try { files = await mods.fsp.readdir(dir) } catch (e) { continue }
        const file = pickLogFile(files)
        if (!file) continue
        let stat = null
        try { stat = await mods.fsp.stat(mods.path.join(dir, file)) } catch (e) { continue }
        out.push({ id: sd.name, header: { id: sd.name }, file, mtimeMs: stat.mtimeMs, size: stat.size })
      }
    }
    return out
  }

  function serializeRollup(r) {
    const buckets = []
    for (const [hk, b] of r.buckets) {
      const per = []
      for (const [model, arr] of b.per) per.push([model, arr])
      buckets.push([hk, [per, b.msg, b.durGap, b.first, b.last, b.hasMsg ? 1 : 0, b.evts]])
    }
    // fold 状态随缓存持久化：_seenUsage 保证 foldAppend 续算（disk cache 命中
    // 后 drainPending 追加的事件）与全量 refold 去重一致；_seedCut/_seedSkip
    // 同理（v8 起缓存的是已切断的 rollup，继续 fold 不需要再切）。
    return {
      first: r.first, last: r.last, buckets, modelMeta: Array.from(r.modelMeta || []),
      seenUsage: Array.from(r._seenUsage || []),
      skippedSeedEvents: r.skippedSeedEvents || 0
    }
  }

  function deserializeRollup(o) {
    const r = emptyRollup()
    r.first = o.first === null || typeof o.first === 'number' ? o.first : null
    r.last = o.last === null || typeof o.last === 'number' ? o.last : null
    for (const entry of o.buckets || []) {
      const hk = entry[0]
      const arr = entry[1]
      const per = new Map(arr[0])
      r.buckets.set(hk, { per, msg: arr[1], durGap: arr[2], first: arr[3], last: arr[4], hasMsg: !!arr[5], evts: arr[6] })
    }
    r.modelMeta = new Map(o.modelMeta || [])
    r._seenUsage = new Set(o.seenUsage || [])
    r.skippedSeedEvents = o.skippedSeedEvents || 0
    // v8 缓存里存的是已切断/已去重的 rollup：seed 状态置「无 seed」，
    // 让 drainPending 的 foldAppend 把后续事件原样折叠。
    r._seedCut = null
    r._seedSkip = 0
    return r
  }

  // evts 修剪保留期：早于该时长的整个小时桶丢弃工具/step/generation 明细。
  // 90 天覆盖全部预设窗口（today/24h/7d/30d/90d）可能选中的任何边缘桶；
  // custom 窗口下界落在 90 天前的极端场景损失的是那几小时的 activeMs
  // （documented 近似，token/成本/消息统计仍精确）。
  const PRUNE_RETENTION_MS = 90 * 24 * 3600000
  // 孤儿缓存文件清理节奏：随 reconcile 检查，但每次至少间隔一个周期，
  // 避免每个 60s tick 都 readdir 缓存目录。
  const ORPHAN_SWEEP_INTERVAL_MS = 60000
  let lastOrphanSweepAt = 0

  async function flushCache() {
    if (debugCache) console.error('[dash-cache] flush: dir=', cacheDir, 'dirty=', cacheDirty.size)
    if (!cacheDir || cacheDirty.size === 0) return
    const mods = await nodeMods()
    if (!mods) { return }
    try { await mods.fsp.mkdir(cacheDir, { recursive: true }) } catch (e) { /* exists */ }
    const pruneCutoff = Date.now() - PRUNE_RETENTION_MS
    const ids = Array.from(cacheDirty)
    for (const id of ids) {
      const entry = cacheIndex.get(id)
      if (!entry) { cacheDirty.delete(id); continue }
      try {
        // 序列化前修剪：持久化的 evts 只保留保留期内的明细
        pruneRollup(entry.rollup, pruneCutoff)
        const tmp = mods.path.join(cacheDir, '.' + id + '.tmp')
        const payload = JSON.stringify({
          v: CACHE_FORMAT_VERSION,
          id,
          file: entry.file,
          mtimeMs: entry.mtimeMs,
          size: entry.size,
          header: entry.header,
          seq: entry.seq,
          rollup: serializeRollup(entry.rollup)
        })
        await mods.fsp.writeFile(tmp, payload, 'utf8')
        await mods.fsp.rename(tmp, mods.path.join(cacheDir, id + '.json'))
        cacheDirty.delete(id)
      } catch (e) {
        if (debugCache) console.error('[dash-cache] write failed', id, e && e.message)
        cacheDirty.delete(id)
      }
    }
  }

  // 孤儿缓存清理：会话删除 / 版本升级（v !== CACHE_FORMAT_VERSION）留下的
  // .json 文件只增不减——磁盘目录被这些死文件慢性填充。低频（每个 reconcile
  // 周期最多一次）readdir，删除「cacheIndex 与 states 都不含」的缓存文件。
  async function sweepOrphanCacheFiles() {
    if (!cacheDir) return
    const now = Date.now()
    if (now - lastOrphanSweepAt < ORPHAN_SWEEP_INTERVAL_MS) return
    lastOrphanSweepAt = now
    const mods = await nodeMods()
    if (!mods) return
    let names = []
    try { names = await mods.fsp.readdir(cacheDir) } catch (e) { return }
    for (const name of names) {
      if (!name.endsWith('.json') || name.startsWith('.')) continue
      const id = name.slice(0, -'.json'.length)
      if (cacheIndex.has(id) || states.has(id)) continue
      try { await mods.fsp.unlink(mods.path.join(cacheDir, name)) } catch (e) { /* gone / locked */ }
    }
  }

  // ---------- helpers ----------

  function getCtxService(key) {
    try { return ctx.get(key) } catch (e) { return null }
  }

  function startInflight(key, compute) {
    const version = dataVersion
    const active = inflight.get(key)
    if (active && active.version === version) return active.promise
    const promise = Promise.resolve().then(compute).then((data) => {
      // Single-flight allows at most one live compute per key, so the settling
      // result is always the newest one for that key. Write it even when newer
      // events bumped dataVersion mid-flight — the old `dataVersion === version`
      // gate discarded those results and, combined with per-event cache
      // clearing, left every entry permanently stale in a busy session.
      cache.set(key, { at: Date.now(), data, failCount: 0, version: dataVersion })
      return data
    }).catch((e) => {
      // Keep the last good value visible; count failures so the max-failure
      // eviction policy stays effective.
      const entry = cache.get(key)
      if (entry) {
        cache.set(key, {
          at: entry.at,
          data: entry.data,
          failCount: (entry.failCount || 0) + 1,
          version: entry.version
        })
      }
      throw e
    }).finally(() => {
      if (inflight.get(key) && inflight.get(key).promise === promise) inflight.delete(key)
    })
    inflight.set(key, { version, promise })
    return promise
  }

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
      st = { rollup: emptyRollup(), cwd: (header && header.cwd) || '', title: null, at: Date.now(), lastEventAt: 0, pending: [], needsReload: false, loading: false, loadingPromise: null, listed: false, lastEventEpoch: 0, lastListedEventEpoch: 0, missingListEpoch: null, droppedEvents: 0, dead: false, sub: false, isLive: false, loadedRev: null, loadedEventEpoch: 0 }
      states.set(id, st)
    } else {
      if (st.needsReload === undefined) st.needsReload = false
      if (st.lastEventAt === undefined) st.lastEventAt = 0
      if (st.listed === undefined) st.listed = false
      if (st.lastEventEpoch === undefined) st.lastEventEpoch = 0
      if (st.lastListedEventEpoch === undefined) st.lastListedEventEpoch = 0
      if (st.missingListEpoch === undefined) st.missingListEpoch = null
      if (st.droppedEvents === undefined) st.droppedEvents = 0
      if (st.dead === undefined) st.dead = false
      if (st.sub === undefined) st.sub = false
      if (st.isLive === undefined) st.isLive = false
      if (st.loadedRev === undefined) st.loadedRev = null
      if (st.loadedEventEpoch === undefined) st.loadedEventEpoch = 0
    }
    return st
  }

  // A list snapshot can lag the event stream. Keep a state for one observed
  // miss after a newer session event, but allow later reconciles to collect a
  // truly deleted session. The marker is the event epoch, not the list epoch:
  // otherwise an event that arrived before the list call could be retained forever.
  function keepMissingState(st, listEpoch) {
    if (!st) return false
    if (st.loading || (st.pending && st.pending.length)) return true
    if (st.lastEventEpoch > listEpoch) {
      st.missingListEpoch = st.lastEventEpoch
      return true
    }
    if (st.missingListEpoch !== null) {
      if (st.lastEventEpoch > st.missingListEpoch) {
        st.missingListEpoch = st.lastEventEpoch
        return true
      }
      return false
    }
    if (st.lastEventEpoch > st.lastListedEventEpoch) {
      st.missingListEpoch = st.lastEventEpoch
      return true
    }
    return false
  }

  // Subagent sessions are outside the dashboard's scope by product decision:
  // delegation sessions (delegationDepth > 0 / parentSession) are excluded
  // wherever a header is known, and legacy-layout directories never queue.
  function isSubHeader(header) {
    if (!header) return false
    if ((header.delegationDepth || 0) > 0) return true
    return header.parentSession !== undefined && header.parentSession !== null && header.parentSession !== ''
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

  // Apply buffered stream events to a freshly (re)built rollup, deduplicated
  // by history seq against the events the fold already consumed. A poison
  // event is dropped (and counted) instead of poisoning the whole load — a
  // throw here used to make the loader re-queue the session on every reconcile.
  function drainPending(st, maxSeq) {
    if (st.pending && st.pending.length) {
      for (const ev of st.pending) {
        if (typeof ev.seq === 'number' && typeof maxSeq === 'number' && ev.seq <= maxSeq) continue
        try {
          foldAppend(st.rollup, ev)
        } catch (e) {
          st.droppedEvents = (st.droppedEvents || 0) + 1
          if (debugCache) console.error('[dash-pending] dropped event', st.rollup.id, ev && ev.type, e && e.message)
        }
      }
      st.pending = []
    }
  }

  // Load one session's FULL history once: live sessions come from the
  // in-memory Session object (no parse); others via the persistence reader
  // chain or the disk rollup cache.
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
    let meta = rec.header || { id }

    // A live session is authoritative even when its log is currently empty.
    // Falling through to persistence here can turn a valid new session into a
    // perpetual retry loop before its first flush.
    try {
      const sessions = ctx.get('sessions')
      const live = sessions && sessions.get(id)
      if (live) {
        st.isLive = true
        // Try multiple ways to get events — different DSH versions expose
        // different APIs. snapshotEvents() is the v0.1.5-rc.1 public API.
        if (typeof live.snapshotEvents === 'function') {
          const snap = live.snapshotEvents()
          if (Array.isArray(snap)) { events = snap; loaded = true }
        }
        if (!loaded && Array.isArray(live.events)) { events = live.events; loaded = true }
      }
    } catch (e) { /* fall through to persistence */ }

    // Disk rollup cache: an unchanged stored file adopts its cached fold with
    // zero log decoding — this is what makes a DSH restart effectively instant.
    if (!loaded && rec.file && rec.mtimeMs !== undefined) {
      const hit = cacheIndex.get(id)
      if (hit && hit.file === rec.file && hit.mtimeMs === rec.mtimeMs && hit.size === rec.size && hit.rollup) {
        if (isSubHeader(hit.header)) st.sub = true
        st.rollup = hit.rollup
        annotate(st, { header: hit.header }, workspaceInfo())
        drainPending(st, hit.seq)
        st.at = Date.now()
        st.needsReload = false
        st.dead = false
        st.loadedRev = { file: hit.file, mtimeMs: hit.mtimeMs, size: hit.size }
        st.loadedEventEpoch = eventEpoch
        invalidate()
        return
      }
    }

    const persist = ctx.get('sessionPersistence')
    if (!loaded && persist) {
      // requireStoredLog: one direct stored-log read (format migration for
      // old generations included), no corpus re-list.
      if (typeof persist.requireStoredLog === 'function') {
        try {
          attempted = true
          const stored = await persist.requireStoredLog(id)
          if (stored && Array.isArray(stored.events)) {
            events = stored.events
            loaded = true
            if (stored.meta) meta = stored.meta
          } else if (stored) {
            throw new Error('session read returned no event list')
          }
        } catch { /* try the next reader, then skip permanently */ }
      }
      // open/read/close: only when the faster reader does not exist in this
      // DSH build. Chaining on API availability (not on per-session failure)
      // avoids paying a second full decode for every unreadable session.
      if (!loaded && typeof persist.requireStoredLog !== 'function' && typeof persist.open === 'function') {
        try {
          attempted = true
          const handle = await persist.open(id, 'read')
          try {
            const result = await handle.read()
            if (result && Array.isArray(result.events)) { events = result.events; loaded = true }
            else throw new Error('empty events from handle.read()')
          } finally { handle.close().catch(() => {}) }
        } catch { /* try the next reader, then skip permanently */ }
      }
    }
    // query service: last resort when no persistence service is mounted at all.
    if (!loaded && !persist) {
      try {
        const q = ctx.get('sessionQuery')
        if (q && typeof q.readSession === 'function') {
          attempted = true
          const result = await q.readSession(id)
          if (result && Array.isArray(result.events)) {
            events = result.events
            loaded = true
            if (result.session) meta = result.session
          }
        }
      } catch { /* fall through to the permanent-skip below */ }
    }

    // Unreadable stored log (old subagent artifacts a harness upgrade cannot
    // migrate, corrupt files): skip silently and permanently. Retrying would
    // re-pay a full format migration decode on every listing forever.
    if (!loaded && attempted) {
      drainPending(st, -Infinity)
      st.dead = true
      st.needsReload = false
      st.at = Date.now()
      invalidate()
      return
    }

    // No reader available at all (persistence not mounted): treat as empty
    if (!loaded) {
      events = []
      loaded = true
    }

    // Subagent session read through the official path (new-format delegation
    // sessions): folded but excluded from every query.
    if (isSubHeader(meta)) st.sub = true

    const rollup = st.rollup || emptyRollup()
    st.rollup = rollup
    annotate(st, { header: meta }, workspaceInfo())
    // fork-seed 无法恢复所有权（isSeeded 且无 inherited 标记）：token 疑似
    // 双计。与 unreadable 日志同样按产品口径处理——不重试、不崩溃，仅计数，
    // 待父会话本身也在统计中时影响互相抵消（父已计一次 + 子全量折叠一次）。
    st.seededUnverified = rollup.seededWithoutMarker === true

    if (events.length === 0) {
      drainPending(st, -Infinity)
      st.needsReload = false
      st.dead = false
      st.at = Date.now()
      invalidate()
      return
    }

    let folded
    try {
      folded = foldSession(events)
    } catch (e) {
      // Poison history: an event the engine itself cannot fold. Skip the
      // session permanently — re-queuing would re-pay a full decode on every
      // reconcile forever (the death-storm pattern the cold-load fix killed).
      st.dead = true
      st.needsReload = false
      st.pending = []
      st.at = Date.now()
      if (debugCache) console.error('[dash-load] poison history', id, e && e.message)
      invalidate()
      return
    }
    st.rollup = folded
    annotate(st, { header: meta }, workspaceInfo())
    st.at = Date.now()

    // Merge events streamed during the catch-up read, deduplicated by history seq.
    let maxSeq = -Infinity
    for (const ev of events) {
      if (typeof ev.seq === 'number' && ev.seq > maxSeq) maxSeq = ev.seq
    }
    drainPending(st, maxSeq)

    st.needsReload = false
    st.dead = false
    st.loadedEventEpoch = eventEpoch
    // Cache only non-live sessions (a live session's rollup is rebuilt from
    // memory on the next boot anyway) and never subagent rollups.
    if (!st.sub && !st.isLive && rec.file && rec.mtimeMs !== undefined) {
      st.loadedRev = { file: rec.file, mtimeMs: rec.mtimeMs, size: rec.size }
      cacheIndex.set(id, {
        file: rec.file,
        mtimeMs: rec.mtimeMs,
        size: rec.size,
        header: { id: meta.id || id, cwd: meta.cwd || '', createdAt: meta.createdAt },
        rollup: folded,
        seq: maxSeq
      })
      cacheDirty.add(id)
    }
    invalidate()
  }

  function currentRollups() {
    const out = []
    for (const st of states.values()) {
      if (st.dead || st.sub) continue
      const r = st.rollup
      if (r && r.last !== null) out.push(r)
    }
    return out.sort((a, b) => (b.last || 0) - (a.last || 0))
  }

  function invalidate() {
    // Bump the version only. The cache is deliberately NOT cleared: entries
    // keyed by a superseded version keep being served (stale-while-revalidate)
    // while a background recompute lands the fresh value. Clearing here turned
    // every streamed metric event into a cold recompute on the next dashboard
    // request.
    dataVersion += 1
  }

  // Remember a settled rollup list so a background revalidate does not re-list
  // every session (the dominant cost of a recompute). New/removed sessions are
  // still picked up by the event stream and the 60s reconcile.
  function snapshotRollups(out) {
    rollupSnapshot = out
    rollupSnapshotAt = Date.now()
    return out
  }

  // Materialize every known session once, then serve all queries from the
  // event-driven in-memory states. A request can still trigger loading for a
  // session created before the plugin's event listener was attached.
  //
  // The materialisation itself is NOT awaited by a request beyond the first
  // one: a cold store needs a one-time pass (seconds with a warm disk cache),
  // and the first request waits for it so the user sees complete data instead
  // of a partial "still counting" view.
  async function getRollups() {
    const now = Date.now()
    if (rollupSnapshot && now - rollupSnapshotAt < ROLLUP_SNAPSHOT_MS) {
      return rollupSnapshot
    }
    if (!initPromise && now - lastListAt >= LIST_MIN_INTERVAL_MS) {
      lastListAt = now
      initPromise = refreshCorpus().catch(() => {}).finally(() => { initPromise = null })
    }
    if (!rollupSnapshot && initPromise) await initPromise

    // First call: wait for the materialization pass to settle so the user sees
    // complete data on first open instead of partial.
    if (!initialLoadDone) {
      await waitForFullLoad()
      initialLoadDone = true
    }
    return snapshotRollups(currentRollups())
  }

  // Wait until the background pass has settled: every known session is either
  // materialized, excluded (subagent), or permanently skipped (unreadable).
  async function waitForFullLoad() {
    const deadline = Date.now() + FIRST_LOAD_WAIT_MS
    for (;;) {
      if (!backgroundLoad && backgroundQueue.length === 0) return
      let allSettled = true
      for (const st of states.values()) {
        if (st.dead || st.sub) continue
        if (st.rollup.last === null) { allSettled = false; break }
      }
      if (allSettled) return
      if (Date.now() > deadline) return
      await new Promise((r) => setTimeout(r, WAIT_POLL_MS))
    }
  }

  async function fallbackListSessions() {
    const q = getCtxService('sessionQuery')
    if (!q || typeof q.listSessions !== 'function') return []
    try {
      const recs = await q.listSessions()
      return (recs || []).map((r) => ({ id: r.header.id, header: r.header, file: null, mtimeMs: undefined, size: undefined }))
    } catch (e) { return [] }
  }

  // One corpus pass: refresh `states` from the store walk (or the query
  // service when the store layout is unavailable), drop removed sessions, and
  // hand everything still missing to the background loader.
  async function refreshCorpus() {
    await initStore()
    const listEpoch = eventEpoch
    let records = null
    if (storeRoot) {
      try { records = await walkStore() } catch (e) { records = null }
    }
    if (!records || records.length === 0) records = await fallbackListSessions()
    if (!records || records.length === 0) {
      ready = true
      return
    }
    const seen = new Set()
    const toLoad = []
    for (const rec of records) {
      const header = rec.header || {}
      const id = rec.id || header.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      const st = states.get(id)
      if (st) {
        st.listed = true
        st.lastListedEventEpoch = st.lastEventEpoch
        st.missingListEpoch = null
      }
      if (!st) {
        // Subagent sessions are skipped before anything is read.
        if (isSubHeader(header)) continue
        toLoad.push(rec)
        continue
      }
      if (st.dead || st.sub) continue
      if (st.needsReload || st.rollup.last === null) { toLoad.push(rec); continue }
      // A closed session whose stored file changed (resumed by a later DSH
      // run) reloads — but only when no live event has arrived since the load,
      // otherwise the event stream is already ahead of the file.
      if (rec.file && rec.mtimeMs !== undefined && st.loadedRev &&
        (st.loadedRev.file !== rec.file || st.loadedRev.mtimeMs !== rec.mtimeMs || st.loadedRev.size !== rec.size) &&
        st.lastEventEpoch <= st.loadedEventEpoch) {
        toLoad.push(rec)
      }
    }
    for (const id of Array.from(states.keys())) {
      const st = states.get(id)
      if (!seen.has(id)) {
        const now = Date.now()
        if (keepMissingState(st, listEpoch)) continue
        if (st.lastEventAt && now - st.lastEventAt < RECONCILE_INTERVAL_MS * 2) continue
        states.delete(id)
        cacheIndex.delete(id)
      }
    }
    ready = true
    queueLoad(toLoad)
  }

  // Background loader: keeps at most one pass alive, drains everything queued
  // into it, and never rejects (a bad session must not stop the pass).
  function queueLoad(recs) {
    if (recs && recs.length) {
      const queued = new Set(backgroundQueue.map((rec) => rec.header.id))
      for (const rec of recs) {
        const id = rec.header.id
        if (queued.has(id)) continue
        queued.add(id)
        backgroundQueue.push(rec)
      }
    }
    if (backgroundLoad || backgroundQueue.length === 0) return
    backgroundLoad = (async () => {
      try {
        while (backgroundQueue.length) {
          const batch = backgroundQueue
          backgroundQueue = []
          let cursor = 0
          const worker = async () => {
            while (cursor < batch.length) {
              const rec = batch[cursor++]
              try { await loadSession(rec) } catch (e) { /* isolate one bad session */ }
            }
          }
          await Promise.all(Array.from({ length: LOAD_WORKERS }, () => worker()))
          invalidate()
          await flushCache().catch(() => {})
        }
      } catch (e) { /* a failed pass must never leak an unhandled rejection */
      } finally {
        backgroundLoad = null
      }
    })()
  }

  function affectsMetrics(event) {
    if (!event) return false
    if (event.type === 'assistant/chunk') return !!(event.data && event.data.chunk && event.data.chunk.type === 'finish')
    return event.type === 'user/message' || event.type === 'assistant/message' ||
      event.type === 'tool/call' || event.type === 'tool/result' || event.type === 'step/end'
  }

  // ---------- event stream ----------

  ctx.on('session/event', (session, event) => {
    const id = session && (session.id || (session.header && session.header.id))
    if (!id || !event || typeof event.time !== 'number') return
    if (affectsMetrics(event)) invalidate()
    const eventEpochNow = ++eventEpoch
    let st = states.get(id)
    if (st) {
      st.lastEventEpoch = eventEpochNow
      st.lastEventAt = Date.now()
    }
    if (!st) {
      // brand-new session: create state and start history load
      st = ensureState(id, (session && session.header) || {})
      st.lastEventEpoch = eventEpochNow
      st.lastEventAt = Date.now()
      st.pending.push(event)
      // The catch matters: a rejected history load must never surface as an
      // unhandledRejection in the host process (Node default is to abort).
      loadSession({ header: session.header || { id } }).catch(() => {})
      return
    }
    if (st.loading) {
      // history still loading — buffer event with seq dedup
      const already = st.pending.find((e) => e && typeof e.seq === 'number' && e.seq === event.seq)
      if (!already) st.pending.push(event)
    } else {
      // history loaded: append directly (no pending). A poison event must not
      // break the dispatch to other listeners or crash the stream: drop it,
      // count the drop, and let the next DSH boot (full refold) self-heal.
      try {
        foldAppend(st.rollup, event)
        st.at = Date.now()
      } catch (e) {
        st.droppedEvents = (st.droppedEvents || 0) + 1
        if (debugCache) console.error('[dash-event] foldAppend dropped event', id, event && event.type, e && e.message)
      }
    }
  })

  // reconcile: pick up new/changed/removed sessions from the store walk and
  // drop removed ones. The routes below are registered unconditionally — a
  // missing timer service only disables periodic reconcile + pre-warm, never
  // the API.
  const timer = getCtxService('timer')
  if (timer) {
    ctx.effect(() => timer.setInterval(() => {
      if (!ready) return
      refreshCorpus().catch(() => {})
      sweepOrphanCacheFiles().catch(() => {})
    }, RECONCILE_INTERVAL_MS), 'usage-dashboard: reconcile')

    // pre-warm the cold load right after startup: first open is instant
    ctx.effect(() => timer.timeout(() => { getRollups().catch(() => {}) }, PREWARM_DELAY_MS), 'usage-dashboard: prewarm')
  }

  // ---------- single-flight request helpers ----------

  async function cached(key, compute) {
    const now = Date.now()
    // Clean up entries older than CACHE_TTL_MS * 2 (but not inflight entries)
    for (const [k, v] of cache.entries()) {
      if (!inflight.has(k) && now - v.at >= CACHE_TTL_MS * CACHE_STALE_MULTIPLIER) {
        cache.delete(k)
      }
    }
    let hit = cache.get(key)
    // if entry exceeded max failures, drop it and recompute
    if (hit && (hit.failCount || 0) >= CACHE_MAX_FAILURES) {
      cache.delete(key)
      hit = null
    }
    // Fast path: current data version and inside the TTL.
    if (hit && hit.version === dataVersion && now - hit.at < CACHE_TTL_MS) {
      return hit.data
    }
    if (hit) {
      // Stale-while-revalidate. An entry is "stale" when the data version moved
      // on (any metric event) or the TTL expired. Serve the last good value
      // immediately and recompute in the background — deleting the entry here
      // made every event of a busy session cost a full cold recompute on the
      // next request, which is what made range switching feel slow.
      startInflight(key, compute).catch(() => {})
      return hit.data
    }
    // no hit at all: compute fresh result
    // first compute failure should NOT cache data:null; instead allow the
    // promise to propagate the error; the caller handles graceful degradation
    const active = inflight.get(key)
    if (active) return active.promise
    const p = startInflight(key, compute)
    try {
      return await p
    } finally {
      // startInflight already cleans up inflight on settle; this finally is for
      // the await path only — do not double-delete a newer version's promise
      const current = inflight.get(key)
      if (current && current.promise === p) inflight.delete(key)
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

  // ---------- CSV 导出（记账/报销用） ----------
  // 与 detail 同一聚合（queryDetail 全量分页拼装），但输出 text/csv。查询缓存
  // 键带 limit: null 与交互查询区分开——导出永远全量，不受 200 行上限约束。
  harness.handle('export', (args) => {
    const input = args || {}
    const normalized = {
      range: input.range || '30d',
      from: input.from != null ? input.from : null,
      to: input.to != null ? input.to : null,
      models: input.models != null ? input.models : null,
      projects: input.projects != null ? input.projects : null
    }
    return cached(JSON.stringify(normalized) + '|export', async () => {
      const rollups = await getRollups()
      // 分页拉全：单页上限 200，循环 offset 直到取尽（total 由第一次返回）
      const rows = []
      let offset = 0
      let total = Infinity
      while (rows.length < total) {
        const page = queryDetail(rollups, Object.assign({}, normalized, { offset, limit: 200 }))
        if (!rows.length) total = page.total || 0
        if (!page.rows || page.rows.length === 0) break
        rows.push(...page.rows)
        offset += page.rows.length
        if (page.rows.length < 200) break
      }
      return buildCsv(rows)
    })
  })

  function csvCell(v) {
    const s = String(v == null ? '' : v)
    // 逗号/引号/换行 → 引号包裹 + 引号转义；公式注入防护：=+-@ 开头加前导单引号
    if (/^[=+\-@]/.test(s)) return "'\"" + s.replace(/"/g, '""') + "\"'"
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }

  function buildCsv(rows) {
    const header = '时间,项目,模型,工具,输入tokens,输出tokens,缓存tokens,费用(元)'
    const lines = [header]
    for (const r of rows) {
      lines.push([
        new Date(r.t).toISOString(),
        r.project || '',
        r.model || '',
        'dsh',
        r.input || 0,
        r.output || 0,
        r.cache || 0,
        (r.cost || 0).toFixed(6)
      ].map(csvCell).join(','))
    }
    return { csv: lines.join('\r\n'), rows: rows.length }
  }

}

export const inject = ["webServer", "sessionQuery", "sessionPersistence", "workspaceRegistry", "timer", "sessions"]
