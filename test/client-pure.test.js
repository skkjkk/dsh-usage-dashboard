// 客户端纯模块的单元契约（剩余任务 D1）。
//
// scripts/client-check.mjs 负责「构建产物 + 真实 React SSR 渲染」的端到端门禁；
// 这里按模块钉住纯逻辑（格式化 / 图表数学 / host 桥数组编码 / CSS 注入器），
// 失败时直接指向函数与输入。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as plugin from '../src/client/plugin.js'
import * as theme from '../src/client/theme.js'
import * as format from '../src/client/format.js'
import * as math from '../src/client/chart-math.js'
import { host } from '../src/client/host.js'
import * as css from '../src/client/css.js'
import * as hooks from '../src/client/hooks.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('plugin.js 的 PLUGIN_ID 必须等于 package.json 的 name', () => {
  // CSS 标签 id 与 loader id 都由它派生；漂移会让样式清理失配（构建期也有断言）
  assert.equal(plugin.PLUGIN_ID, pkg.name)
  assert.equal(plugin.STYLE_TAG_ID, pkg.name + '/dashboard.module.css')
})

test('theme.js 的枚举与分档常量稳定', () => {
  assert.deepEqual(theme.RANGES.map((r) => r.key), ['today', '24h', '7d', '30d', '90d', 'custom'])
  assert.deepEqual(theme.MODES.map((m) => m.key), ['token', 'cost', 'dur'])
  assert.equal(theme.BREAK_PTS.length, 8)
  assert.deepEqual(Object.keys(theme.HEAT_SCALES), ['tokens', 'cost', 'dur'])
})

test('format.js：数值/时长/百分比/日期格式化', () => {
  assert.equal(format.pad2(5), '05')
  assert.equal(format.pad2(12), '12')

  assert.equal(format.fmtH9(0), '0')
  assert.equal(format.fmtH9(999), '999')
  assert.equal(format.fmtH9(1500), '1.5K')
  assert.equal(format.fmtH9(1500000), '1.5M')
  assert.equal(format.fmtH9(2e9), '2.0B')
  // 没有 T 档：超过 B 继续用 B（与旧版行为一致，改动需同步 README 截图）
  assert.equal(format.fmtH9(2e12), '2000.0B')
  assert.equal(format.fmtIntl(12345), '12,345')

  assert.equal(format.fmtCny(12.3456), '¥12.35')
  assert.equal(format.fmtCny(0), '¥0.00')
  assert.equal(format.fmtCny(0.001), '¥0.0010', '小于 1 分显示 4 位小数而不是归零')
  assert.equal(format.fmtUsd(7), '$1.00')

  assert.equal(format.fmtDur(45), '45s')
  assert.equal(format.fmtDur(90), '1m')
  assert.equal(format.fmtDur(3600), '1h')
  assert.equal(format.fmtDur(3660), '1h 1m')

  // fmtPct 是「百分点差值」格式（带符号），不是 0–1 比例；null 表示无对比基准。
  // 非有限值不在契约内：引擎的 pct() 只产出有限数或 null（见 engine-contracts 的
  // 「queryUsage 的 pct 只可能是 null 或有限值」），所以这里不替它兜底。
  assert.equal(format.fmtPct(0.5), '+0.5%')
  assert.equal(format.fmtPct(-2), '-2.0%')
  assert.equal(format.fmtPct(150), '+150%', '≥100 不带小数位')
  assert.equal(format.fmtPct(0), '0.0%')
  assert.equal(format.fmtPct(null), null)
  assert.equal(format.fmtPct(undefined), null)

  // 峰谷价区间展示：整数不补小数位
  assert.equal(format.fmtPriceRange(1, 2.0), '¥1~2/M')

  const custom = format.defaultCustom()
  assert.ok(Number.isFinite(custom.from) && Number.isFinite(custom.to) && custom.to > custom.from)
  assert.equal(format.dateToMs(format.fmtDateMs(custom.from)), custom.from, '日期往返必须无损')

  // 桶标签：天桶恒为 00:00，小时桶带北京时间小时；轴标签只在小时粒度补零
  const t = Date.UTC(2026, 9, 14, 4) // 北京时间 12:00
  assert.equal(format.fmtBucket(t, 'day'), '10月14日 00:00')
  assert.equal(format.fmtBucket(t, 'hour'), '10月14日 12:00')
  assert.equal(format.fmtDateMs(t), '2026-10-14')
  assert.equal(format.axisLabel('9', 'hour'), '09:00')
  assert.equal(format.axisLabel('10/14', 'day'), '10/14')
})

test('chart-math.js：分档、热力配色与雷达归一', () => {
  assert.equal(math.calLevel(0), 0)
  assert.equal(math.calLevel(1000000), 1)
  assert.equal(math.calLevel(250000000), 7)

  assert.deepEqual(math.heatBreakpoints([]), [])
  assert.equal(math.heatBreakpoints([1, 2, 3, 4]).length, 8)
  const bp = math.heatBreakpoints([1, 2, 3, 4])
  assert.equal(math.heatColor(0, bp, ['a', 'b']), 'a')
  assert.equal(math.heatColor(-5, bp, ['a', 'b']), 'a', '负值归到最低档')
  assert.equal(math.heatColor(1e12, bp, ['a', 'b']), 'b')

  assert.equal(math.RADAR_BAND(null, 1, 10), null)
  assert.equal(math.RADAR_BAND(1, 1, 10), 0)
  assert.equal(math.RADAR_BAND(10, 1, 10), 1)
  assert.equal(math.RADAR_BAND(1000, 1, 10), 1, '超出上界夹到 1')
  assert.equal(math.RADAR_BAND(0.5, 1, 10), 0, '低于下界夹到 0')

  assert.equal(math.RADAR_DEFS.length, math.RADAR_AXES)
  assert.ok(math.RADAR_DEFS.every((d) => typeof d.score === 'function' && typeof d.fmt === 'function'))
})

test('client/host.js：列表参数是 JSON 数组编码（F14 契约的客户端半边）', async () => {
  const seen = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (u) => { seen.push(u); return Promise.resolve({ json: () => Promise.resolve({ ok: true }) }) }
  try {
    await host.call('usage', {
      range: 'today',
      models: ['a', 'b'],
      projects: ['D:/x,y'], // 含逗号的 cwd 必须保持单元素
      empty: [],
      skip: null,
      undef: undefined,
      blank: '',
      n: 5
    })
  } finally {
    globalThis.fetch = originalFetch
  }
  const parsed = new URL('http://dash.local' + seen[0])
  assert.equal(parsed.pathname, '/dash-api/usage')
  assert.equal(parsed.searchParams.get('models'), '["a","b"]')
  assert.equal(parsed.searchParams.get('projects'), '["D:/x,y"]')
  assert.equal(parsed.searchParams.has('empty'), false, '空数组不产生参数')
  assert.equal(parsed.searchParams.has('skip'), false)
  assert.equal(parsed.searchParams.has('undef'), false)
  assert.equal(parsed.searchParams.has('blank'), false)
  assert.equal(parsed.searchParams.get('n'), '5')
  assert.equal(parsed.searchParams.get('range'), 'today')
})

test('client/css.js：注入器幂等（先清旧标签）且可清理', () => {
  const appended = []
  const removed = []
  const originalDocument = globalThis.document
  globalThis.document = {
    head: { appendChild: (t) => appended.push(t) },
    createElement: () => ({ dataset: {}, textContent: '', remove: () => removed.push(true) }),
    querySelectorAll: () => [{ remove: () => removed.push(true) }, { remove: () => removed.push(true) }]
  }
  try {
    const cleanup = css.injectStyles()
    assert.equal(appended.length, 1, '注入一个 style 标签')
    assert.equal(appended[0].dataset.pluginCss, plugin.STYLE_TAG_ID)
    assert.equal(appended[0].dataset.plugin, plugin.PLUGIN_ID)
    assert.equal(appended[0].textContent, css.CSS)
    assert.equal(removed.length, 2, '注入前先移除同 id 的旧标签（幂等）')
    cleanup()
    assert.equal(removed.length, 3, 'cleanup 只移除本次插入的标签')
  } finally {
    globalThis.document = originalDocument
  }
})

test('client/css.js：无 document（SSR / 非浏览器）时退化为 no-op', () => {
  const originalDocument = globalThis.document
  delete globalThis.document
  try {
    const cleanup = css.injectStyles()
    assert.equal(typeof cleanup, 'function')
    assert.doesNotThrow(() => cleanup())
  } finally {
    globalThis.document = originalDocument
  }
})

test('client/hooks.js：isPollingPaused 只在文档隐藏时为 true（F14 次项）', () => {
  // 三条 30s 轮询在隐藏标签页里没有任何用处：隐藏时暂停、可见时继续。
  // 缺失 document / 未知状态一律「不暂停」——宁可多发一次请求，也不要让看板
  // 在 SSR 或状态字符串变化时静默停止刷新。
  assert.equal(hooks.isPollingPaused({ visibilityState: 'hidden' }), true)
  assert.equal(hooks.isPollingPaused({ visibilityState: 'visible' }), false)
  assert.equal(hooks.isPollingPaused({ visibilityState: 'prerender' }), false)
  assert.equal(hooks.isPollingPaused(null), false)
  assert.equal(hooks.isPollingPaused(undefined), false)
  assert.equal(hooks.isPollingPaused({}), false, '没有 visibilityState 的宿主不暂停')

  // dashboard.js 必须真的用这个判定（构建产物里的调用点），否则纯函数测试会
  // 在「实现漏接线」时假绿。
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.ok(bundle.includes('visibilitychange'), 'live 客户端 bundle 应监听 visibilitychange')
})
