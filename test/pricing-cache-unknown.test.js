// 缓存读取价「未知」与「已知为 ¥0」的区分（审计 F23 / 剩余任务 C1）
// 以及 C2 的结论：哪些未定价模型已被补录、哪个必须保持未匹配。
//
// CSV 第 5 列为空 = 没核到官方缓存读取价：PRICES 里仍是 0 参与计费（改动会让历史费用
// 跳变），但引擎必须把它标出来，前端才能提示「费用可能低估」，而不是把未知当已知。
import test from 'node:test'
import assert from 'node:assert/strict'

import { priceFor, priceForAt, foldSession, queryUsage } from '../src/core/rollup.js'
import { CACHE_PRICE_UNKNOWN } from '../src/core/pricing.js'

const HOUR = 3600000
const t0 = Date.UTC(2026, 9, 14, 2) // 北京时间 2026-10-14 10:00

// 数据驱动：不写死某一行的名字，避免以后再补价时测试变成绊脚石
const unknownModels = [...CACHE_PRICE_UNKNOWN].sort()
const UNKNOWN_A = unknownModels[0]
const UNKNOWN_B = unknownModels[1]

test('CACHE_PRICE_UNKNOWN 只包含 CSV 第 5 列为空的模型', () => {
  assert.ok(CACHE_PRICE_UNKNOWN instanceof Set)
  assert.ok(unknownModels.length >= 2, '至少要有两个未知模型供本文件做对照')
  // 有官方缓存价的模型绝不能在里面（否则前端会误报）
  for (const m of ['claude-3-haiku', 'gpt-5', 'deepseek-v4-flash', 'glm-5.3', 'kimi-k3', 'gpt-5.6-sol']) {
    assert.equal(CACHE_PRICE_UNKNOWN.has(m), false, m + ' 有缓存价，不应标为未知')
  }
  // 「官方确认没有缓存计费」写显式 0，与「未知」不是一回事
  for (const m of ['gpt-4', 'gpt-3.5-turbo', 'phi-4', 'ling-3.1-flash'] ) {
    assert.equal(CACHE_PRICE_UNKNOWN.has(m), false, m + ' 的缓存价是明确的 0，不应标为未知')
  }
})

test('priceFor/priceForAt 带上 cacheUnknown 标记', () => {
  const unknown = priceFor(UNKNOWN_A)
  assert.ok(unknown, UNKNOWN_A + ' 应能匹配（未知只针对缓存价这一列）')
  assert.equal(unknown.cacheUnknown, true, UNKNOWN_A + ' 的缓存读取价是空的 → 未知')
  assert.equal(unknown.p[2], 0, '计费口径不变：仍按 0 参与计算')

  const known = priceFor('claude-3-haiku')
  assert.equal(known.cacheUnknown, false)
  assert.ok(known.p[2] > 0)

  const free = priceFor('ling-3.1-flash')
  assert.deepEqual(free.p, [0, 0, 0])
  assert.equal(free.cacheUnknown, false, '官方价 0 与「未知」不是一回事')

  assert.equal(priceFor('no-such-model'), null)

  // 标记要穿透峰谷价与生效前的 CSV 回退两条路径
  assert.equal(priceForAt('deepseek-flash', t0).cacheUnknown, false)
  assert.equal(priceForAt('deepseek-flash', Date.UTC(2026, 6, 1)).cacheUnknown, false)
  assert.equal(priceForAt(UNKNOWN_A, t0).cacheUnknown, true)
})

// 一个 assistant/message 事件（usage 里带缓存读取）
const msg = (id, time, model, inp, out, cr) => ({
  type: 'assistant/message',
  time,
  data: {
    turn: 0,
    step: 0,
    usage: { inputTokens: inp, outputTokens: out, cacheReadTokens: cr, cacheWriteTokens: 0 },
    message: { id, source: { model } }
  }
})
const sessionWith = (model, cr) => {
  const r = foldSession([
    { type: 'user/message', time: t0, data: { source: { kind: 'user' } } },
    msg('m-' + model, t0 + 1000, model, 1000, 500, cr)
  ])
  r.id = 's-' + model
  r.cwd = 'D:/fixture'
  r.projectTitle = 'fixture'
  return r
}
const window_ = { range: 'custom', from: t0 - HOUR, to: t0 + HOUR }

test('queryUsage 只在「确有缓存 token 且缓存价未知」时报告，且覆盖率不受影响', () => {
  const usage = queryUsage([sessionWith(UNKNOWN_A, 50000)], window_, {})
  const pricing = usage.meta.pricing
  assert.equal(pricing.coverage, 100, '模型是已匹配的：覆盖率不因此下降')
  const row = pricing.rows.find((r) => r.model === UNKNOWN_A)
  assert.equal(row.cacheUnknown, true)
  assert.deepEqual(pricing.cacheUnknownUsed, [{ model: UNKNOWN_A, cacheTokens: 50000 }])
  assert.equal(pricing.cacheUnknownTokens, 50000)
})

test('缓存价已知的模型不会被报告', () => {
  const usage = queryUsage([sessionWith('claude-3-haiku', 50000)], window_, {})
  const pricing = usage.meta.pricing
  assert.deepEqual(pricing.cacheUnknownUsed, [])
  assert.equal(pricing.cacheUnknownTokens, 0)
  assert.equal(pricing.rows[0].cacheUnknown, false)
})

test('缓存价未知但本窗口没有缓存 token 时不报告（没有低估）', () => {
  const usage = queryUsage([sessionWith(UNKNOWN_A, 0)], window_, {})
  const pricing = usage.meta.pricing
  assert.equal(pricing.rows[0].cacheUnknown, true, '行本身仍标着未知')
  assert.deepEqual(pricing.cacheUnknownUsed, [], '但没用缓存 token，就不提示低估')
  assert.equal(pricing.cacheUnknownTokens, 0)
})

test('同一窗口多个未知模型分别列出，token 量求和', () => {
  const usage = queryUsage([sessionWith(UNKNOWN_A, 1000), sessionWith(UNKNOWN_B, 2000)], window_, {})
  const pricing = usage.meta.pricing
  assert.deepEqual(pricing.cacheUnknownUsed.map((r) => r.model).sort(), [UNKNOWN_A, UNKNOWN_B].sort())
  assert.equal(pricing.cacheUnknownTokens, 3000)
})

// ---------- C1 补齐的具体行（抽查，防止以后被改回去） ----------
test('C1：已核到官方价的缓存读取价', () => {
  // Mistral 官方 pricing 页「Cached input」列（USD ×7）
  assert.deepEqual(priceFor('mistral-large-3').p, [3.5, 10.5, 0.35])
  assert.deepEqual(priceFor('ministral-3b-2512').p, [0.7, 0.7, 0.07])
  assert.deepEqual(priceFor('codestral-2508').p, [2.1, 6.3, 0.21])
  // 规则推导（官方全局规则：cached input = 10% of input），用于已下架型号
  assert.equal(priceFor('mistral-nemo').p[2], 0.014)
  // Google 归档官方页：cached = 25% of input（C3 起改用最终档位 ≤128k：$1.25/$5.00）
  assert.deepEqual(priceFor('gemini-1.5-pro').p, [8.75, 35, 2.1875])
  // DeepSeek 官方公告：cache hit $0.014/M（与该行 era 一致的 miss $0.14/out $0.28）
  assert.equal(priceFor('deepseek-coder').p[2], 0.098)
  // 百度千帆官方「命中缓存」价（C3 起输入/输出改回官方在线推理价 ¥0.8/¥3.2）
  assert.deepEqual(priceFor('ernie-4.5-turbo').p, [0.8, 3.2, 0.2])
  // Bedrock：cache read = 25% of on-demand input（官方脚注 + 欧站数值证实 0.250）
  assert.deepEqual(priceFor('amazon-nova-pro').p, [5.6, 22.4, 1.4])
  assert.equal(priceFor('amazon-nova-lite').p[2], 0.0525)
  // Sapiens 官方 wiki：cached = 10% of input（Pro 档 $0.045/M → ¥0.315）
  assert.equal(priceFor('agnes-2.5-pro').p[2], 0.315, '原值 0.03 比官方低 10 倍')
  assert.equal(priceFor('agnes-2.5-pro-alpha').p[2], 0.315)
  // C3：agnes-3.0-flash 由 list 价改为官方**当前价**（免费）——显式 0 表示「已知为 ¥0」，
  // 不是「未知」（因此它不进 CACHE_PRICE_UNKNOWN，也不会弹低估徽标）
  assert.deepEqual(priceFor('agnes-3.0-flash').p, [0, 0, 0])
  assert.equal(CACHE_PRICE_UNKNOWN.has('agnes-3.0-flash'), false, '免费是已知的 0，不能算未知')
})

test('C2：新补录的三个模型 + 必须保持未匹配的 qoder-cn', () => {
  assert.deepEqual(priceFor('spark-x2.5').p, [1.6, 6, 0.24])
  assert.deepEqual(priceFor('Qwen3.6-35B-A3B').p, [1.8, 10.8, 0])
  assert.deepEqual(priceFor('Qwen3.8-27B').p, [3, 12, 0.6])
  // 大小写/别名也要命中（usage 里的写法不固定）
  assert.equal(priceFor('qwen3.8-27b').matched, 'Qwen3.8-27B')
  // qoder-cn 是 provider（Qoder CN / 通义灵码）名字漏进 model 字段，不是模型 id：
  // 绝不能为了「让覆盖率好看」而给它编一个价。
  assert.equal(priceFor('qoder-cn'), null)
  // 其余无第一方价（或纯别名）的模型同样保持未匹配
  for (const m of ['step-explore', 'kat-coder-pro-v2.5', 'big-pickle']) {
    assert.equal(priceFor(m), null, m + ' 没有第一方逐 token 价，必须保持未匹配而不是猜价')
  }
})
