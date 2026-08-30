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
  { type: 'tool/result', time: from + 14000, seq: 7, data: { message: { source: { callId: 'tool-0' } } } }
]
const header = { id: sessionId, cwd, createdAt: from }
const routes = new Map()
let eventHandler = null
let listCalls = 0
let listVisible = true
const services = {
  webServer: { register(definition) { routes.set(definition.path, definition.handler) } },
  sessionQuery: {
    async listSessions() {
      listCalls += 1
      return listVisible ? [{ header, live: false, persisted: true }] : []
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
if (usage.totals.activeMs !== 1000) throw new Error('activeMs expected 1000, got ' + usage.totals.activeMs)
if (usage.totals.totalMs !== 14000) throw new Error('totalMs expected 14000, got ' + usage.totals.totalMs)
if (usage.meta.projects.length !== 1 || usage.meta.projects[0].title !== 'Smoke Project') {
  throw new Error('workspace project mapping failed: ' + JSON.stringify(usage.meta.projects))
}
if (usage.meta.dist.projects.length !== 1 || usage.meta.dist.projects[0].label !== 'Smoke Project') {
  throw new Error('project distribution failed: ' + JSON.stringify(usage.meta.dist.projects))
}
if (listCalls !== 1) throw new Error('initial list call count expected 1, got ' + listCalls)

// A metric event invalidates the cache and becomes visible on the next query.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/message', time: now - 1000, seq: 8,
  data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
})
const fresh = await request(queryPath)
if (fresh.totals.assistantMessages !== 2) throw new Error('metric event was not appended')
const callsAfterMetric = listCalls

// A non-finish chunk updates open generation state but must not flush the cache.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/chunk', time: now - 800, seq: 9,
  data: { turn: 1, step: 0, chunk: { type: 'text-delta', index: 0, text: 'partial' } }
})
const cached = await request(queryPath)
if (listCalls !== callsAfterMetric) throw new Error('non-metric chunk unexpectedly flushed the cache')
if (cached.totals.assistantMessages !== 2) throw new Error('cached metric result changed unexpectedly')

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

// Once a later list still omits it and no newer event arrived, it is collectable.
eventHandler({ id: sessionId, header }, {
  type: 'assistant/message', time: now - 200, seq: 10,
  data: { usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { model: 'deepseek-v4-flash' } } }
})
const afterMissingSession = await request(queryPath)
if (afterMissingSession.totals.sessions !== 1) throw new Error('deleted session state was retained forever')

console.log('host smoke passed')
console.log('  cache/event regressions     OK')
