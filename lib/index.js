// dsh-usage-dashboard — host half (adapted from the src/host.js prototype).
// Registers three JSON GET routes under /dash-api/* serving usage aggregation
// over the local session store (sessionQuery / sessionPersistence / workspaceRegistry).

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

    // 定价表：CSV 美元×7 折算人民币；deepseek-v4-flash 用 DeepSeek 官网官方人民币价 [输入, 输出, 缓存命中] ¥/百万 tokens
    const PRICES = {"claude-3-haiku":[1.75,8.75,0.21],"claude-3-opus":[105,525,10.5],"claude-3.5-haiku":[5.6,28,0.56],"claude-3.5-sonnet":[21,105,2.1],"claude-3.7-sonnet":[21,105,2.1],"claude-fable-5":[70,350,7],"claude-haiku-4-5":[7,35,0.7],"claude-mythos-5":[70,350,7],"claude-opus-4":[105,525,10.5],"claude-opus-4-1":[105,525,10.5],"claude-opus-4-5":[35,175,3.5],"claude-opus-4-6":[35,175,3.5],"claude-opus-4-7":[35,175,3.5],"claude-opus-4-8":[35,175,3.5],"claude-opus-4-8-fast":[70,350,7],"claude-opus-5":[35,175,3.5],"claude-opus-5-fast":[70,350,7],"claude-sonnet-4":[21,105,2.1],"claude-sonnet-4-5":[21,105,2.1],"claude-sonnet-4-6":[21,105,2.1],"claude-sonnet-5":[14,70,1.4],"codex-mini-latest":[10.5,42,2.625],"gpt-3.5-turbo":[3.5,10.5,0],"gpt-4":[210,420,0],"gpt-4-turbo":[70,210,0],"gpt-4.1":[14,56,3.5],"gpt-4.1-mini":[2.8,11.2,0.7],"gpt-4.1-nano":[0.7,2.8,0.175],"gpt-4o":[17.5,70,8.75],"gpt-4o-mini":[1.05,4.2,0.525],"gpt-5":[8.75,70,0.875],"gpt-5-codex":[8.75,70,0.875],"gpt-5-mini":[1.75,14,0.175],"gpt-5-nano":[0.35,2.8,0.035],"gpt-5.1":[8.75,70,0.875],"gpt-5.1-codex":[8.75,70,0.875],"gpt-5.1-codex-max":[8.75,70,0.875],"gpt-5.1-codex-mini":[1.75,14,0.175],"gpt-5.2":[12.25,98,1.225],"gpt-5.2-codex":[12.25,98,1.225],"gpt-5.3-codex":[12.25,98,1.225],"gpt-5.4":[17.5,105,1.75],"gpt-5.4-codex":[17.5,105,1.75],"gpt-5.4-mini":[5.25,31.5,0.525],"gpt-5.4-nano":[1.4,8.75,0.14],"gpt-5.4-pro":[210,1260,0],"gpt-5.5":[35,210,3.5],"gpt-5.5-codex":[17.5,105,1.75],"gpt-5.5-fast":[87.5,525,8.75],"gpt-5.5-flex":[17.5,105,1.75],"gpt-5.5-pro":[210,1260,0],"gpt-5.6-cyber":[87.5,525,8.75],"gpt-5.6-luna":[1.4,8.4,0.14],"gpt-5.6-luna-batch":[0.7,4.2,0.07],"gpt-5.6-luna-fast":[2.8,16.8,0.28],"gpt-5.6-luna-flex":[0.7,4.2,0.07],"gpt-5.6-sol":[35,210,3.5],"gpt-5.6-sol-batch":[17.5,105,1.75],"gpt-5.6-sol-fast":[70,420,7],"gpt-5.6-sol-flex":[17.5,105,1.75],"gpt-5.6-terra":[14,84,1.4],"gpt-5.6-terra-batch":[7,42,0.7],"gpt-5.6-terra-fast":[28,168,2.8],"gpt-5.6-terra-flex":[7,42,0.7],"o1":[105,420,52.5],"o1-mini":[7.7,30.8,3.85],"o1-preview":[105,420,52.5],"o3":[14,56,3.5],"o3-mini":[7.7,30.8,3.85],"o3-pro":[140,560,0],"o4-mini":[7.7,30.8,1.925],"gemini-1.5-flash":[0.525,2.1,0.1313],"gemini-1.5-pro":[24.5,73.5,0],"gemini-2.0-flash":[0.7,2.8,0.175],"gemini-2.0-flash-lite":[0.525,2.1,0.1313],"gemini-2.5-flash":[2.1,17.5,0.21],"gemini-2.5-flash-lite":[0.7,2.8,0.07],"gemini-2.5-pro":[8.75,70,0.875],"gemini-3-flash":[3.5,21,0.35],"gemini-3-flash-preview":[3.5,21,0.35],"gemini-3-pro":[14,84,1.4],"gemini-3-pro-preview":[14,84,1.4],"gemini-3.1-flash-lite":[1.75,10.5,0.175],"gemini-3.1-flash-lite-preview":[1.75,10.5,0.175],"gemini-3.1-pro":[14,84,1.4],"gemini-3.1-pro-preview":[14,84,1.4],"gemini-3.5-flash":[10.5,63,1.05],"gemini-3.5-flash-lite":[2.1,17.5,0.21],"gemini-3.5-flash-preview":[10.5,63,1.05],"gemini-3.6-flash":[10.5,52.5,1.05],"gemini-3.7-flash":[10.5,52.5,1.05],"gemini-3.7-flash-batch":[5.25,26.25,0.525],"gemini-3.7-flash-fast":[18.9,94.5,1.89],"gemini-3.7-flash-flex":[5.25,26.25,0.525],"muse-spark-1.1":[8.75,29.75,1.05],"deepseek-chat":[0.98,1.96,0.0196],"deepseek-coder":[0.98,1.96,0],"deepseek-r1":[3.85,15.33,0.98],"deepseek-reasoner":[0.98,1.96,0.0196],"deepseek-v3":[1.89,7.7,0.49],"deepseek-v3.1":[3.92,11.76,0.49],"deepseek-v3.2":[1.96,2.94,0.196],"deepseek-v4-flash":[0.56,1.4,0.028],"deepseek-v4-pro":[9.24,27.72,0.308],"qwen-coder":[2.1,10.5,0],"qwen-max":[11.2,44.8,0],"qwen-plus":[2.8,8.4,0],"qwen-turbo":[0.35,1.4,0],"qwen3-coder-next":[4.2,16.8,0],"qwen3-coder-plus":[2.8,11.2,0],"qwen3-max":[8.4,42,1.68],"qwen3.5-plus":[2.8,8.4,0],"qwen3.6-flash":[1.75,10.5,0],"qwen3.6-plus":[1.96,11.69,0.392],"qwen3.7-flash":[0.21,0.91,0.042],"qwen3.7-max":[17.5,52.5,0],"qwen3.7-plus":[2.8,11.2,0],"qwen3.8-max":[14,42,1.75],"glm-4.5":[4.2,15.4,0.77],"glm-4.5-air":[1.4,7.7,0.21],"glm-4.5-airx":[7.7,31.5,0],"glm-4.5-x":[15.4,62.3,0],"glm-4.5v":[4.2,12.6,0],"glm-4.6":[4.2,15.4,0.77],"glm-4.7":[4.2,15.4,0.77],"glm-4.7-flashx":[0.49,2.8,0.07],"glm-5":[7,22.4,1.4],"glm-5-code":[8.4,35,2.1],"glm-5-turbo":[8.4,28,1.68],"glm-5.1":[9.8,30.8,1.82],"glm-5.2":[9.8,30.8,1.82],"glm-5v-turbo":[8.4,28,1.68],"k2p6":[6.65,28,1.12],"kimi-for-coding":[4.2,21,0.7],"kimi-for-coding-highspeed":[12.6,63,2.1],"kimi-k2":[4.2,17.5,1.05],"kimi-k2.5":[4.2,21,0.7],"kimi-k2.6":[6.65,28,1.12],"kimi-k2.7-code":[6.65,28,1.33],"kimi-k3":[21,105,2.1],"moonshot-v1-128k":[14,35,0],"moonshot-v1-32k":[7,21,0],"moonshot-v1-8k":[1.4,14,0],"minimax-m2":[2.1,8.4,0.21],"minimax-m2.1":[2.1,8.4,0.21],"minimax-m2.5":[2.1,8.4,0.21],"minimax-m2.7":[2.1,8.4,0.42],"minimax-m2.7-highspeed":[4.2,16.8,0.42],"minimax-m3":[4.2,16.8,0.84],"codestral-2508":[2.1,6.3,0],"ministral-14b-2512":[1.4,1.4,0],"ministral-3b-2512":[0.7,0.7,0],"ministral-8b-2512":[1.05,1.05,0],"mistral-large-2512":[3.5,10.5,0],"mistral-medium-3-5":[10.5,52.5,0],"mistral-small-2603":[1.05,4.2,0],"grok-3-beta":[21,105,5.25],"grok-4":[21,105,5.25],"grok-4-0709":[21,105,5.25],"grok-4-fast-non-reasoning":[1.4,3.5,0.35],"grok-4-fast-reasoning":[1.4,3.5,0.35],"grok-4.20":[8.75,17.5,1.4],"grok-4.20-multi-agent":[8.75,17.5,1.4],"grok-4.20-non-reasoning":[8.75,17.5,1.4],"grok-4.20-reasoning":[8.75,17.5,1.4],"grok-4.3":[8.75,17.5,1.4],"grok-4.5":[14,42,2.1],"grok-4.6":[14,42,3.5],"grok-build-0.1":[7,14,1.4],"grok-code-fast-1":[1.4,10.5,0.14],"auto":[8.75,42,1.75],"composer-1":[8.75,70,0.875],"composer-1.5":[24.5,122.5,2.45],"composer-2":[3.5,17.5,1.4],"composer-2.5":[3.5,17.5,1.4],"hy3":[1.05,4.13,0.2625],"hy3-preview":[1.26,4.13,0.42],"doubao-lite-128k":[0.287,0.581,0.056],"doubao-pro-128k":[0.777,1.939,0.154],"doubao-seed-2.0-code":[3.143,15.974,0.63],"doubao-seed-2.0-lite":[0.581,3.486,0.119],"doubao-seed-2.0-mini":[0.196,1.939,0.042],"doubao-seed-2.0-pro":[3.094,15.491,0.616],"doubao-seed-2.1-pro":[5.803,29.029,1.162],"doubao-seed-2.1-turbo":[2.905,14.511,0.581],"doubao-seed-code":[1.162,7.742,0.231],"mimo-v2-flash":[0.7,2.1,0.07],"mimo-v2-omni":[2.8,14,0.56],"mimo-v2-pro":[7,21,1.4],"mimo-v2.5":[0.98,1.96,0.0196],"mimo-v2.5-pro":[3.045,6.09,0.0252],"mimo-v2.5-pro-ultraspeed":[9.135,18.27,0.0756],"step-3.5-flash":[0.7,2.1,0.14],"step-3.7-flash":[1.4,8.05,0.28],"ling-2.6-1t":[4.375,17.5,0],"ling-2.6-flash":[0.581,1.75,0],"ling-3.0-flash":[0.483,1.456,0],"ring-2.6-1t":[4.375,17.5,0],"longcat-2.0":[4.858,19.446,0.098],"agnes-2.0-flash":[0.21,1.05,0],"agnes-2.5-flash":[0.21,1.05,0],"agnes-2.5-pro":[3.15,6.3,0.0266],"agnes-2.5-pro-alpha":[3.15,6.3,0.0266]}

    // 模型 → 定价；未匹配返回 null（不计费）
    function priceFor(model) {
      const id = String(model || '')
      if (!id) return null
      if (PRICES[id]) return { matched: id, p: PRICES[id] }
      const stripped = id.replace(/-free$/, '')
      if (stripped !== id && PRICES[stripped]) return { matched: stripped, p: PRICES[stripped] }
      return null
    }

    // 请求缓存：key → { at, data }；TTL 5 分钟，过期时 stale-while-revalidate
    const cache = new Map()
    const TTL = 5 * 60 * 1000
    // 会话事件缓存：同一筛选只解压读取一次，5 分钟内切换时间范围秒回（过期后台刷新）
    const eventsCache = new Map()
    const EVENTS_TTL = 5 * 60 * 1000

    function num(v) {
      return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
    }
    function pad2(n) { return n < 10 ? '0' + n : String(n) }
    function mondayOf(t) {
      const d = new Date(t)
      const day = (d.getDay() + 6) % 7
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime()
    }
    function cellOf(t) {
      const d = new Date(t)
      return d.getDay() * 24 + d.getHours()
    }
    function weekLabel(monday) {
      const s = new Date(monday)
      const e = new Date(monday + 6 * 86400000)
      return (s.getMonth() + 1) + '/' + s.getDate() + '-' + (e.getMonth() + 1) + '/' + e.getDate()
    }
    function rangeBounds(req) {
      const now = Date.now()
      const d = new Date()
      const sod = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      switch (req.range) {
        case 'today': return [sod, now]
        case '24h': return [now - 86400000, now]
        case '7d': return [now - 7 * 86400000, now]
        case '30d': return [now - 30 * 86400000, now]
        case '90d': return [now - 90 * 86400000, now]
        case 'custom': return [req.from || 0, req.to || now]
        default: return [0, now]
      }
    }
    // 环比窗口：今天 → 昨天整天；其余 → 等长前移
    function prevWindow(range, lo, hi) {
      if (range === 'today') return [lo - 86400000, lo]
      const span = hi - lo
      return [lo - span, lo]
    }
    function pickGranularity(req, lo, hi) {
      if (req.range === 'today' || req.range === '24h') return 'hour'
      if (req.range === '7d' || req.range === '30d') return 'day'
      if (req.range === '90d') return 'week'
      const span = hi - lo
      if (span <= 48 * 3600000) return 'hour'
      if (span <= 62 * 86400000) return 'day'
      return 'week'
    }
    function bucketKey(t, gran) {
      const d = new Date(t)
      if (gran === 'hour') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime()
      if (gran === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return mondayOf(t)
    }
    function bucketLabel(key, gran) {
      const d = new Date(key)
      if (gran === 'hour') return pad2(d.getHours())
      if (gran === 'day') return (d.getMonth() + 1) + '/' + d.getDate()
      return weekLabel(key)
    }
    function bucketSeries(lo, hi, gran) {
      const keys = []
      const step = gran === 'hour' ? 3600000 : gran === 'day' ? 86400000 : 7 * 86400000
      let k = bucketKey(lo, gran)
      const end = bucketKey(hi, gran)
      let guard = 0
      while (k <= end && guard < 500) {
        keys.push(k)
        k += step
        guard += 1
      }
      return keys
    }

    // 折叠单条会话（仅范围内事件；modelSet 为 null 表示全部模型）
    function processSession(events, lo, hi, modelSet, gran) {
      const out = {
        cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, activeMs: 0,
        matchedTokens: 0, totalUsageTokens: 0,
        inRange: false,
        userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0,
        buckets: new Map(),
        bucketSpan: new Map(),
        heatToken: new Array(168).fill(0),
        heatCost: new Array(168).fill(0),
        heatDur: new Array(168).fill(0),
        times: [],
        models: new Map()
      }
      const openSteps = new Map()
      const pendingCalls = new Map()
      for (const ev of events) {
        const t = ev.time
        if (t < lo || t > hi) continue
        out.inRange = true
        switch (ev.type) {
          case 'user/message': {
            const src = ev.data && ev.data.source
            if (src && src.kind === 'user') out.userMessages += 1
            else out.injectedMessages += 1
            out.times.push(t)
            break
          }
          case 'assistant/message': {
            out.assistantMessages += 1
            out.times.push(t)
            const stepKey = ev.data.turn + ':' + ev.data.step
            if (openSteps.has(stepKey)) {
              out.activeMs += Math.max(0, t - openSteps.get(stepKey))
              openSteps.delete(stepKey)
            }
            const usage = ev.data.usage
            if (usage) {
              const msg = ev.data.message
              const model = msg && msg.source ? String(msg.source.model || '') : ''
              const pr = priceFor(model)
              const inp = num(usage.inputTokens)
              const otp = num(usage.outputTokens)
              const cr = num(usage.cacheReadTokens)
              const cw = num(usage.cacheWriteTokens)
              let costIn = 0, costOut = 0, costCache = 0
              if (pr) {
                costIn = inp * pr.p[0] / 1e6
                costOut = otp * pr.p[1] / 1e6
                costCache = (cr * pr.p[2] + cw * pr.p[0]) / 1e6
              }
              // 模型汇总（不受模型过滤影响，供下拉选项与定价弹窗）
              let mm = out.models.get(model)
              if (!mm) {
                mm = { id: model, calls: 0, input: 0, output: 0, cache: 0, cost: 0, matched: pr ? pr.matched : null, p: pr ? pr.p : null }
                out.models.set(model, mm)
              }
              mm.calls += 1
              mm.input += inp
              mm.output += otp
              mm.cache += cr + cw
              mm.cost += costIn + costOut + costCache
              out.totalUsageTokens += inp + otp + cr + cw
              if (pr) out.matchedTokens += inp + otp + cr + cw
              if (modelSet !== null && !modelSet.has(model)) break
              out.cost += costIn + costOut + costCache
              out.inputTokens += inp
              out.outputTokens += otp
              out.cacheTokens += cr + cw
              const bk = bucketKey(t, gran)
              let b = out.buckets.get(bk)
              if (!b) {
                b = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
                out.buckets.set(bk, b)
              }
              b.input += inp
              b.output += otp
              b.cache += cr + cw
              b.costIn += costIn
              b.costOut += costOut
              b.costCache += costCache
              const c = cellOf(t)
              out.heatToken[c] += inp + otp + cr + cw
              out.heatCost[c] += costIn + costOut + costCache
            }
            break
          }
          case 'tool/call': {
            out.toolCalls += 1
            out.times.push(t)
            if (ev.data && ev.data.callId) pendingCalls.set(ev.data.callId, t)
            break
          }
          case 'tool/result': {
            out.toolResults += 1
            out.times.push(t)
            const src = ev.data && ev.data.message && ev.data.message.source
            if (src && src.callId && pendingCalls.has(src.callId)) {
              out.activeMs += Math.max(0, t - pendingCalls.get(src.callId))
              pendingCalls.delete(src.callId)
            }
            break
          }
          case 'step/start': {
            const stepKey = ev.data.turn + ':' + ev.data.step
            openSteps.set(stepKey, t)
            break
          }
          default:
            break
        }
      }
      out.times.sort((a, b) => a - b)
      for (let k = 0; k < out.times.length; k++) {
        const t = out.times[k]
        const bk = bucketKey(t, gran)
        let sp = out.bucketSpan.get(bk)
        if (!sp) { sp = { first: t, last: t }; out.bucketSpan.set(bk, sp) }
        if (t < sp.first) sp.first = t
        if (t > sp.last) sp.last = t
        if (k < out.times.length - 1) {
          const gap = out.times[k + 1] - t
          if (gap > 0 && gap <= 600000) {
            out.heatDur[cellOf(t)] += gap
            let b = out.buckets.get(bk)
            if (!b) {
              b = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
              out.buckets.set(bk, b)
            }
            b.durMs += gap
          }
        }
      }
      for (const [bk, sp] of out.bucketSpan) {
        let b = out.buckets.get(bk)
        if (!b) {
          b = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
          out.buckets.set(bk, b)
        }
        b.totalMs = Math.max(0, sp.last - sp.first)
        b.sessions = 1
      }
      return out
    }

    // 纯内存窗口聚合（事件已加载，不碰磁盘）
    function computeWindow(loaded, targets, lo, hi, modelSet, gran) {
      const totals = {
        cost: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0,
        activeMs: 0, totalMs: 0, sessions: 0,
        userMessages: 0, injectedMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, totalMessages: 0
      }
      const bucketMap = new Map()
      const heatToken = new Array(168).fill(0)
      const heatCost = new Array(168).fill(0)
      const heatDur = new Array(168).fill(0)
      const modelAgg = new Map()
      const projectAgg = new Map()
      let matchedTokens = 0
      let totalUsageTokens = 0

      for (let i = 0; i < loaded.length; i++) {
        const events = loaded[i]
        if (!events) continue
        const r = processSession(events, lo, hi, modelSet, gran)
        if (r.inRange) {
          totals.sessions += 1
          if (Number.isFinite(r.last) && r.last > r.first) totals.totalMs += r.last - r.first
        }
        totals.cost += r.cost
        totals.inputTokens += r.inputTokens
        totals.outputTokens += r.outputTokens
        totals.cacheTokens += r.cacheTokens
        totals.activeMs += r.activeMs
        totals.userMessages += r.userMessages
        totals.injectedMessages += r.injectedMessages
        totals.assistantMessages += r.assistantMessages
        totals.toolCalls += r.toolCalls
        totals.toolResults += r.toolResults
        matchedTokens += r.matchedTokens
        totalUsageTokens += r.totalUsageTokens
        {
          const cwd = (targets[i].header && targets[i].header.cwd) || ''
          let pg = projectAgg.get(cwd)
          if (!pg) { pg = { input: 0, output: 0, cache: 0, cost: 0 }; projectAgg.set(cwd, pg) }
          pg.input += r.inputTokens
          pg.output += r.outputTokens
          pg.cache += r.cacheTokens
          pg.cost += r.cost
        }
        for (const [model, mm] of r.models) {
          let g = modelAgg.get(model)
          if (!g) { g = { id: model, calls: 0, input: 0, output: 0, cache: 0, cost: 0, matched: mm.matched, p: mm.p }; modelAgg.set(model, g) }
          g.calls += mm.calls
          g.input += mm.input
          g.output += mm.output
          g.cache += mm.cache
          g.cost += mm.cost
        }
        for (const [bk, b] of r.buckets) {
          let g = bucketMap.get(bk)
          if (!g) {
            g = { input: 0, output: 0, cache: 0, costIn: 0, costOut: 0, costCache: 0, durMs: 0, totalMs: 0, sessions: 0 }
            bucketMap.set(bk, g)
          }
          g.input += b.input
          g.output += b.output
          g.cache += b.cache
          g.costIn += b.costIn
          g.costOut += b.costOut
          g.costCache += b.costCache
          g.durMs += b.durMs
          g.totalMs += b.totalMs
          g.sessions += b.sessions
        }
        for (let k = 0; k < 168; k++) {
          heatToken[k] += r.heatToken[k]
          heatCost[k] += r.heatCost[k]
          heatDur[k] += r.heatDur[k]
        }
      }

      totals.totalTokens = totals.inputTokens + totals.outputTokens + totals.cacheTokens
      totals.totalMessages = totals.userMessages + totals.injectedMessages + totals.assistantMessages + totals.toolCalls + totals.toolResults

      const keys = bucketSeries(lo, hi, gran)
      const buckets = keys.map((bk) => {
        const b = bucketMap.get(bk)
        return {
          label: bucketLabel(bk, gran),
          input: b ? b.input : 0,
          output: b ? b.output : 0,
          cache: b ? b.cache : 0,
          costIn: b ? b.costIn : 0,
          costOut: b ? b.costOut : 0,
          costCache: b ? b.costCache : 0,
          durMs: b ? b.durMs : 0,
          totalMs: b ? b.totalMs : 0,
          sessions: b ? b.sessions : 0
        }
      })
      return {
        totals, buckets, heat: { token: heatToken, cost: heatCost, dur: heatDur },
        models: Array.from(modelAgg.values()).sort((a, b) => b.cost - a.cost),
        projectAgg, matchedTokens, totalUsageTokens
      }
    }

    // 加载全部会话事件（每筛选只读一次，5 分钟缓存）
    async function getLoaded(projectSet) {
      const key = JSON.stringify({ ps: projectSet ? Array.from(projectSet).sort() : null })
      const now = Date.now()
      const hit = eventsCache.get(key)
      if (hit && now - hit.at < EVENTS_TTL) return hit.data
      if (hit) {
        getLoadedUncached(projectSet, key).catch(() => {})
        return hit.data
      }
      return getLoadedUncached(projectSet, key)
    }
    async function getLoadedUncached(projectSet, key) {
      const q = ctx.get('sessionQuery')
      const persist = ctx.get('sessionPersistence')
      const wr = ctx.get('workspaceRegistry')
      const pathTitle = new Map()
      try {
        if (wr) for (const w of wr.list()) pathTitle.set(w.path, w.title)
      } catch (e) { /* 忽略 */ }

      const records = await q.listSessions()
      const targets = records.slice(0, 300)
      const loaded = new Array(targets.length).fill(null)
      let cursor = 0
      async function worker() {
        while (cursor < targets.length) {
          const idx = cursor++
          const rec = targets[idx]
          const cwd = rec.header.cwd || ''
          if (projectSet !== null && !projectSet.has(cwd)) { loaded[idx] = null; continue }
          try {
            let events = null
            if (persist) {
              try {
                const read = await persist.readFrom(rec.header.id, 0)
                events = read && read.events ? read.events : null
              } catch (e) { events = null }
            }
            if (!events) {
              const snap = await q.readSession(rec.header.id)
              events = snap.events
            }
            loaded[idx] = events
          } catch (e) {
            loaded[idx] = null
          }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker(), worker(), worker()])
      const data = { targets, loaded, pathTitle }
      eventsCache.set(key, { at: Date.now(), data })
      return data
    }

    function pct(cur, prev) {
      if (!(prev > 0)) return null
      return (cur - prev) / prev * 100
    }

    async function aggregate(req) {
      const q = ctx.get('sessionQuery')
      if (q === undefined) return { error: 'no-session-query' }
      const [lo, hi] = rangeBounds(req)
      const gran = pickGranularity(req, lo, hi)
      const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
      const projectSet = Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null

      const { targets, loaded, pathTitle } = await getLoaded(projectSet)

      // 当前窗与环比窗共用同一批已加载事件（内存聚合，毫秒级）
      const [plo, phi] = prevWindow(req.range, lo, hi)
      const cur = computeWindow(loaded, targets, lo, hi, modelSet, gran)
      const prev = computeWindow(loaded, targets, plo, phi, modelSet, gran)

      const projectMap = new Map()
      for (const rec of targets) {
        const cwd = rec.header.cwd || ''
        const id = cwd || '__none__'
        let p = projectMap.get(id)
        if (!p) {
          const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
          p = { id: id, title: pathTitle.get(cwd) || base || '未分组', sessions: 0 }
          projectMap.set(id, p)
        }
        p.sessions += 1
      }
      const projects = Array.from(projectMap.values()).sort((a, b) => a.title.localeCompare(b.title, 'zh'))

      const t = cur.totals
      const pt = prev.totals
      t.pct = {
        cost: pct(t.cost, pt.cost),
        totalTokens: pct(t.totalTokens, pt.totalTokens),
        inputTokens: pct(t.inputTokens, pt.inputTokens),
        outputTokens: pct(t.outputTokens, pt.outputTokens),
        cacheTokens: pct(t.cacheTokens, pt.cacheTokens),
        activeMs: pct(t.activeMs, pt.activeMs),
        totalMs: pct(t.totalMs, pt.totalMs),
        sessions: pct(t.sessions, pt.sessions),
        totalMessages: pct(t.totalMessages, pt.totalMessages),
        userMessages: pct(t.userMessages, pt.userMessages)
      }

      const coverage = cur.totalUsageTokens > 0 ? Math.round(cur.matchedTokens / cur.totalUsageTokens * 100) : 0
      const pricingRows = cur.models.map((m) => ({
        model: m.id,
        matched: m.matched,
        p: m.p
      }))

      // 分布数据：模型 / 项目（token 总量与费用；占比由客户端按当前模式计算）
      const distModels = (modelSet ? cur.models.filter((m) => modelSet.has(m.id)) : cur.models)
        .map((m) => ({ id: m.id, tokens: m.input + m.output + m.cache, cost: m.cost }))
        .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))
      const distProjects = Array.from(cur.projectAgg.entries())
        .map(([cwd, p]) => {
          const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
          return { id: cwd || '__none__', label: pathTitle.get(cwd) || base || '未分组', tokens: p.input + p.output + p.cache, cost: p.cost }
        })
        .sort((a, b) => (b.tokens + b.cost) - (a.tokens + a.cost))

      return { totals: t, buckets: cur.buckets, granularity: gran, heat: cur.heat, meta: { models: cur.models, projects, pricing: { coverage: coverage, rows: pricingRows }, dist: { models: distModels, projects: distProjects } } }
    }

    // 详细记录：按时间桶聚合（今天/24H 每小时一条；7D/30D/90D 每天一条），最新在前
    async function detailRecords(req) {
      const q = ctx.get('sessionQuery')
      if (q === undefined) return { error: 'no-session-query' }
      const [lo, hi] = rangeBounds(req)
      let gran = req.range === 'today' || req.range === '24h' ? 'hour' : 'day'
      if (req.range === 'custom') gran = (hi - lo) <= 48 * 3600000 ? 'hour' : 'day'
      const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
      const projectSet = Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null
      const { targets, loaded, pathTitle } = await getLoaded(projectSet)
      const bucketMap = new Map()
      for (let i = 0; i < loaded.length; i++) {
        const events = loaded[i]
        if (!events) continue
        const rec = targets[i]
        const hdr = rec.header || {}
        const cwd = hdr.cwd || ''
        const base = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
        const sessionKey = hdr.title || (hdr.meta && hdr.meta.title) || rec.title || pathTitle.get(cwd) || base || hdr.id || '未知会话'
        let lastUserT = null
        for (const ev of events) {
          const t = ev.time
          if (t < lo || t > hi) continue
          if (ev.type === 'user/message') { lastUserT = t; continue }
          if (ev.type !== 'assistant/message') continue
          const usage = ev.data && ev.data.usage
          if (!usage) continue
          const msg = ev.data.message
          const model = msg && msg.source ? String(msg.source.model || '') : ''
          if (modelSet !== null && !modelSet.has(model)) continue
          const pr = priceFor(model)
          const inp = num(usage.inputTokens)
          const otp = num(usage.outputTokens)
          const cr = num(usage.cacheReadTokens)
          const cw = num(usage.cacheWriteTokens)
          let cost = 0
          if (pr) cost = (inp * pr.p[0] + otp * pr.p[1] + cr * pr.p[2] + cw * pr.p[0]) / 1e6
          const bk = bucketKey(t, gran)
          let b = bucketMap.get(bk)
          if (!b) {
            b = { t: bk, sessions: new Set(), models: new Set(), input: 0, output: 0, cache: 0, cost: 0, dur: 0 }
            bucketMap.set(bk, b)
          }
          b.sessions.add(sessionKey)
          b.models.add(model)
          b.input += inp
          b.output += otp
          b.cache += cr + cw
          b.cost += cost
          b.dur += lastUserT == null ? 0 : t - lastUserT
        }
      }
      const rows = Array.from(bucketMap.values()).map((b) => ({
        t: b.t,
        sessions: b.sessions.size,
        models: Array.from(b.models),
        input: b.input,
        output: b.output,
        cache: b.cache,
        cost: b.cost,
        dur: b.dur
      }))
      rows.sort((a, b) => b.t - a.t)
      const offset = Math.max(0, Number(req.offset) || 0)
      const limit = Math.min(200, Math.max(1, Number(req.limit) || 100))
      return { gran: gran, total: rows.length, rows: rows.slice(offset, offset + limit) }
    }

    harness.handle('usage', async (args) => {
      const req = args && typeof args === 'object' ? args : {}
      const key = JSON.stringify({
        range: req.range || 'today',
        from: req.from || null,
        to: req.to || null,
        models: req.models || null,
        projects: req.projects || null
      })
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && now - hit.at < TTL) return hit.data
      if (hit) {
        // stale-while-revalidate：先返回旧数据，后台刷新
        aggregate(req).then((data) => { cache.set(key, { at: Date.now(), data }) }).catch(() => {})
        return hit.data
      }
      try {
        const data = await aggregate(req)
        cache.set(key, { at: now, data })
        return data
      } catch (e) {
        console.error('dashboard usage aggregation failed', e)
        return { error: String((e && e.message) || e) }
      }
    })

    // 活跃度日历：过去 53 周（含当前周，周日起始）每日 token 总量
    async function calendarData(req) {
      const q = ctx.get('sessionQuery')
      if (q === undefined) return { error: 'no-session-query' }
      const now = Date.now()
      const d = new Date()
      const thisSunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime()
      const start = thisSunday - 52 * 7 * 86400000
      const end = thisSunday + 6 * 86400000
      const modelSet = Array.isArray(req.models) && req.models.length ? new Set(req.models) : null
      const projectSet = Array.isArray(req.projects) && req.projects.length ? new Set(req.projects) : null
      const { targets, loaded } = await getLoaded(projectSet)
      const dayMap = new Map()
      for (let i = 0; i < loaded.length; i++) {
        const events = loaded[i]
        if (!events) continue
        for (const ev of events) {
          const t = ev.time
          if (t < start || t > end) continue
          if (ev.type !== 'assistant/message') continue
          const usage = ev.data && ev.data.usage
          if (!usage) continue
          const msg = ev.data.message
          const model = msg && msg.source ? String(msg.source.model || '') : ''
          if (modelSet !== null && !modelSet.has(model)) continue
          const k = bucketKey(t, 'day')
          dayMap.set(k, (dayMap.get(k) || 0) + num(usage.inputTokens) + num(usage.outputTokens) + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens))
        }
      }
      return {
        start: start,
        end: end,
        days: Array.from(dayMap.entries()).map(([t, tokens]) => ({ t: t, tokens: tokens }))
      }
    }

    harness.handle('detail', async (args) => {
      const req = args && typeof args === 'object' ? args : {}
      const offset = Math.max(0, Number(req.offset) || 0)
      const limit = Math.min(200, Math.max(1, Number(req.limit) || 100))
      const key = JSON.stringify({
        range: req.range || 'today',
        from: req.from || null,
        to: req.to || null,
        models: req.models || null,
        projects: req.projects || null,
        offset: offset,
        limit: limit
      })
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && now - hit.at < TTL) return hit.data
      if (hit) {
        detailRecords(req).then((data) => { cache.set(key, { at: Date.now(), data }) }).catch(() => {})
        return hit.data
      }
      try {
        const data = await detailRecords(req)
        cache.set(key, { at: now, data })
        return data
      } catch (e) {
        console.error('dashboard detail failed', e)
        return { error: String((e && e.message) || e) }
      }
    })

    harness.handle('calendar', async (args) => {
      const req = args && typeof args === 'object' ? args : {}
      const key = JSON.stringify({
        models: req.models || null,
        projects: req.projects || null
      })
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && now - hit.at < TTL) return hit.data
      if (hit) {
        calendarData(req).then((data) => { cache.set(key, { at: Date.now(), data }) }).catch(() => {})
        return hit.data
      }
      try {
        const data = await calendarData(req)
        cache.set(key, { at: now, data })
        return data
      } catch (e) {
        console.error('dashboard calendar failed', e)
        return { error: String((e && e.message) || e) }
      }
    })

    // 启动预热默认视图（今天 + 昨天环比），首次打开即秒出
    const timer = ctx.get('timer')
    if (timer) {
      ctx.effect(() => timer.timeout(() => {
        aggregate({ range: 'today' }).then((data) => {
          const key = JSON.stringify({ range: 'today', from: null, to: null, models: null, projects: null })
          cache.set(key, { at: Date.now(), data })
        }).catch(() => {})
      }, 1500))
    }

}

export const inject = ["webServer", "sessionQuery", "sessionPersistence", "workspaceRegistry", "timer"]
