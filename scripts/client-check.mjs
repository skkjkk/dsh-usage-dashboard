// 客户端半边自检（审计 F16）。
//
// 旧版 src/client.js 是一个「函数体片段」：顶层 `return {` 让 node --check 直接报
// Illegal return statement，React/host/styles 靠构建期字符串替换与隐式全局补齐，
// 因此既不能 lint 也不能单测。现在 src/client/ 是真正的 ESM 模块树，本脚本证明：
//   1. 每个模块都是合法 JS（node --check）；
//   2. 纯逻辑模块（format / chart-math / host / css / plugin）可被真实 import 并断言；
//   3. 组件能被真实 React + react-dom 渲染——夹具用引擎产出的真实 payload；
//   4. 构建产物 lib/client.js 在模拟 loader 下能加载，apply 能注册 slot。
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const url = (p) => pathToFileURL(join(root, p)).href

let checks = 0
const ok = (msg) => { checks += 1; console.log('  ✔ ' + msg) }
const fail = (msg) => { console.error('  ✘ ' + msg); process.exitCode = 1 }
const eq = (label, got, want) => {
  if (got !== want) fail(label + ': ' + JSON.stringify(got) + ' != ' + JSON.stringify(want))
  else ok(label)
}
const isTrue = (label, cond, detail) => {
  if (!cond) fail(label + (detail === undefined ? '' : ': ' + detail))
  else ok(label)
}
const renders = (label, element, needle) => {
  try {
    const html = renderToStaticMarkup(element)
    if (needle && html.indexOf(needle) === -1) fail(label + ': markup lacks ' + JSON.stringify(needle))
    else if (!html.length) fail(label + ': empty markup')
    else ok(label)
  } catch (e) {
    fail(label + ' threw: ' + (e && e.message))
  }
}

console.log('client check — src/client/ modules')

// ---- 1) every module must be valid JS ----
const modules = []
;(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.js')) modules.push(p)
  }
})(join(root, 'src', 'client'))
isTrue('module count', modules.length >= 15, modules.length + ' modules found')
for (const file of modules) {
  const label = 'syntax ' + relative(root, file).replace(/\\/g, '/')
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
    ok(label)
  } catch (e) {
    fail(label + ': ' + String((e && e.stderr) || (e && e.message) || e).split('\n')[0])
  }
}
// The monolith is gone; the split must not silently reappear.
isTrue('src/client.js removed', !existsSync(join(root, 'src', 'client.js')))
// Host-only APIs must not creep back into client sources (they were patched in by
// string replacement before; now they are real code). Comments are blanked first:
// the migration notes legitimately mention the old shim names.
const codeOnly = (src) => {
  let out = ''
  let i = 0
  let quote = null
  while (i < src.length) {
    const ch = src[i]
    const two = src.slice(i, i + 2)
    if (quote) {
      if (ch === '\\') { out += '  '; i += 2; continue }
      if (ch === quote) { quote = null; out += ch; i += 1; continue }
      out += ch === '\n' ? '\n' : ' '
      i += 1
      continue
    }
    if (two === '//') { while (i < src.length && src[i] !== '\n') { out += ' '; i += 1 } continue }
    if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') { out += src[i] === '\n' ? '\n' : ' '; i += 1 }
      out += '  '; i += 2; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; i += 1; continue }
    out += ch; i += 1
  }
  return out
}
for (const file of modules) {
  const code = codeOnly(readFileSync(file, 'utf8'))
  const bad = ['ctx.interval(', 'styles.insert('].filter((needle) => code.includes(needle))
  isTrue('no host-only API in ' + relative(root, file).replace(/\\/g, '/'), bad.length === 0, bad.join(', '))
}

// ---- 2) pure modules: import + assert ----
console.log('client check — pure logic')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const plugin = await import(url('src/client/plugin.js'))
eq('PLUGIN_ID matches package.json name', plugin.PLUGIN_ID, pkg.name)
eq('STYLE_TAG_ID', plugin.STYLE_TAG_ID, pkg.name + '/dashboard.module.css')

const theme = await import(url('src/client/theme.js'))
eq('RANGES keys', theme.RANGES.map((r) => r.key).join(','), 'today,24h,7d,30d,90d,custom')
eq('MODES keys', theme.MODES.map((m) => m.key).join(','), 'token,cost,dur')
eq('BREAK_PTS length', theme.BREAK_PTS.length, 8)
eq('HEAT_SCALES keys', Object.keys(theme.HEAT_SCALES).join(','), 'tokens,cost,dur')

const format = await import(url('src/client/format.js'))
eq('pad2', format.pad2(5), '05')
eq('fmtH9 M', format.fmtH9(1500000), '1.5M')
eq('fmtH9 B', format.fmtH9(2e9), '2.0B')
eq('fmtH9 zero', format.fmtH9(0), '0')
eq('fmtIntl', format.fmtIntl(12345), '12,345')
eq('fmtCny', format.fmtCny(12.3456), '¥12.35')
eq('fmtPriceRange', format.fmtPriceRange(1, 2.0), '¥1~2/M')
// fmtPct 是「百分点差值」格式（带符号），不是 0–1 比例。
eq('fmtPct positive delta', format.fmtPct(0.5), '+0.5%')
eq('fmtPct negative delta', format.fmtPct(-2), '-2.0%')
eq('fmtPct null', format.fmtPct(null), null)
const custom = format.defaultCustom()
isTrue('defaultCustom numeric bounds', Number.isFinite(custom.from) && Number.isFinite(custom.to) && custom.to > custom.from,
  JSON.stringify(custom))
eq('dateToMs round-trip', format.dateToMs(format.fmtDateMs(custom.from)), custom.from)

const math = await import(url('src/client/chart-math.js'))
eq('calLevel 0', math.calLevel(0), 0)
eq('calLevel 1M', math.calLevel(1000000), 1)
eq('calLevel 250M', math.calLevel(250000000), 7)
eq('heatBreakpoints empty', JSON.stringify(math.heatBreakpoints([])), '[]')
eq('heatBreakpoints length', math.heatBreakpoints([1, 2, 3, 4]).length, 8)
eq('heatColor zero', math.heatColor(0, [1, 2], ['a', 'b']), 'a')
eq('heatColor top', math.heatColor(99, [1, 2], ['a', 'b']), 'b')
eq('RADAR_BAND null', math.RADAR_BAND(null, 1, 10), null)
eq('RADAR_BAND floor', math.RADAR_BAND(1, 1, 10), 0)
eq('RADAR_BAND ceil', math.RADAR_BAND(10, 1, 10), 1)
eq('RADAR_BAND clamp', math.RADAR_BAND(1000, 1, 10), 1)
eq('RADAR_DEFS axes', math.RADAR_DEFS.length, math.RADAR_AXES)
isTrue('RADAR_DEFS score/fmt present', math.RADAR_DEFS.every((d) => typeof d.score === 'function' && typeof d.fmt === 'function'))

// host bridge: the array encoding is the client half of the F14 contract.
const { host } = await import(url('src/client/host.js'))
{
  const seen = []
  globalThis.fetch = (u) => { seen.push(u); return Promise.resolve({ json: () => Promise.resolve({ ok: true }) }) }
  await host.call('usage', { range: 'today', models: ['a', 'b'], projects: ['D:/x,y'], skip: null, n: 5 })
  const parsed = new URL('http://dash.local' + seen[0])
  eq('host path', parsed.pathname, '/dash-api/usage')
  eq('host array param is JSON', parsed.searchParams.get('models'), '["a","b"]')
  eq('host comma-bearing project stays one element', parsed.searchParams.get('projects'), '["D:/x,y"]')
  eq('host drops null params', parsed.searchParams.has('skip'), false)
  eq('host number param', parsed.searchParams.get('n'), '5')
}

// css injector: idempotent insert + cleanup, without a real DOM.
const css = await import(url('src/client/css.js'))
{
  const appended = []
  const removed = []
  globalThis.document = {
    head: { appendChild: (t) => appended.push(t) },
    createElement: () => ({ dataset: {}, textContent: '', remove: () => removed.push(true) }),
    querySelectorAll: () => []
  }
  const cleanup = css.injectStyles()
  eq('injectStyles appends one tag', appended.length, 1)
  eq('style tag carries plugin id', appended[0].dataset.pluginCss, plugin.STYLE_TAG_ID)
  eq('style tag carries the CSS', appended[0].textContent, css.CSS)
  cleanup()
  eq('injectStyles cleanup removes the tag', removed.length, 1)
}

// ---- 3) components render with a real engine payload ----
console.log('client check — component rendering')
const engine = await import(url('src/core/rollup.js'))
const React = (await import('react')).default
const t0 = Date.now() - 2 * 3600000
const msg = (id, time, model, inp, out, cr, cw) => ({
  type: 'assistant/message', time,
  data: { turn: 0, step: 0, usage: { inputTokens: inp, outputTokens: out, cacheReadTokens: cr, cacheWriteTokens: cw }, message: { id, source: { model } } }
})
const rollup = engine.foldSession([
  { type: 'user/message', time: t0, data: { source: { kind: 'user' } } },
  { type: 'step/start', time: t0 + 100, data: { turn: 0, step: 0 } },
  { type: 'assistant/chunk', time: t0 + 2000, data: { turn: 0, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
  msg('m1', t0 + 2001, 'deepseek-v4-flash', 1000, 500, 200, 50),
  { type: 'tool/call', time: t0 + 3000, data: { callId: 'c1' } },
  { type: 'tool/result', time: t0 + 4000, data: {} },
  { type: 'user/message', time: t0 + 3600000, data: { source: { kind: 'user' } } },
  { type: 'step/start', time: t0 + 3600100, data: { turn: 1, step: 0 } },
  { type: 'assistant/chunk', time: t0 + 3602000, data: { turn: 1, step: 0, chunk: { type: 'finish', reason: 'stop' } } },
  msg('m2', t0 + 3602001, 'gpt-5', 2000, 900, 0, 0)
])
rollup.id = 'render-fixture'
rollup.cwd = 'D:/render-fixture'
rollup.title = 'render-fixture'
rollup.projectTitle = 'render-fixture'
const usage = engine.queryUsage([rollup], { range: 'custom', from: t0 - 1000, to: t0 + 7200000 }, {})
isTrue('fixture has buckets', usage.buckets.length >= 2, usage.buckets.length + ' buckets')
isTrue('fixture has models', usage.meta.models.length >= 2, usage.meta.models.length + ' models')

const h = React.createElement
const noop = () => {}
const cards = {
  TrendChart: await import(url('src/client/cards/trend.js')),
  heat: await import(url('src/client/cards/heat.js')),
  radar: await import(url('src/client/cards/radar.js')),
  cache: await import(url('src/client/cards/cache.js')),
  calendar: await import(url('src/client/cards/calendar.js')),
  records: await import(url('src/client/cards/records.js'))
}
const primitives = await import(url('src/client/primitives.js'))
const { Dashboard } = await import(url('src/client/dashboard.js'))

renders('Dashboard (loading)', h(Dashboard, null), '数据看板')
renders('TrendChart', h(cards.TrendChart.TrendChart, { buckets: usage.buckets, granularity: usage.granularity }), 'dd-chart')
renders('HeatChart', h(cards.heat.HeatChart, { heat: usage.heat }), 'dd-chart')
renders('DistributionCard', h(cards.heat.DistributionCard, { icon: null, title: '模型分布', items: usage.meta.dist.models }), '模型分布')
renders('RadarCard', h(cards.radar.RadarCard, { models: usage.meta.models, modelSel: null }), '响应速度')
// React camelCase props must still land as the hyphenated SVG attributes.
isTrue('RadarCard SVG attribute mapping',
  renderToStaticMarkup(h(cards.radar.RadarCard, { models: usage.meta.models, modelSel: null })).includes('text-anchor'))
renders('CacheTrendCard', h(cards.cache.CacheTrendCard, {
  buckets: usage.buckets, granularity: usage.granularity, totals: usage.totals,
  models: usage.meta.models, modelSel: null, usd: false, onPickModel: noop
}), 'dd-chart')
renders('CalendarChart', h(cards.calendar.CalendarChart, { modelSel: null, projectSel: null, refreshSeq: 0 }), 'dd-chart')
renders('RecordsCard', h(cards.records.RecordsCard, {
  range: 'today', custom: format.defaultCustom(), modelSel: null, projectSel: null, costMode: 'cny', refreshSeq: 0
}), 'dd-records-head')
renders('StatCard', h(primitives.StatCard, { title: '预估费用', num: 12.5, fmt: format.fmtCny, pct: { pct: 10 } }), '预估费用')
renders('FilterBar', h(primitives.FilterBar, {
  range: 'today', setRange: noop, custom: format.defaultCustom(), setCustom: noop,
  modelSel: null, setModelSel: noop, projectSel: null, setProjectSel: noop,
  meta: usage.meta, busy: false, onApply: noop
}), 'dd-filters')
renders('Segmented', h(primitives.Segmented, {
  ariaLabel: '测试', options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], active: 'a', onSelect: noop
}), 'dd-seg')
renders('PricingPopup', h(primitives.PricingPopup, { pricing: usage.meta.pricing }), '¥')
renders('DurPopup', h(primitives.DurPopup, null))
// The badge is deliberately absent at full coverage and present below it.
eq('UnmatchedBadge (full coverage = no badge)',
  renderToStaticMarkup(h(primitives.UnmatchedBadge, { pricing: usage.meta.pricing })), '')
renders('UnmatchedBadge (unmatched row)', h(primitives.UnmatchedBadge, {
  pricing: { coverage: 50, rows: [{ model: 'unknown-model', matched: false }] }
}), 'dd-unmatched-badge')
// Popup renders its trigger in SSR (the panel needs layout, which has no DOM here).
renders('Popup trigger', h(primitives.Popup, { open: true, onToggle: noop, onClose: noop, title: '说明' }, '正文'))

// ---- 4) built bundle: loader contract + slot registration ----
console.log('client check — built bundle')
{
  let captured = null
  const appended = []
  globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def } } }
  globalThis.document = {
    head: { appendChild: (t) => appended.push(t) },
    createElement: () => ({ dataset: {}, textContent: '', remove: () => {} }),
    querySelectorAll: () => []
  }
  await import(url('lib/client.js'))
  isTrue('bundle called __ModuleLoader__.load', captured !== null)
  eq('bundle id', captured && captured.id, pkg.name)
  const mod = captured.factory(require)
  eq('bundle inject', JSON.stringify(mod.inject), '["slots"]')
  isTrue('bundle exports apply', typeof mod.apply === 'function')
  const registered = []
  mod.apply({
    get: (name) => name === 'slots'
      ? { inject: (_slot, factory) => factory(), register: (def) => { registered.push(def) } }
      : undefined,
    effect: (fn) => { fn(); return () => {} }
  })
  eq('slot registered', registered.length, 1)
  eq('slot id', registered[0] && registered[0].id, 'dashboard')
  eq('slot order', registered[0] && registered[0].order, 30)
  isTrue('styles injected by apply', appended.length === 1)
  // apply() must be tolerant of a host without the slots service.
  mod.apply({ get: () => undefined, effect: (fn) => { fn(); return () => {} } })
  ok('apply tolerates a missing slots service')
}

console.log(process.exitCode
  ? '\nclient check FAILED ✘'
  : '\nclient check passed ✔ (' + checks + ' assertions)')
