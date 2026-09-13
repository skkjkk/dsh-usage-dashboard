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

async function request(path) {
  const handler = routes.get(path.split('?')[0])
  if (!handler) throw new Error('missing route ' + path)
  let status = 0
  let body = ''
  await handler({ url: path }, {
    writeHead(code) { status = code },
    end(value) { body = String(value || '') }
  })
  if (status !== 200) throw new Error('route failed ' + status + ': ' + body)
  return JSON.parse(body)
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
  const afterPoison = await request(queryPath + '&poison=1')
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
    const withEventSession = await request(queryPath + '&freshkey=1')
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
  await request(queryPath + '&cleanup=1')
  await flush()
  await flush()
  Date.now = () => now + 4 * 60000
  const afterMissingSession = await request(queryPath + '&cleanup=1&settled=1')
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
}

console.log('host smoke passed')
console.log('  cache/event regressions     OK')
console.log('  routes survive no timer     OK')
console.log('  client contract check       OK')
