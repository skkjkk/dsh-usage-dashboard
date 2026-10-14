// 渲染快照（剩余任务 D3）。
//
// scripts/client-check.mjs 只断言「每个卡片能渲染且包含某个 class」，看不出结构漂移；
// 这里把 SSR 产物存成快照，改动时能直接 diff 出结构差异。
//
// 夹具刻意用**固定时间戳**（不取 Date.now()），否则快照每天都不一样：
//   * 引擎输出只依赖传进去的 from/to，与"当前时间"无关；
//   * 组件本身是纯 props → markup（useTween 在 SSR 下直接输出目标值）。
// 刷新快照：`UPDATE_SNAPSHOTS=1 npm run test:unit`（新增卡片时也必须显式刷新）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import * as engine from '../src/core/rollup.js'
import * as format from '../src/client/format.js'
import * as primitives from '../src/client/primitives.js'
import { TrendChart } from '../src/client/cards/trend.js'
import { HeatChart, DistributionCard } from '../src/client/cards/heat.js'
import { RadarCard } from '../src/client/cards/radar.js'
import { CacheTrendCard } from '../src/client/cards/cache.js'

const h = React.createElement
const noop = () => {}
const SNAP_DIR = fileURLToPath(new URL('./snapshots/', import.meta.url))
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1'

function snapshot(name, element) {
  const html = renderToStaticMarkup(element)
  assert.ok(html.length > 0, name + ': SSR 产物不能为空')
  const file = SNAP_DIR + name + '.txt'
  if (UPDATE) {
    mkdirSync(SNAP_DIR, { recursive: true })
    writeFileSync(file, html + '\n', 'utf8')
    return html
  }
  assert.ok(existsSync(file), '缺少快照 ' + name + '.txt —— 确认渲染结果后跑 UPDATE_SNAPSHOTS=1 npm run test:unit')
  assert.equal(html + '\n', readFileSync(file, 'utf8'),
    '渲染快照与 ' + name + '.txt 不一致（确认改动后用 UPDATE_SNAPSHOTS=1 刷新，并在提交里一起 review）')
  return html
}

// ---------- 固定夹具 ----------
const T0 = Date.UTC(2026, 9, 14, 2) // 北京时间 2026-10-14 10:00
const msg = (id, time, model, inp, out, cr, cw) => ({
  type: 'assistant/message',
  time,
  data: {
    turn: 0,
    step: 0,
    usage: { inputTokens: inp, outputTokens: out, cacheReadTokens: cr, cacheWriteTokens: cw },
    message: { id, source: { model } }
  }
})
const turn = (base, model, usage) => [
  { type: 'user/message', time: base, data: { source: { kind: 'user' } } },
  { type: 'step/start', time: base + 10, data: { turn: 0, step: 0 } },
  { type: 'assistant/chunk', time: base + 1200, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
  msg(model + '-' + base, base + 1300, model, usage[0], usage[1], usage[2], usage[3])
]

function session(id, cwd, title, model, events) {
  const r = engine.foldSession(events)
  r.id = id
  r.cwd = cwd
  r.title = title
  r.projectTitle = title
  return r
}

const rollups = [
  session('s-a', 'D:/demo-app', 'demo-app', 'deepseek-flash', [
    // 上一窗口的用量：让 KPI 的 pct 是引擎算出的真实百分比（而不是 null 分支）
    ...turn(T0 - 7200000, 'deepseek-flash', [50000, 10000, 300000, 0]),
    ...turn(T0, 'deepseek-flash', [100000, 20000, 900000, 0]),
    ...turn(T0 + 3700000, 'deepseek-flash', [120000, 25000, 1100000, 0])
  ]),
  session('s-b', 'D:/project-b', 'project-b', 'gpt-5', [
    ...turn(T0 + 600000, 'gpt-5', [80000, 40000, 0, 5000])
  ])
]
const LO = T0 - 3600000
const HI = T0 + 7200000
const usage = engine.queryUsage(rollups, { range: 'custom', from: LO, to: HI }, {})
const models = usage.meta.models
const projects = usage.meta.projects

// ---------- 快照 ----------
test('渲染快照：KPI + 筛选器', () => {
  // 注意：StatCard 的数值走 useTween（useState(0) + effect 动画），SSR 下永远渲染初始值 0——
  // 所以下面两个快照只钉**结构**（标签/单位/百分比 span/class），不验证数字。
  // 数字由 engine-contracts（totals）与 client-pure（format）覆盖；这条也顺带把
  // 「SSR 下 tween 归零」这个事实钉住，将来若改成 SSR 安全会在此显式失败。
  const statHtml = snapshot('stat-card-cost', h(primitives.StatCard, {
    title: '预估费用', num: usage.totals.cost, fmt: format.fmtCny, pct: usage.totals.pct.cost, popup: null
  }))
  assert.match(statHtml, /dd-kpi-value/, '结构必须包含数值容器')
  assert.ok(usage.totals.cost > 0, '夹具的费用必须非零（否则「渲染出 0」这件事就无从对比）')
  assert.match(renderToStaticMarkup(h(primitives.StatCard, { title: 'x', num: 12345.678, fmt: format.fmtCny })), /¥0\.00/,
    'StatCard 在 SSR 下渲染的是 tween 初始值')
  snapshot('stat-card-tokens', h(primitives.StatCard, {
    title: '总 Token', num: usage.totals.totalTokens, fmt: format.fmtH9, pct: usage.totals.pct.totalTokens
  }))
  snapshot('filter-bar', h(primitives.FilterBar, {
    range: 'custom', setRange: noop, custom: { from: LO, to: HI, fromStr: '2026-10-14', toStr: '2026-10-14' },
    setCustom: noop, modelSel: null, setModelSel: noop, projectSel: null, setProjectSel: noop,
    meta: usage.meta, busy: false, onApply: noop
  }))
  snapshot('segmented', h(primitives.Segmented, {
    ariaLabel: '趋势指标', options: [{ key: 'token', label: 'Token' }, { key: 'cost', label: '费用' }], active: 'token', onSelect: noop
  }))
  snapshot('unmatched-badge', h(primitives.UnmatchedBadge, {
    pricing: { coverage: 50, rows: [{ model: 'unknown-model', matched: false }] }
  }))
  // 缓存价未知徽标 + 定价弹层里的「未知」单元格（剩余任务 C1 / 审计 F23）
  snapshot('cache-unknown-badge', h(primitives.CacheUnknownBadge, {
    pricing: { cacheUnknownUsed: [{ model: 'command-a', cacheTokens: 123456 }], cacheUnknownTokens: 123456 }
  }))
  const popupHtml = snapshot('pricing-popup-cache-unknown', h(primitives.PricingPopup, {
    pricing: {
      coverage: 100,
      rows: [
        { model: 'gpt-4', matched: 'gpt-4', p: [210, 420, 0], cacheUnknown: false },
        { model: 'command-a', matched: 'command-a', p: [17.5, 70, 0], cacheUnknown: true }
      ],
      cacheUnknownUsed: [{ model: 'command-a', cacheTokens: 123456 }],
      cacheUnknownTokens: 123456
    }
  }))
  assert.match(popupHtml, /未知/, '缓存价未知的行在表里必须显示「未知」而不是 ¥0')
  assert.match(popupHtml, /缓存读取价未核到官方价/, '弹层必须解释费用可能低估')
  assert.equal(renderToStaticMarkup(h(primitives.CacheUnknownBadge, { pricing: { cacheUnknownUsed: [] } })), '',
    '没有实际低估时徽标不渲染')
})

test('渲染快照：趋势与热力图', () => {
  const html = snapshot('trend', h(TrendChart, { buckets: usage.buckets, granularity: usage.granularity }))
  assert.match(html, /dd-chart/)
  snapshot('heat', h(HeatChart, { heat: usage.heat, metric: 'token' }))
})

test('渲染快照：分布、雷达与缓存', () => {
  snapshot('distribution-models', h(DistributionCard, { icon: null, title: '模型分布', items: usage.meta.dist.models }))
  const projHtml = snapshot('distribution-projects', h(DistributionCard, { icon: null, title: '项目分布', items: usage.meta.dist.projects }))
  assert.match(projHtml, /demo-app/)
  snapshot('radar', h(RadarCard, { models, modelSel: null }))
  snapshot('cache-trend', h(CacheTrendCard, {
    buckets: usage.buckets, granularity: usage.granularity, totals: usage.totals,
    models, modelSel: null, usd: false, onPickModel: noop
  }))
})

test('快照夹具本身必须是有内容的（防止「空 payload 也能通过」）', () => {
  assert.ok(usage.buckets.length >= 2, '夹具应有多个桶')
  assert.equal(models.length, 2)
  assert.equal(projects.length, 2)
  assert.ok(usage.totals.cost > 0)
  assert.ok(usage.totals.cacheHitRate > 0, '缓存命中率必须非零，否则缓存卡快照退化')
})
