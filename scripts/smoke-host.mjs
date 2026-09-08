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
    }
  },
  sessionPersistence: {
    async readFrom(id) {
      return { meta: id === sessionId ? header : { id }, events: id === sessionId ? events : [] }
    }
  },
  workspaceRegistry: {
    list() { return [{ path: cwd, title: 'Smoke Project', sessionIds: [sessionId] }] }
  },
  sessions: { get() { return null } }
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

// A metric event invalidates the cache and becomes visible on the next query.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/message', time: now - 1000, seq: 8,
  data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
})
const fresh = await request(queryPath)
if (fresh.totals.assistantMessages !== 3) throw new Error('metric event was not appended')
const callsAfterMetric = listCalls

// A non-finish chunk updates open generation state but must not flush the cache.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/chunk', time: now - 800, seq: 9,
  data: { turn: 1, step: 0, chunk: { type: 'text-delta', index: 0, text: 'partial' } }
})
const cached = await request(queryPath)
if (listCalls !== callsAfterMetric) throw new Error('non-metric chunk unexpectedly flushed the cache')
if (cached.totals.assistantMessages !== 3) throw new Error('cached metric result changed unexpectedly')

// A listed session survives an omission when the list snapshot lags a prior event.
listVisible = false
eventHandler({ id: sessionId, header }, {
  type: 'assistant/message', time: now - 700, seq: 10,
  data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
})
const listedLag = await request(queryPath)
if (listedLag.totals.sessions !== 1) throw new Error('listed session was dropped by a lagging list')
listVisible = true

// An event-created session survives the first lagging list snapshot.
const eventSessionId = 'event-created'
const eventHeader = { id: eventSessionId, cwd: 'D:/event-project' }
eventHandler({ id: eventSessionId, header: eventHeader }, {
  type: 'user/message', time: now - 500, seq: 1, data: { source: { kind: 'user' } }
})
await new Promise((resolve) => setTimeout(resolve, 0))
const withEventSession = await request(queryPath)
if (withEventSession.totals.sessions !== 2) throw new Error('event-created session was dropped by a lagging list')

// Once a later list still omits it and the recent-event grace has elapsed, it is collectable.
const realDateNow = Date.now
Date.now = () => now + 3 * 60000
try {
  const afterMissingSession = await request(queryPath + '&cleanup=1')
  if (afterMissingSession.totals.sessions !== 1) throw new Error('deleted session state was retained forever')
} finally {
  Date.now = realDateNow
}

console.log('host smoke passed')
console.log('  cache/event regressions     OK')
