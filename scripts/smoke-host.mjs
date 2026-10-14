import { readFileSync } from 'node:fs'
import { apply } from '../lib/index.js'

const now = Date.now()
const from = now - 60000
const sessionId = 'smoke-session'
const cwd = 'D:/smoke-project'
const events = [
  { type: 'user/message', time: from, seq: 1, data: { source: { kind: 'user' } } },
  { type: 'step/start', time: from + 100, seq: 2, data: { turn: 0, step: 0 } },
  { type: 'assistant/chunk', time: from + 2000, seq: 3, data: { turn: 0, step: 0, chunk: { type: 'text-delta', index: 0, text: 'hello' } } },
  { type: 'assistant/chunk', time: from + 3000, seq: 4, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
  { type: 'assistant/message', time: from + 3001, seq: 5, data: { turn: 0, step: 0, usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } },
  { type: 'tool/call', time: from + 4000, seq: 6, data: { callId: 'tool-0' } },
  { type: 'tool/result', time: from + 14000, seq: 7, data: { message: { source: { callId: 'tool-0' } } } },
  // Mixed cache telemetry path: second assistant/message with significant cache read/write.
  // inputTokens=100, cacheReadTokens=800, cacheWriteTokens=100 → billedInput contribution = 1000.
  // Together with the first event (inputTokens=1, no meaningful cache), total billedInput = 1001.
  // cacheHitRate = cacheRead / cacheObserved * 100 = 800 / 1001 * 100 ≈ 79.92
  // cacheCoverage = cacheObserved / billedInput * 100 = 1001 / 1001 * 100 = 100
  { type: 'step/start', time: from + 5000, seq: 8, data: { turn: 1, step: 0 } },
  { type: 'assistant/chunk', time: from + 5100, seq: 9, data: { turn: 1, step: 0, chunk: { type: 'text-delta', index: 0, text: 'cached' } } },
  { type: 'assistant/chunk', time: from + 5200, seq: 10, data: { turn: 1, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
  { type: 'assistant/message', time: from + 5201, seq: 11, data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 800, cacheWriteTokens: 100 }, message: { source: { model: 'deepseek-v4-flash' } } } }
]
const header = { id: sessionId, cwd, createdAt: from }
const routes = new Map()
let eventHandler = null
let listCalls = 0
let listVisible = true
const lagHeader = { id: 'lag-marker', cwd: 'D:/lag-marker' }
const services = {
  webServer: { register(definition) { routes.set(definition.path, definition.handler) } },
  sessionQuery: {
    async listSessions() {
      listCalls += 1
      return listVisible ? [{ header, live: false, persisted: true }] : [{ header: lagHeader, live: false, persisted: true }]
    },
    async readSession(sid) {
      if (sid !== sessionId) throw new Error('unknown session')
      return { session: header, events, inheritedEventCount: 0 }
    }
  },
  sessionPersistence: {
    async open(id, access) {
      if (access !== 'read') throw new Error('write not supported in smoke')
      if (id !== sessionId) throw new Error('unknown session')
      return {
        id,
        header,
        read: async () => ({ eventState: 'shared-frozen', events }),
        close: async () => {}
      }
    },
    async requireStoredLog(id) {
      return id === sessionId
        ? { meta: header, events, inheritedEventCount: 0, status: 'current' }
        : { meta: { id }, events: [], inheritedEventCount: 0, status: 'current' }
    }
  },
  workspaceRegistry: {
    list() { return [{ path: cwd, title: 'Smoke Project', sessionIds: [sessionId] }] }
  },
  sessions: {
    get(id) {
      if (id !== sessionId) return null
      return {
        header,
        inheritedEventCount: 0,
        snapshotEvents: () => events
      }
    }
  },
  // no-op timer: apply() registers its reconcile/pre-warm effects through
  // ctx.effect and must NOT skip the route registrations when it fires them.
  // The callbacks never run — the test drives events explicitly and asserts
  // listSessions() call counts, so a real timer would perturb those counts.
  timer: {
    setInterval() { return () => {} },
    timeout() { return () => {} }
  }
}
const ctx = {
  get(name) { return services[name] },
  on(_name, handler) { eventHandler = handler },
  effect(fn) { return fn() || (() => {}) }
}

apply(ctx, {})

async function request(path, remoteAddress = '127.0.0.1') {
  const res = await rawRequest(path, remoteAddress)
  if (res.status !== 200) throw new Error('route failed ' + res.status + ': ' + res.body)
  return JSON.parse(res.body)
}

// 原始请求：拿状态码与 body，用于断言非 200 分支。
async function rawRequest(path, remoteAddress) {
  const handler = routes.get(path.split('?')[0])
  if (!handler) throw new Error('missing route ' + path)
  let status = 0
  let body = ''
  await handler({ url: path, socket: { remoteAddress } }, {
    writeHead(code) { status = code },
    end(value) { body = String(value || '') }
  })
  return { status, body }
}

const queryPath = '/dash-api/usage?range=custom&from=' + from + '&to=' + now
const usage = await request(queryPath)
if (usage.totals.activeMs !== 1100) throw new Error('activeMs expected 1100, got ' + usage.totals.activeMs)
if (usage.totals.totalMs !== 14000) throw new Error('totalMs expected 14000, got ' + usage.totals.totalMs)
if (usage.meta.projects.length !== 1 || usage.meta.projects[0].title !== 'Smoke Project') {
  throw new Error('workspace project mapping failed: ' + JSON.stringify(usage.meta.projects))
}
if (usage.meta.dist.projects.length !== 1 || usage.meta.dist.projects[0].label !== 'Smoke Project') {
  throw new Error('project distribution failed: ' + JSON.stringify(usage.meta.dist.projects))
}
if (listCalls !== 1) throw new Error('initial list call count expected 1, got ' + listCalls)

// Cache metrics contract: second event exercises the mixed telemetry path
// (inputTokens=100, cacheReadTokens=800, cacheWriteTokens=100). The first event
// contributes inputTokens=1 with no meaningful cache, so totals include both.
const cacheTotals = usage.totals
if (cacheTotals.cacheRead !== 800) throw new Error('cacheRead expected 800, got ' + cacheTotals.cacheRead)
if (cacheTotals.cacheWrite !== 100) throw new Error('cacheWrite expected 100, got ' + cacheTotals.cacheWrite)
if (cacheTotals.billedInput !== 1001) throw new Error('billedInput expected 1001, got ' + cacheTotals.billedInput)
if (cacheTotals.cacheObserved !== 1001) throw new Error('cacheObserved expected 1001, got ' + cacheTotals.cacheObserved)
// cacheHitRate = 800/1001*100 ≈ 79.92; cacheCoverage = 1001/1001*100 = 100
if (typeof cacheTotals.cacheHitRate !== 'number') throw new Error('cacheHitRate missing, got ' + cacheTotals.cacheHitRate)
if (Math.abs(cacheTotals.cacheHitRate - 800 / 1001 * 100) > 0.01) throw new Error('cacheHitRate expected ~79.92, got ' + cacheTotals.cacheHitRate)
if (cacheTotals.cacheCoverage !== 100) throw new Error('cacheCoverage expected 100, got ' + cacheTotals.cacheCoverage)
// Alias fields must equal the canonical fields
if (cacheTotals.cacheReadTokens !== cacheTotals.cacheRead) throw new Error('cacheReadTokens alias mismatch: ' + cacheTotals.cacheReadTokens + ' != ' + cacheTotals.cacheRead)
if (cacheTotals.cacheWriteTokens !== cacheTotals.cacheWrite) throw new Error('cacheWriteTokens alias mismatch: ' + cacheTotals.cacheWriteTokens + ' != ' + cacheTotals.cacheWrite)
if (cacheTotals.billedInputTokens !== cacheTotals.billedInput) throw new Error('billedInputTokens alias mismatch: ' + cacheTotals.billedInputTokens + ' != ' + cacheTotals.billedInput)
if (cacheTotals.cacheObservedTokens !== cacheTotals.cacheObserved) throw new Error('cacheObservedTokens alias mismatch: ' + cacheTotals.cacheObservedTokens + ' != ' + cacheTotals.cacheObserved)

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// A metric event bumps the data version but must NOT cost a synchronous cold
// recompute: the last good value is served immediately and the revalidate runs
// in the background (stale-while-revalidate). Clearing the cache on every
// streamed event used to make every dashboard request — range switching
// included — pay a full cold recompute.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/message', time: now - 1000, seq: 8,
  data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
})
const callsBeforeRevalidate = listCalls
const stale = await request(queryPath)
if (stale.totals.assistantMessages !== 2) throw new Error('stale-while-revalidate did not serve the last good value, got ' + stale.totals.assistantMessages)
if (listCalls !== callsBeforeRevalidate) throw new Error('background revalidate re-listed sessions it had snapshotted')

// Let the background revalidate settle, then the fresh total is visible.
await flush()
const fresh = await request(queryPath)
if (fresh.totals.assistantMessages !== 3) throw new Error('metric event was not appended, got ' + fresh.totals.assistantMessages)
const callsAfterMetric = listCalls

// A non-finish chunk updates open generation state but must not flush the cache.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/chunk', time: now - 800, seq: 9,
  data: { turn: 1, step: 0, chunk: { type: 'text-delta', index: 0, text: 'partial' } }
})
const cached = await request(queryPath)
if (listCalls !== callsAfterMetric) throw new Error('non-metric chunk unexpectedly flushed the cache')
if (cached.totals.assistantMessages !== 3) throw new Error('cached metric result changed unexpectedly')

// A malformed live event must be absorbed by the listener, never thrown out
// of the event dispatch (which would poison other listeners / crash the
// stream), and the NEXT event must still fold into the same rollup.
{
  eventHandler({ id: sessionId, header }, {
    type: 'assistant/message', time: now - 900, seq: 12
    // no data at all: pre-guard code threw a TypeError here
  })
  eventHandler({ id: sessionId, header }, {
    type: 'assistant/message', time: now - 850, seq: 13,
    data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
  })
  await flush()
  const afterPoison = await request(queryPath + '&to=' + (now + 1))
  if (afterPoison.totals.assistantMessages !== 5) {
    throw new Error('poison event or listener death: expected assistantMessages 5 (3 + dropped-but-counted + folded), got ' + afterPoison.totals.assistantMessages)
  }
}

// A listed session survives an omission when the list snapshot lags a prior
// event. The clock is advanced past BOTH the rollup snapshot window (5 s) and
// the corpus-list throttle (20 s) so this revalidate performs a real
// listSessions() instead of reusing the snapshot, and flushed so the assertion
// reads the recomputed value rather than the SWR one.
{
  const realDateNow = Date.now
  Date.now = () => now + 25 * 1000
  try {
    listVisible = false
    eventHandler({ id: sessionId, header }, {
      type: 'assistant/message', time: now - 700, seq: 10,
      data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
    })
    await flush()
    const listedLag = await request(queryPath)
    if (listedLag.totals.sessions !== 1) throw new Error('listed session was dropped by a lagging list')
    if (listCalls === callsAfterMetric) throw new Error('lagging-list revalidate did not re-list sessions')
    listVisible = true
  } finally {
    Date.now = realDateNow
  }
}

// An event-created session must be visible to a freshly computed query even
// while the persisted list still lags behind.
//
// Two things have to be forced for this to be deterministic rather than a
// scheduling coincidence:
//   1. a distinct cache key, so the request computes fresh instead of being
//      served the stale-while-revalidate value of the shared key;
//   2. a clock past the rollup snapshot window, so the compute rebuilds from
//      live state rather than reusing the pre-event snapshot.
const eventSessionId = 'event-created'
const eventHeader = { id: eventSessionId, cwd: 'D:/event-project' }
eventHandler({ id: eventSessionId, header: eventHeader }, {
  type: 'user/message', time: now - 500, seq: 1, data: { source: { kind: 'user' } }
})
await new Promise((resolve) => setTimeout(resolve, 0))
{
  const realDateNow = Date.now
  Date.now = () => now + 60 * 1000
  try {
    const withEventSession = await request(queryPath + '&to=' + (now + 2))
    if (withEventSession.totals.sessions !== 2) {
      throw new Error('event-created session was dropped by a lagging list, got ' + withEventSession.totals.sessions)
    }
  } finally {
    Date.now = realDateNow
  }
}

// Once a later list still omits it and the recent-event grace has elapsed, it is collectable.
//
// The listing pass is no longer awaited by a request (that await is exactly the
// cold-start hang this suite guards against), so the drop happens during the
// background pass. Trigger it, let it land, then step past the snapshot window
// and assert on a freshly computed key.
const realDateNow = Date.now
Date.now = () => now + 3 * 60000
try {
  await request(queryPath + '&to=' + (now + 3))
  await flush()
  await flush()
  Date.now = () => now + 4 * 60000
  const afterMissingSession = await request(queryPath + '&to=' + (now + 4))
  if (afterMissingSession.totals.sessions !== 1) {
    throw new Error('deleted session state was retained forever, got ' + afterMissingSession.totals.sessions)
  }
} finally {
  Date.now = realDateNow
}

// Route registration must not depend on the optional timer service: without it
// only periodic reconcile + pre-warm degrade, the API still comes up.
{
  const noTimerRoutes = new Map()
  const noTimerCtx = {
    get(name) {
      if (name === 'webServer') return { register(d) { noTimerRoutes.set(d.path, d.handler) } }
      if (name === 'timer') return undefined
      return services[name]
    },
    on() {},
    effect(fn) { return typeof fn === 'function' ? (fn() || (() => {})) : (() => {}) }
  }
  apply(noTimerCtx, {})
  for (const p of ['/dash-api/usage', '/dash-api/detail', '/dash-api/calendar']) {
    if (!noTimerRoutes.has(p)) throw new Error('route not registered without timer service: ' + p)
  }
}

// Client bundle contract smoke:
// The real DSH client API is `slots.inject('<slot>', () => slots.register(
//   { name: '<slot>', ... }, render))`. Assert both halves and that every slot
// the bundle injects is a known slot AND is paired with a matching register.
{
  const clientCode = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const hasSlotsService = /['"]slots['"]/.test(clientCode) && /ctx\.get\(\s*['"]slots['"]\s*\)/.test(clientCode)
  if (!hasSlotsService) throw new Error('client bundle does not resolve the "slots" service')

  const KNOWN_SLOTS = new Set([
    'conversation.view',
    'settings.plugin.item',
    'settings.plugins.tab',
    'settings.section',
    'settings.general.item',
    'conversation.session.header.actions',
    'conversation.session.header.utilities',
    'conversation.input.dock',
    'conversation.composer.dock',
    'sidebar.footer.action',
    'shell.overlay'
  ])

  const injected = [...clientCode.matchAll(/slots\.inject\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  if (injected.length === 0) throw new Error('client bundle never calls slots.inject(...)')

  const registered = new Set(
    [...clientCode.matchAll(/register\(\s*\{[^}]*?name:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  )

  for (const slot of injected) {
    if (!KNOWN_SLOTS.has(slot)) throw new Error('client injects unknown slot: ' + slot)
    if (!registered.has(slot)) throw new Error('client injects ' + slot + ' but never registers it')
  }

  // The host bridge serialises array params as JSON (audit F14). Assert on the
  // generated text, because the suite never executes the browser bundle: a
  // regression back to join(",") is exactly the bug this guards, and the server
  // side alone cannot detect it (the two halves must agree on the encoding).
  // The bundle is produced by a bundler now, so the branch may span lines:
  // inspect a window after the guard instead of a single line.
  const arrayAt = clientCode.indexOf('Array.isArray(v)')
  if (arrayAt === -1) throw new Error('client bundle: array query-param branch not found')
  const arrayWindow = clientCode.slice(arrayAt, arrayAt + 240)
  if (arrayWindow.indexOf('JSON.stringify(v)') === -1) {
    throw new Error('client bundle: array params are not JSON-encoded → ' + arrayWindow.split('\n')[0].trim())
  }
  if (/\.join\(\s*["'],["']\s*\)/.test(arrayWindow)) {
    throw new Error('client bundle: array params are still comma-joined → ' + arrayWindow.split('\n')[0].trim())
  }
}

// --- loopback guard (audit F1): /dash-api/* must refuse non-loopback callers ---
for (const addr of ['192.168.1.50', '::ffff:192.168.1.50', '10.0.0.7']) {
  const denied = await rawRequest('/dash-api/usage?range=today', addr)
  if (denied.status !== 403) throw new Error('non-loopback caller ' + addr + ' was not refused (status ' + denied.status + ')')
}
for (const addr of ['127.0.0.1', '127.0.0.5', '::1', '::ffff:127.0.0.1']) {
  const allowed = await rawRequest('/dash-api/usage?range=today', addr)
  if (allowed.status !== 200) throw new Error('loopback caller ' + addr + ' was refused (status ' + allowed.status + ')')
}

// --- cache key namespace (audit F6) ---
// These two requests normalize to byte-identical JSON; before the route prefix was
// added they shared one cache entry and returned the wrong payload shape.
const collideUsage = await request('/dash-api/usage?range=today&from=&to=&models=&projects=&offset=0&limit=100')
if (!collideUsage.totals) throw new Error('usage payload lacks totals')
const collideDetail = await request('/dash-api/detail?range=today')
if (!Array.isArray(collideDetail.rows)) throw new Error('detail payload lacks rows')
const collideAgain = await request('/dash-api/usage?range=today&from=&to=&models=&projects=&offset=0&limit=100')
if (!collideAgain.totals) throw new Error('usage was served a detail payload (cache key collision)')

// --- export path (audit F2/F9): one-pass full export, no 500 on the happy path ---
const exported = await request('/dash-api/export?range=custom&from=' + from + '&to=' + now)
if (typeof exported.csv !== 'string' || exported.csv.indexOf('时间,项目,模型') !== 0) {
  throw new Error('export did not return the expected CSV header')
}
if (!(exported.rows >= 1)) throw new Error('export returned no rows')

// A formula-like model name containing commas and quotes must remain ONE valid
// CSV cell, and its first character after parsing must be a literal apostrophe.
// An apostrophe OUTSIDE the CSV quotes does not guard the rest of the field:
// spreadsheet parsers split at the embedded comma and can see a new '=...' cell.
{
  const hostileModel = '=1,=HYPERLINK("https://example.invalid/a,b","x")'
  eventHandler({ id: sessionId, header }, {
    type: 'assistant/message', time: now - 200, seq: 80,
    data: { usage: { inputTokens: 1, outputTokens: 1 }, message: { id: 'csv-formula', source: { model: hostileModel } } }
  })
  // Use a distinct normalized window so the earlier export cache is not hit.
  const csvResult = await request('/dash-api/export?range=custom&from=' + (from + 1) + '&to=' + now)
  const parseCsv = (text) => {
    const rows = []
    let row = [], cell = '', quoted = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
        else if (ch === '"') quoted = false
        else cell += ch
      } else if (ch === '"' && cell === '') {
        quoted = true
      } else if (ch === ',') {
        row.push(cell); cell = ''
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(cell); rows.push(row); row = []; cell = ''; i++
      } else cell += ch
    }
    if (quoted) throw new Error('export CSV left a quoted cell open')
    row.push(cell); rows.push(row)
    return rows
  }
  const rows = parseCsv(csvResult.csv)
  if (!rows.every((row) => row.length === 8)) throw new Error('export CSV contains a split or malformed field: ' + JSON.stringify(rows.map((row) => row.length)))
  if (!rows.some((row) => row[2] === "'" + hostileModel)) throw new Error('export CSV formula field lost its literal apostrophe or contents')
  if (rows.length - 1 !== csvResult.rows) throw new Error('export CSV row count differs from parsed records')
}

// --- list-param encoding (audit F14) ---
// `projects` values are project ids, i.e. the session cwd, and Windows paths can
// contain commas. The wire format used to be join(","), so the single project
// "D:/a,b" arrived as TWO projects and the filter silently matched nothing.
{
  const metaNow = await request('/dash-api/usage?range=custom&from=' + from + '&to=' + now)
  const realProjectId = (metaNow.meta.projects || []).map((p) => p.id).find((id) => id.indexOf('smoke') !== -1)
  if (!realProjectId) throw new Error('F14 fixture: smoke project id not found')
  if (realProjectId.indexOf(',') !== -1) throw new Error('F14 fixture: project id already contains a comma')
  const window = '&from=' + from + '&to=' + now

  // (a) a JSON array must actually be decoded as an array: send one real project
  // plus one unknown. Comma-splitting the JSON *text* instead would match nothing,
  // so this is the discriminating case for the decoder itself.
  const decoded = await request('/dash-api/usage?range=custom' + window +
    '&projects=' + encodeURIComponent(JSON.stringify([realProjectId, 'D:/does-not-exist'])))
  if (decoded.totals.sessions !== 1) {
    throw new Error('F14: JSON project array was not decoded (sessions=' + decoded.totals.sessions + ')')
  }

  // (b) a single project id containing a comma must stay ONE element.
  const jsonFiltered = await request('/dash-api/usage?range=custom' + window +
    '&projects=' + encodeURIComponent(JSON.stringify([realProjectId + ',extra'])))
  if (jsonFiltered.totals.sessions !== 0) {
    throw new Error('F14: a JSON-encoded project id containing a comma was split (sessions=' + jsonFiltered.totals.sessions + ')')
  }

  // (c) Backward compatibility: the legacy comma-joined form must keep splitting,
  // otherwise previously bookmarked links silently start matching nothing.
  const legacyFiltered = await request('/dash-api/usage?range=custom' + window +
    '&projects=' + encodeURIComponent(realProjectId + ',extra'))
  if (legacyFiltered.totals.sessions !== 1) {
    throw new Error('F14: legacy comma-joined project list stopped splitting (sessions=' + legacyFiltered.totals.sessions + ')')
  }
}

// --- bad-request contract (audit F29) ---
// An out-of-range custom window is a caller error, not a server fault: a 1200-year
// span exceeds the engine's trend-bucket cap (bucketSeries throws RangeError), so
// it must surface as 400 with a clean body rather than 500 internal_error.
// The span is expressed in years rather than as year 1 because Date.UTC maps
// years 0-99 to 1900+y, which would silently shrink the series below the cap.
{
  const overWide = await rawRequest('/dash-api/usage?range=custom&from=' +
    (now - 1200 * 365 * 86400000) + '&to=' + now, '127.0.0.1')
  if (overWide.status !== 400) {
    throw new Error('F29: over-wide custom range returned ' + overWide.status + ', expected 400')
  }
  if (JSON.parse(overWide.body).error !== 'bad_request') {
    throw new Error('F29: over-wide custom range body was ' + overWide.body)
  }
  // Reverse assertion: an ordinary custom window must stay 200 — the guard must
  // not degrade into "any custom range fails".
  const normal = await rawRequest('/dash-api/usage?range=custom&from=' + from + '&to=' + (now + 5), '127.0.0.1')
  if (normal.status !== 200) throw new Error('F29: normal custom range returned ' + normal.status)
}

// --- single-flight version stamp (audit F7) ---
// A compute must stamp its cache entry with the data version it STARTED from, not
// with the dataVersion at settle time. If it stamps the settle-time version, an
// event that lands while the compute is in flight is recorded as already
// reflected by that entry: the fast path then serves it as "current" for a full
// TTL and never revalidates.
//
// Reproducing this needs a compute that can actually be held in flight, which
// only happens while the rollup snapshot is cold (the first request awaits the
// materialisation pass). So this drives a second, independent host instance
// rather than perturbing the shared one, whose assertions are already fixed.
{
  const routes2 = new Map()
  let eventHandler2 = null
  let listCalls2 = 0
  let gateArmed = true
  let release = null
  const gate = new Promise((resolve) => { release = resolve })
  const base = Date.now()
  const header2 = { id: 'f7-session', cwd: 'D:/f7' }
  const events2 = [
    { type: 'user/message', time: base - 30000, seq: 1, data: { source: { kind: 'user' } } },
    { type: 'assistant/message', time: base - 29000, seq: 2, data: { usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } } }
  ]
  const services2 = {
    webServer: { register(definition) { routes2.set(definition.path, definition.handler) } },
    sessionQuery: {
      async listSessions() {
        listCalls2 += 1
        const snapshot = [{ header: header2, live: false, persisted: true }]
        if (gateArmed) { gateArmed = false; await gate }
        return snapshot
      },
      async readSession() { return { session: header2, events: events2, inheritedEventCount: 0 } }
    },
    sessionPersistence: {
      async open(id) { return { id, header: header2, read: async () => ({ eventState: 'shared-frozen', events: events2 }), close: async () => {} } },
      async requireStoredLog() { return { meta: header2, events: events2, inheritedEventCount: 0, status: 'current' } }
    },
    workspaceRegistry: { list() { return [{ path: header2.cwd, title: 'F7', sessionIds: [header2.id] }] } },
    sessions: { get() { return { header: header2, inheritedEventCount: 0, snapshotEvents: () => events2 } } },
    timer: { setInterval() { return () => {} }, timeout() { return () => {} } }
  }
  const ctx2 = {
    get(name) { return services2[name] },
    on(_name, handler) { eventHandler2 = handler },
    effect(fn) { return fn() || (() => {}) }
  }
  apply(ctx2, {})
  const raw2 = async (path) => {
    const handler = routes2.get(path.split('?')[0])
    if (!handler) throw new Error('missing route ' + path)
    let status = 0
    let body = ''
    await handler({ url: path, socket: { remoteAddress: '127.0.0.1' } }, {
      writeHead(code) { status = code },
      end(value) { body = String(value || '') }
    })
    return { status, body }
  }
  const f7Path = '/dash-api/usage?range=custom&from=' + (base - 60000) + '&to=' + base
  const realDateNow2 = Date.now
  Date.now = () => base
  try {
    // (1) cold first request: it blocks inside listSessions() before computing,
    //     so the version it starts from is observable.
    const p1 = raw2(f7Path)
    await flush()
    await flush()
    if (listCalls2 !== 1) throw new Error('F7 setup: cold compute did not reach the gated listing (calls=' + listCalls2 + ')')
    // (2) a metric event lands while that compute is still in flight → V → V+1
    eventHandler2({ id: header2.id, header: header2 }, {
      type: 'assistant/message', time: base - 20000, seq: 3,
      data: { usage: { inputTokens: 5, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
    })
    // (3) let it settle; it observed the version from BEFORE the event
    release()
    const r1 = await p1
    if (r1.status !== 200) throw new Error('F7: first request failed with ' + r1.status + ': ' + r1.body)
    await flush()
    // (4) +25 s is chosen so the entry is still inside its 30 s TTL (so only the
    //     version can decide fast path vs SWR) while the rollup snapshot (5 s)
    //     and the corpus-list throttle (20 s) have both lapsed, making the
    //     revalidate observable as a real listSessions() call.
    const callsBefore = listCalls2
    Date.now = () => base + 25000
    const r2 = await raw2(f7Path)
    if (r2.status !== 200) throw new Error('F7: second request failed with ' + r2.status)
    await flush()
    await flush()
    await flush()
    if (listCalls2 === callsBefore) {
      throw new Error('F7: entry was stamped with the post-event version — the fast path skipped revalidation')
    }
  } finally {
    Date.now = realDateNow2
  }
}

// --- empty corpus must prune state (audit: refreshCorpus early-returned) ---
// When the session list legitimately becomes EMPTY, the previously loaded
// rollups must disappear. The old early return on an empty list skipped the
// removal loop, so usage/detail/calendar/export kept serving deleted sessions
// until a later non-empty listing or a restart. A listing that could not run at
// all must still NOT be treated as "everything was deleted".
{
  const routes3 = new Map()
  let timerCb3 = null
  const base3 = Date.now()
  const live = { header: { id: 'gone-1', cwd: 'D:/gone' }, live: false, persisted: true }
  const events3 = [
    { type: 'user/message', time: base3 - 30000, seq: 1, data: { source: { kind: 'user' } } },
    { type: 'assistant/message', time: base3 - 29000, seq: 2, data: { usage: { inputTokens: 7, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'gpt-5' } } } }
  ]
  let list3 = [live]
  const services3 = {
    webServer: { register(definition) { routes3.set(definition.path, definition.handler) } },
    sessionQuery: { async listSessions() { return list3 }, async readSession() { return { session: live.header, events: events3 } } },
    sessionPersistence: { async requireStoredLog() { return { meta: live.header, events: events3, inheritedEventCount: 0, status: 'current' } } },
    workspaceRegistry: { list() { return [{ path: 'D:/gone', title: 'Gone', sessionIds: ['gone-1'] }] } },
    sessions: { get() { return null } },
    timer: { setInterval(cb) { timerCb3 = cb; return () => {} }, timeout() { return () => {} } }
  }
  const ctx3 = {
    get(name) { return services3[name] },
    on() {},
    effect(fn) { return fn() || (() => {}) }
  }
  apply(ctx3, {})
  const raw3 = async (path) => {
    const handler = routes3.get(path.split('?')[0])
    if (!handler) throw new Error('missing route ' + path)
    let status = 0
    let body = ''
    await handler({ url: path, socket: { remoteAddress: '127.0.0.1' } }, {
      writeHead(code) { status = code },
      end(value) { body = String(value || '') }
    })
    return { status, body }
  }
  const realNow3 = Date.now
  Date.now = () => base3
  try {
    const first = JSON.parse((await raw3('/dash-api/usage?range=custom&from=' + (base3 - 60000) + '&to=' + base3)).body)
    if (first.totals.sessions !== 1) throw new Error('empty-corpus setup: sessions=' + first.totals.sessions)
    // The corpus is now genuinely empty; drive the reconcile tick and step past
    // the 2× reconcile grace so removal is allowed.
    list3 = []
    Date.now = () => base3 + 3 * 60000
    if (typeof timerCb3 !== 'function') throw new Error('reconcile timer callback was not registered')
    timerCb3()
    await flush()
    await flush()
    // Distinct `to` => a fresh cache key (no stale-while-revalidate value).
    const after = JSON.parse((await raw3('/dash-api/usage?range=custom&from=' + (base3 - 60000) + '&to=' + (base3 + 1))).body)
    if (after.totals.sessions !== 0) {
      throw new Error('empty corpus did not prune state: sessions=' + after.totals.sessions)
    }
  } finally {
    Date.now = realNow3
  }
}

// --- session retry budget is CONSECUTIVE failures (audit: failCount never reset) ---
// Three transient I/O errors spread over time, each followed by a successful
// read, must not exhaust the 3-strike budget: the session is still retryable.
{
  const fsp = await import('node:fs')
  const os = await import('node:os')
  const pathMod = await import('node:path')
  const root = fsp.mkdtempSync(pathMod.join(os.tmpdir(), 'dash-smoke-'))
  try {
    const dir = pathMod.join(root, 'proj', 'session-flaky')
    fsp.mkdirSync(dir, { recursive: true })
    const logFile = pathMod.join(dir, 'session.v1.jsonl')
    let generation = 0
    // Vary the SIZE as well as the mtime: two writes inside the same millisecond
    // would otherwise share mtimeMs and be adopted from the disk rollup cache
    // instead of triggering the read we want to exercise.
    const writeLog = () => { generation += 1; fsp.writeFileSync(logFile, JSON.stringify({ generation, pad: 'x'.repeat(generation) }) + '\n') }
    writeLog()

    const routes4 = new Map()
    let timerCb4 = null
    let readCalls = 0
    // fail, ok, fail, ok, fail → with a resetting budget the last failure leaves
    // failCount = 1 (still retryable); without it failCount = 3 (given up).
    const plan = ['fail', 'ok', 'fail', 'ok', 'fail']
    const base4 = Date.now()
    const events4 = [
      { type: 'user/message', time: base4 - 30000, seq: 1, data: { source: { kind: 'user' } } },
      { type: 'assistant/message', time: base4 - 29000, seq: 2, data: { usage: { inputTokens: 7, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'gpt-5' } } } }
    ]
    const services4 = {
      webServer: { register(definition) { routes4.set(definition.path, definition.handler) } },
      sessionPersistence: {
        root,
        async requireStoredLog() {
          const outcome = plan[readCalls] || 'ok'
          readCalls += 1
          if (outcome === 'fail') throw new Error('transient I/O error')
          return { meta: { id: 'session-flaky', cwd: 'D:/flaky' }, events: events4, inheritedEventCount: 0, status: 'current' }
        }
      },
      workspaceRegistry: { list() { return [] } },
      sessions: { get() { return null } },
      timer: { setInterval(cb) { timerCb4 = cb; return () => {} }, timeout() { return () => {} } }
    }
    const ctx4 = { get(name) { return services4[name] }, on() {}, effect(fn) { return fn() || (() => {}) } }
    apply(ctx4, {})
    const raw4 = async (path) => {
      const handler = routes4.get(path.split('?')[0])
      if (!handler) throw new Error('missing route ' + path)
      let status = 0
      let body = ''
      await handler({ url: path, socket: { remoteAddress: '127.0.0.1' } }, {
        writeHead(code) { status = code },
        end(value) { body = String(value || '') }
      })
      return { status, body }
    }
    const realNow4 = Date.now
    let clock = base4
    Date.now = () => clock
    try {
      // Poll rather than assuming a fixed number of microtask turns: the reload
      // goes through a background pass that also writes the disk cache.
      const waitReads = async (n) => {
        for (let i = 0; i < 500 && readCalls < n; i++) await flush()
        if (readCalls < n) throw new Error('retry-budget fixture stalled at ' + readCalls + ' reads (wanted ' + n + ')')
      }
      const tick = async (n, expectReads) => {
        clock = base4 + n * 60000
        if (typeof timerCb4 === 'function') timerCb4()
        await waitReads(expectReads)
      }
      // 1) first read fails → dead with one strike
      await raw4('/dash-api/usage?range=custom&from=' + (base4 - 60000) + '&to=' + base4)
      await waitReads(1)
      // 2) revive + successful read (budget resets)
      await tick(2, 2)
      // 3) file changed + read fails again
      writeLog(); await tick(4, 3)
      // 4) revive + successful read (budget resets again)
      await tick(6, 4)
      // 5) file changed + third (non-consecutive) failure
      writeLog(); await tick(8, 5)
      const health = JSON.parse((await raw4('/dash-api/usage?range=custom&from=' + (base4 - 60000) + '&to=' + (base4 + 1))).body).meta.sessionHealth
      if (health.dead !== 1) throw new Error('retry-budget fixture: expected 1 dead session, got ' + JSON.stringify(health) + ' (reads=' + readCalls + ')')
      if (health.retryPending !== 1) {
        throw new Error('failure budget was not reset by a successful read: ' + JSON.stringify(health))
      }
      // The full fail/ok/fail/ok/fail sequence must have run: with only 3 reads
      // the fixture would pass even without the reset (fail, ok, fail → 2).
      if (readCalls !== 5) throw new Error('retry-budget fixture performed ' + readCalls + ' reads, expected 5')
    } finally {
      Date.now = realNow4
    }
  } finally {
    fsp.rmSync(root, { recursive: true, force: true })
  }
}

// --- usage cache key whitelist (unbounded key minting) ---
// The usage normalizer must build an explicit parameter object. Spreading every
// URL parameter let `?junk=1`, `?junk=2`, … mint unlimited cache entries that
// each cost a full corpus pass while changing nothing.
{
  const hostCode = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  if (/\.\.\.\s*input/.test(hostCode)) {
    throw new Error('host bundle spreads raw query params into a cache key (unbounded key space)')
  }
}

console.log('host smoke passed')
console.log('  cache/event regressions     OK')
console.log('  routes survive no timer     OK')
console.log('  loopback guard              OK')
console.log('  cache key namespace         OK')
console.log('  export one-pass path        OK')
console.log('  client contract check       OK')
console.log('  list-param comma encoding   OK')
console.log('  bad-request 400 contract    OK')
console.log('  single-flight version stamp OK')
console.log('  empty corpus prunes state   OK')
console.log('  session retry budget resets OK')
console.log('  usage cache key whitelist   OK')
