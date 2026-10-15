// G2 兼容性核验：在**真实浏览器**里用**活宿主的数据**跑一遍客户端半边。
//
//   node scripts/oneoff/verify-client-live.mjs [--base http://127.0.0.1:19387] [--range 7d] [--out <dir>]
//
// 为什么需要它：`scripts/client-check.mjs` 只做 SSR + 产物契约（没有浏览器、没有真实
// 请求），`capture-screenshots.mjs` 是截图流水线（数据是**缓存 fixture**）。本脚本补上
// 中间那一环——把 `lib/client.js`（真实产物）按 DSH client runtime 的加载契约
// （`window.__ModuleLoader__.load({id, factory})` + `require('react')` + `ctx.get('slots')`）
// 装进 Chromium，页面**同源代理**到活的 `/dash-api/*`，于是：
//   * 槽注册契约（`slots.inject('settings.section', …)` → `register({name,id,order,label})`）
//   * 样式注入（`<style data-plugin-css=…>`）
//   * 真实渲染（10 个 KPI、趋势/热力/日历/记录卡，日历 371 格）
//   * 导出 CSV（点真实按钮 → 真实下载 → 解析列数）
// 全部在真实浏览器里验证。注意：本脚本**不**驱动桌面端自己的那个窗口（它的 URL 带
// token，取不到），所以「DSH 设置壳把 section 画进侧栏」这一步在 COMPAT.md 里如实标注
// 为未在活窗口内验证。
//
// 证据产物（截图含真实项目名）写到系统临时目录，**不要提交**。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { chromium } from 'playwright'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const argv = process.argv.slice(2)
const argOf = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const BASE = argOf('--base', 'http://127.0.0.1:19387')
const RANGE = argOf('--range', '7d')
const OUT = argOf('--out', path.join(os.tmpdir(), 'dsh-usage-dashboard-g2'))
fs.mkdirSync(OUT, { recursive: true })
const EXE = process.env.CHROME_EXE ||
  path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe')

const fails = []
const check = (label, ok, detail) => {
  console.log((ok ? '  ✔ ' : '  ✘ ') + label + (detail === undefined ? '' : '  [' + detail + ']'))
  if (!ok) fails.push(label + (detail === undefined ? '' : ' → ' + detail))
}

// 活宿主可达性 + 版本（桌面端从 app.asar 的 package.json 读，能读就读）
let reachable = false
try {
  const r = await fetch(BASE + '/dash-api/usage?range=today')
  reachable = r.status === 200
} catch (e) { /* reported below */ }
if (!reachable) {
  console.error('live host not reachable at ' + BASE + ' — start DSH with the plugin mounted first')
  process.exit(1)
}

const react = fs.readFileSync(path.join(ROOT, 'node_modules/react/umd/react.production.min.js'), 'utf8')
const reactDom = fs.readFileSync(path.join(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'), 'utf8')
const client = fs.readFileSync(path.join(ROOT, 'lib/client.js'), 'utf8')

const page_html = `<!doctype html><html><head><meta charset="utf-8"><title>G2 client verify</title>
<style>html,body{margin:0;background:#f3f4f6}#root{width:1320px}</style></head><body>
<div id="root"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>
(function(){
  try { localStorage.setItem('dsh.usageDashboard.v1', JSON.stringify({ range: ${JSON.stringify(RANGE)} })); } catch (e) {}
  window.__G2 = { injected: [], reg: null, cleanupKinds: [], effectErr: null, exports: null, loadErr: null, disposed: false };
  window.__ModuleLoader__ = { load: function(def){
    var req = function(id){ if (id === 'react') return window.React; throw new Error('unexpected require ' + id) };
    try {
      var exports = def.factory(req);
      window.__G2.exports = { inject: exports.inject, hasApply: typeof exports.apply === 'function' };
      var slots = {
        inject: function(name, fn){ window.__G2.injected.push(name); fn(); },
        register: function(opts, render){ window.__G2.reg = { opts: opts, render: render }; return function(){ window.__G2.disposed = true } }
      };
      var ctx = {
        get: function(n){ return n === 'slots' ? slots : undefined },
        effect: function(fn){ var c = fn(); window.__G2.cleanupKinds.push(typeof c); return function(){ if (typeof c === 'function') c() } },
        on: function(){}, logger: console
      };
      exports.apply(ctx);
    } catch (e) { window.__G2.loadErr = String(e && e.stack || e) }
  }};
})();
</script>
<script>${client}</script>
</body></html>`

// 本地同源代理：file:// 下 fetch 会被 CORS 挡，所以页面从本进程加载，
// /dash-api/* 原样转发给活宿主 —— 客户端代码走的是它自己的真实请求路径。
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname.startsWith('/dash-api/')) {
    try {
      const upstream = await fetch(BASE + req.url)
      const body = await upstream.text()
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' })
      res.end(body)
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'proxy failed: ' + String(e && e.message) }))
    }
    return
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(page_html)
    return
  }
  // 浏览器会自动请求 favicon；本 harness 没有图标，回 204 而不是 404，
  // 否则「无 console error」断言会被这条无关噪音打断。
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return }
  res.writeHead(404); res.end('not found')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const origin = 'http://127.0.0.1:' + port
console.log('G2 client verify — host ' + BASE + ', range ' + RANGE + ', harness ' + origin)

const browser = await chromium.launch({ executablePath: EXE })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  const consoleErrors = []
  const badResponses = []
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
  page.on('response', (r) => { if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.url()) })

  await page.goto(origin + '/', { waitUntil: 'load' })
  // 挂载：DSH 的 settings.section 渲染函数就是 register 的第二个参数
  await page.evaluate(() => {
    const g2 = window.__G2
    if (!g2.reg) return
    window.ReactDOM.createRoot(document.getElementById('root'))
      .render(window.React.createElement(g2.reg.render))
  })
  await page.waitForTimeout(4000)

  const state = await page.evaluate(() => {
    const g2 = window.__G2
    const opts = g2.reg && g2.reg.opts
    return {
      inject: g2.exports && g2.exports.inject,
      hasApply: !!(g2.exports && g2.exports.hasApply),
      loadErr: g2.loadErr,
      effectErr: g2.effectErr,
      injected: g2.injected,
      regName: opts && opts.name,
      regId: opts && opts.id,
      regOrder: opts && opts.order,
      regLabel: opts && typeof opts.label === 'function' ? opts.label() : opts && opts.label,
      cleanupKinds: g2.cleanupKinds,
      styleTag: !!document.querySelector('style[data-plugin-css]'),
      styleCssLen: (document.querySelector('style[data-plugin-css]') || {}).textContent ? document.querySelector('style[data-plugin-css]').textContent.length : 0,
      styleHasRootSel: /\.dd-root\{/.test((document.querySelector('style[data-plugin-css]') || {}).textContent || ''),
      kpi: document.querySelectorAll('.dd-kpi').length,
      svg: document.querySelectorAll('svg').length,
      charts: document.querySelectorAll('.dd-chart').length,
      calCells: document.querySelectorAll('.dd-cal-cell').length,
      records: document.querySelectorAll('.dd-records tbody tr').length,
      dist: document.querySelectorAll('.dd-dist').length,
      radar: document.querySelectorAll('.dd-radar').length,
      loading: !!document.querySelector('.dd-loading'),
      empty: !!document.querySelector('.dd-empty'),
      exportBtn: !!document.querySelector('.dd-export-btn'),
      rootH: Math.round(document.getElementById('root').getBoundingClientRect().height)
    }
  })

  check('loader 契约：exports.inject === [\'slots\']', JSON.stringify(state.inject) === '["slots"]', JSON.stringify(state.inject))
  check('loader 契约：exports.apply 是函数', state.hasApply)
  check('客户端加载无异常', !state.loadErr, state.loadErr || 'ok')
  check('ctx.effect 无异常（样式/图标注册）', !state.effectErr, state.effectErr || 'ok')
  check('槽注入名 = settings.section', state.injected.join(',') === 'settings.section', state.injected.join(','))
  check('槽注册 name = settings.section', state.regName === 'settings.section', String(state.regName))
  check('槽注册 id = dashboard', state.regId === 'dashboard', String(state.regId))
  check('槽注册 order = 30', state.regOrder === 30, String(state.regOrder))
  check('槽注册 label = 数据看板', state.regLabel === '数据看板', String(state.regLabel))
  check('ctx.effect 都返回 dispose 函数', state.cleanupKinds.length >= 2 && state.cleanupKinds.every((k) => k === 'function'), JSON.stringify(state.cleanupKinds))
  check('样式注入：<style data-plugin-css> 存在且含 .dd-root 规则', state.styleTag && state.styleHasRootSel, 'len=' + state.styleCssLen)
  check('渲染：10 个 KPI', state.kpi === 10, String(state.kpi))
  check('渲染：图表 SVG 已画出', state.svg >= 10, 'svg=' + state.svg + ' charts=' + state.charts)
  // 日历是 7 格/周的多周网格：真实宽度下渲染 40 周（280 格），与 README 截图核对基线一致
  check('渲染：日历格数是 7 的倍数且 ≥280', state.calCells % 7 === 0 && state.calCells >= 280, String(state.calCells))
  check('渲染：记录卡有数据行', state.records > 0, String(state.records))
  check('渲染：分布 + 雷达卡在场', state.dist >= 2 && state.radar >= 1, 'dist=' + state.dist + ' radar=' + state.radar)
  check('渲染：没有 loading/empty 兜底态', !state.loading && !state.empty)
  check('渲染：无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ') || 'none')
  check('渲染：无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ') || 'none')
  check('渲染：无 4xx/5xx 响应', badResponses.length === 0, badResponses.slice(0, 2).join(' | ') || 'none')

  // ---- 导出 CSV：点真实按钮 → 真实下载 → 解析列数 ----
  if (state.exportBtn) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('.dd-export-btn')
    ])
    const file = path.join(OUT, 'export-' + RANGE + '.csv')
    await download.saveAs(file)
    const csv = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const lines = csv.split('\r\n').filter((l) => l.length > 0)
    const header = lines[0] || ''
    // 简单 CSV 解析（够用于列数断言；字段内不含未转义换行）
    const cells = (line) => {
      const out = []; let cur = ''; let q = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
        else if (ch === '"' && cur === '') q = true
        else if (ch === ',') { out.push(cur); cur = '' }
        else cur += ch
      }
      out.push(cur)
      return out
    }
    const colCounts = new Set(lines.map((l) => cells(l).length))
    check('导出 CSV：header 正确', header === '时间,项目,模型,工具,输入tokens,输出tokens,缓存tokens,费用(元)', header)
    check('导出 CSV：每行 8 列（含公式型字段的整体引用）', colCounts.size === 1 && colCounts.has(8), [...colCounts].join('/'))
    check('导出 CSV：行数 > 1', lines.length > 1, String(lines.length))
  } else {
    check('导出按钮在场（records.total > 0 才渲染）', false, 'no .dd-export-btn')
  }

  const shot = path.join(OUT, 'g2-' + RANGE + '.png')
  await page.screenshot({ path: shot, fullPage: true })
  console.log('  screenshot: ' + shot + '  (real project names — do not commit)')
} finally {
  await browser.close()
  server.close()
}

console.log('')
if (fails.length) {
  console.error('G2 client verify FAILED (' + fails.length + '):')
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log('G2 client verify passed — ' + '所有断言通过（证据目录 ' + OUT + '）')
