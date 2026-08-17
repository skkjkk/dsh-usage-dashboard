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
const services = {
  webServer: { register(definition) { routes.set(definition.path, definition.handler) } },
  sessionQuery: {
    async listSessions() { return [{ header, live: false, persisted: true }] }
  },
  sessionPersistence: {
    async readFrom() { return { meta: header, events } }
  },
  workspaceRegistry: {
    list() { return [{ path: cwd, title: 'Smoke Project', sessionIds: [sessionId] }] }
  },
  sessions: { get() { return null } }
}
const ctx = {
  get(name) { return services[name] },
  on() {},
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

const usage = await request('/dash-api/usage?range=custom&from=' + from + '&to=' + now)
if (usage.totals.activeMs !== 1000) throw new Error('activeMs expected 1000, got ' + usage.totals.activeMs)
if (usage.totals.totalMs !== 14000) throw new Error('totalMs expected 14000, got ' + usage.totals.totalMs)
if (usage.meta.projects.length !== 1 || usage.meta.projects[0].title !== 'Smoke Project') {
  throw new Error('workspace project mapping failed: ' + JSON.stringify(usage.meta.projects))
}
if (usage.meta.dist.projects.length !== 1 || usage.meta.dist.projects[0].label !== 'Smoke Project') {
  throw new Error('project distribution failed: ' + JSON.stringify(usage.meta.dist.projects))
}
console.log('host smoke passed')
