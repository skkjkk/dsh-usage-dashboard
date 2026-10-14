// dsh-usage-dashboard — host half (glue layer).
//
// v0.3 performance architecture (event-driven rollups):
//   * Pure aggregation lives in ./core/rollup.js (foldSession / foldAppend /
//     queryUsage / queryDetail / queryCalendar) — no ctx, no IO.
//   * This layer keeps per-session ROLLUPS fresh in memory and NEVER
//     re-parses full session logs on refresh:
//       - the corpus is discovered by walking the session store directly
//         (session-<id> directories only) instead of q.listSessions(), so the
//         listing costs a stat per session instead of a stat + header decode;
//       - folded rollups are cached on disk keyed by (file, mtime, size), so
//         after the first build a restart adopts every unchanged session with
//         ZERO log decoding and the dashboard is complete within seconds of
//         boot;
//       - unchanged-but-uncached sessions load once via
//         sessionPersistence.requireStoredLog (single session read, no corpus
//         re-list) inside a bounded background pass; the first dashboard
//         request waits for that pass so the first paint is complete data;
//       - legacy-layout session directories (bare <uuid>, the old subagent
//         logs) are never queued, and any session whose stored log cannot be
//         read is skipped silently and permanently — per product decision the
//         dashboard counts normal sessions only;
//       - ctx.on('session/event') streams every new event into the matching
//         rollup via foldAppend (µs per event) — no disk reads at all while
//         DSH runs.
//   * Request-level cache (CACHE_TTL_MS = 30s, aligned with the client poll;
//     stale-while-revalidate + single-flight guards repeated identical queries)
//     keeps every range/filter switch at millisecond latency after warm-up.

import { foldSession, foldAppend, emptyRollup, queryUsage, queryDetail, queryDetailAll, queryCalendar, sessionTitle, pruneRollup, serializeRollup, deserializeRollup } from './core/rollup.js'
import { cacheKey, normalizeUsageArgs, normalizeDetailArgs, normalizeCalendarArgs, normalizeExportArgs } from './core/query-params.js'
import { buildCsv } from './core/csv.js'
import { pickLogFile } from './core/session-files.js'

export function apply(ctx, config) {
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
  // 会话读取失败的退避复活：失败次数 < 上限的 dead 会话按 2^n 退避重试，
  // 达到上限后永久跳过（保护「死亡风暴」不再回来）。见 reviveDeadSessions。
  const MAX_SESSION_READ_FAILURES = 3
  const SESSION_RETRY_BASE_MS = 60000
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
  //      GPT-6 系列（gpt-6-sol / gpt-6.1-sol / gpt-6-luna / gpt-6-astra 各模式）、chat-latest、
  //      MiMo-V2.6 三型 + Batch；并修正 gpt-5.6-sol 现行促销价（$4/$20 → ¥28/¥140）。
  // v11: 官方 pricing 全表（.md 版）复核——恢复被误删的 gpt-6-sol（其 cache hit 为输入的
  //      10%，≠6.1-sol 的 5%），并修正 gpt-5.6-terra batch/flex/fast 的过期价。
  // v12: 补录 grok-4-fast-reasoning / grok-4-fast-non-reasoning / grok-4.20（xAI），
  //      并修正 kimi-k3 缓存命中价 5 → 2（官方 ¥2.00/M）。取价变化，旧缓存作废重算。
  // v13: 折叠状态（_openSteps / _lastClosed / _lastMsgT / _lastUserT）纳入磁盘缓存往返，
  //      修复「崩溃截断 + 跨启动 resume」时静默丢 activeMs 与延迟样本（审计 F5）；
  //      旧缓存缺这些字段，必须作废重算。
  // v14: 取价归一新增 provider 作用域（`global:` / `cn:` / `provider/model`）与市场后缀
  //      （`-sg` 等白名单）剥离，带前缀/后缀的模型不再落空为 ¥0；取价结果变化，旧缓存作废。
  // v15: 定价表补录 11 个模型（hy4-preview / step-5-preview / kimi-k2.8-preview /
  //      agnes-3.0-flash + 7 个免费基座），这些模型此前计 ¥0；取价结果变化，旧缓存作废。
  // v16: 补录 sakana-namazu（¥6.65/28/1.05），此前计 ¥0。
  // v17: space-bunny 基座由 0 改为收费价 ¥1.05/4.2/0.21（上游 opencode-go 0.15/0.6/0.03 USD ×7）；
  //      `space-bunny-free` 按 -free 口径剥成基座，本机 3312 次调用由此开始计费。
  // v18: seed cut 改为可跨启动续算并支持迟到/多个 inherited 标记；旧缓存缺
  //      seedCut 状态且可能已计入继承前缀，必须失效并从原始日志重折。
  const CACHE_FORMAT_VERSION = 18
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
    // 目录可能由旧版本以默认 umask（0755）创建：mkdir 的 mode 只影响新建，
    // 升级后必须显式收紧，否则同机其他用户仍可读到 cwd / 逐时用量（审计 F10）。
    try { await mods.fsp.chmod(cacheDir, 0o700) } catch (e) { /* not POSIX / not created yet */ }
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

  // pickLogFile 的匹配口径已下沉到 src/core/session-files.js（纯函数，可单测；
  // scripts/debug-total.js 也能复用它，见剩余任务 E1）。

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

  // 序列化契约已下沉到引擎（src/core/rollup.js 的 serializeRollup / deserializeRollup），
  // 这样 bench 能对「磁盘缓存往返」做真实断言（审计 F26：此前 [7] 标题写了往返却没有断言）。
  // 折叠语义或字段有变时必须同步 bump CACHE_FORMAT_VERSION。

  // evts 修剪保留期：早于该时长的整个小时桶丢弃工具/step/generation 明细。
  // 90 天覆盖全部预设窗口（today/24h/7d/30d/90d）可能选中的任何边缘桶；
  // custom 窗口下界落在 90 天前的极端场景损失的是那几小时的 activeMs
  // （documented 近似，token/成本/消息统计仍精确）。
  const PRUNE_RETENTION_MS = 90 * 24 * 3600000
  // 孤儿缓存文件清理节奏：随 reconcile 检查，但每次至少间隔一个周期，
  // 避免每个 60s tick 都 readdir 缓存目录。
  const ORPHAN_SWEEP_INTERVAL_MS = 60000
  let lastOrphanSweepAt = 0

  // 会话 id 白名单：只允许文件名安全字符（DSH 的 id 形如 session-<uuid>）。
  function isSafeCacheId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 200 &&
      /^[A-Za-z0-9._-]+$/.test(id) && id !== '.' && id !== '..'
  }

  async function flushCache() {
    if (debugCache) console.error('[dash-cache] flush: dir=', cacheDir, 'dirty=', cacheDirty.size)
    if (!cacheDir || cacheDirty.size === 0) return
    const mods = await nodeMods()
    if (!mods) { return }
    // 缓存落盘内容含 cwd / 项目标题 / 会话 id / 逐时用量：目录与文件都用
    // 最小权限创建，多用户机器上不让同组/其他用户读到（审计 F10）。
    try { await mods.fsp.mkdir(cacheDir, { recursive: true, mode: 0o700 }) } catch (e) { /* exists */ }
    const cacheRoot = mods.path.resolve(cacheDir)
    const pruneCutoff = Date.now() - PRUNE_RETENTION_MS
    const ids = Array.from(cacheDirty)
    for (const id of ids) {
      const entry = cacheIndex.get(id)
      if (!entry) { cacheDirty.delete(id); continue }
      // 会话 id 直接拼进缓存文件路径：当前只来自 DSH 内部，但一旦上游语义变化
      // （出现 ../、绝对路径或保留名）即为写入越界。白名单 + 目录内断言（审计 F27）。
      if (!isSafeCacheId(id)) { cacheDirty.delete(id); continue }
      const target = mods.path.join(cacheDir, id + '.json')
      if (!mods.path.resolve(target).startsWith(cacheRoot + mods.path.sep)) { cacheDirty.delete(id); continue }
      try {
        // 序列化前修剪：持久化的 evts 只保留保留期内的明细
        pruneRollup(entry.rollup, pruneCutoff)
        const tmp = mods.path.join(cacheDir, '.' + id + '.tmp')
        // Remove any leftover temp file first: writeFile's mode only applies
        // when it CREATES the file, so an old 0644 temp would keep its wider
        // permissions (审计 F10).
        try { await mods.fsp.rm(tmp, { force: true }) } catch (e) { /* ignore */ }
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
        await mods.fsp.writeFile(tmp, payload, { encoding: 'utf8', mode: 0o600 })
        await mods.fsp.rename(tmp, target)
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
      //
      // 但版本戳必须记「本次计算开始时」的版本，且只在它不比现有条目更旧时落盘
      // （审计 F7）。并发结算下同键可能有两次计算：A 在版本 V 启动、B 在 V+1 启动，
      // 若 B 先完成而 A 后完成，旧实现用写入时刻的 dataVersion 无条件覆盖 → A 的陈旧
      // 结果盖掉 B 的新结果，却被标记为当前版本，快速路径据此判定「新鲜」，
      // 于是 30s TTL 内不再重算、也不触发 SWR。用启动版本比较即可让旧计算让位。
      const prev = cache.get(key)
      if (!prev || prev.version <= version) {
        cache.set(key, { at: Date.now(), data, failCount: 0, version })
      }
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
        st.failCount = 0
        st.lastError = null
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
    // 但「一次瞬时 I/O 错误（文件被占用、网络盘抖动）」也曾被同等对待 → 会话从看板
    // 永久消失且用户无从察觉（审计 F8）。现在记录失败次数与原因，由 reconcile 做
    // 有限次退避复活，并通过 meta.sessionHealth 暴露出来。
    if (!loaded && attempted) {
      drainPending(st, -Infinity)
      st.dead = true
      st.deadAt = Date.now()
      st.failCount = (st.failCount || 0) + 1
      if (!st.lastError) st.lastError = 'session log could not be read'
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
      st.failCount = 0
      st.lastError = null
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
      st.deadAt = Date.now()
      st.failCount = (st.failCount || 0) + 1
      if (!st.lastError) st.lastError = 'poison event history: ' + ((e && e.message) || 'fold failed')
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
    // A successful read resets the failure budget: three independent transient
    // I/O errors spread over hours must not exhaust the retry allowance while
    // the session keeps recovering in between (the budget is for CONSECUTIVE
    // failures, and reaching it still means "give up permanently").
    st.failCount = 0
    st.lastError = null
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
    if (!q || typeof q.listSessions !== 'function') return null
    try {
      const recs = await q.listSessions()
      return (recs || []).map((r) => ({ id: r.header.id, header: r.header, file: null, mtimeMs: undefined, size: undefined }))
    } catch (e) { return null }
  }

  // One corpus pass: refresh `states` from the store walk (or the query
  // service when the store layout is unavailable), drop removed sessions, and
  // hand everything still missing to the background loader.
  async function refreshCorpus() {
    await initStore()
    const listEpoch = eventEpoch
    let records = null
    // `listed` means a source actually answered with a session list — an empty
    // list is then authoritative and MUST prune state. A source that could not
    // run at all (no store, no query service, read error) must NOT be mistaken
    // for "every session was deleted".
    let listed = false
    if (storeRoot) {
      try {
        records = await walkStore()
        if (Array.isArray(records)) listed = true
      } catch (e) { records = null }
    }
    if (!records || records.length === 0) {
      const fallback = await fallbackListSessions()
      if (Array.isArray(fallback)) { records = fallback; listed = true }
    }
    if (!listed) {
      ready = true
      return
    }
    if (!records) records = []
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

  // 会话读取健康度：dead 会话此前完全静默（看板少几个会话，用户无从察觉）。
  // 通过 /dash-api/usage 的 meta.sessionHealth 暴露，前端可提示「N 个会话读取失败」。
  function sessionHealth() {
    let dead = 0
    let retryPending = 0
    let lastError = null
    for (const st of states.values()) {
      if (st.dead !== true) continue
      dead += 1
      if ((st.failCount || 0) < MAX_SESSION_READ_FAILURES) retryPending += 1
      if (!lastError && st.lastError) lastError = st.lastError
    }
    return { dead, retryPending, lastError }
  }

  // 退避复活：一次瞬时 I/O 错误（文件被占用 / 网络盘抖动）不该让会话永久消失。
  // 失败次数少于上限的 dead 会话在退避期后重新入队；超过上限的保持永久跳过，
  // 避免回到「每个 reconcile 都对同一份坏日志重付一次完整解码」的死亡风暴。
  function reviveDeadSessions() {
    const now = Date.now()
    let revived = 0
    for (const st of states.values()) {
      if (st.dead !== true) continue
      const fails = st.failCount || 0
      if (fails >= MAX_SESSION_READ_FAILURES) continue
      const backoff = SESSION_RETRY_BASE_MS * Math.pow(2, Math.max(0, fails - 1))
      if (now - (st.deadAt || 0) < backoff) continue
      st.dead = false
      st.needsReload = true
      revived += 1
    }
    if (revived > 0) invalidate()
    return revived
  }

  // reconcile: pick up new/changed/removed sessions from the store walk and
  // drop removed ones. The routes below are registered unconditionally — a
  // missing timer service only disables periodic reconcile + pre-warm, never
  // the API.
  const timer = getCtxService('timer')
  if (timer) {
    ctx.effect(() => timer.setInterval(() => {
      if (!ready) return
      reviveDeadSessions()
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

  // 缓存 key 必须带路由前缀。三个端点此前都用裸 JSON.stringify(normalized)，
  // 构造同形参数即可让 usage / detail / calendar 互相命中并返回错误结构（审计 F6）。
  harness.handle('usage', (args) => {
    // 归一与缓存 key 都由 core/query-params.js 提供（纯函数，可单测）。
    const normalized = normalizeUsageArgs(args)
    return cached(cacheKey('usage', normalized), async () => {
      const rollups = await getRollups()
      const out = queryUsage(rollups, normalized, { pathTitle: pathTitles() })
      // 读取失败/永久跳过的会话数暴露给前端（审计 F8）：此前完全静默。
      if (out && out.meta) out.meta.sessionHealth = sessionHealth()
      return out
    })
  })

  harness.handle('detail', (args) => {
    const normalized = normalizeDetailArgs(args)
    return cached(cacheKey('detail', normalized), async () => {
      const rollups = await getRollups()
      return queryDetail(rollups, normalized)
    })
  })

  harness.handle('calendar', (args) => {
    const normalized = normalizeCalendarArgs(args)
    return cached(cacheKey('calendar', normalized), async () => {
      const rollups = await getRollups()
      return queryCalendar(rollups, normalized)
    })
  })

  // ---------- CSV 导出（记账/报销用） ----------
  // 与 detail 同一聚合（queryDetailAll 一次取全），但输出 text/csv。
  // 串行闸：exportChain 保证同一时刻只有一个导出在算（跨缓存 key 生效）。
  let exportChain = Promise.resolve()
  harness.handle('export', (args) => {
    const normalized = normalizeExportArgs(args)
    return cached(cacheKey('export', normalized), async () => {
      // 不同 range/models 组合会生成不同缓存 key，因此单靠 cached 的 single-flight
      // 挡不住并发导出；这里再串行化一层，避免同步全量聚合被并发拉满宿主事件循环（审计 F2）。
      const previous = exportChain
      let release = () => {}
      exportChain = new Promise((resolve) => { release = resolve })
      try {
        await previous
        const rollups = await getRollups()
        // 让出事件循环两次：一次在整库聚合之前（`previous` 串行闸刚放开，其它请求
        // 有机会先跑），一次在聚合与 CSV 字符串构建之间。聚合与 buildCsv 本身仍是
        // 同步的，所以导出大库时宿主线程仍会被占用一段——只是不再和排队请求叠在一起。
        await new Promise((resolve) => setTimeout(resolve, 0))
        // 一次聚合取全。旧实现「每 200 行重跑一次全库聚合」的代价是 O(页数 × 库大小)。
        const page = queryDetailAll(rollups, normalized)
        await new Promise((resolve) => setTimeout(resolve, 0))
        return buildCsv(page.rows || [])
      } finally {
        release()
      }
    })
  })

  // csvCell / buildCsv 已下沉到 src/core/csv.js（纯函数，可直接断言字段合法性与
  // 公式注入防护；smoke 的端到端导出用例仍然覆盖同一条路径）。
}
