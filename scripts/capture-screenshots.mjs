// README screenshot pipeline: render the REAL client bundle (lib/client.js) with
// REAL captured /dash-api fixtures in headless Chromium, then crop per-section.
//
//   node scripts/capture-screenshots.mjs [--range 30d] [--dark] [--refresh]
//
// Fixtures are fetched from the live dashboard endpoints and cached in
// .tmp-fixtures/ (gitignored). Start DSH with the plugin mounted first, or pass
// --base http://127.0.0.1:<port>. Use --refresh to re-fetch.
//
// One-time deps (not saved to package.json):
//   npm install --no-save react@18.3.1 react-dom@18.3.1 playwright
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const ROOT = path.resolve(import.meta.dirname, '..')
const FIX = path.join(ROOT, '.tmp-fixtures')
const OUT = path.join(ROOT, 'picture')
const HARNESS = path.join(ROOT, '.tmp-harness')
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(HARNESS, { recursive: true })

const argv = process.argv.slice(2)
const argOf = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const RANGE = argOf('--range', '30d')
const DARK = argv.includes('--dark')
const REFRESH = argv.includes('--refresh')
const BASE = argOf('--base', 'http://127.0.0.1:19387')
const EXE = process.env.CHROME_EXE ||
  path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe')

// ---------- fixtures ----------
const RANGES = ['today', '24h', '7d', '30d', '90d']

// Fetch from the live plugin endpoints when a fixture is missing (or --refresh).
async function ensureFixtures() {
  fs.mkdirSync(FIX, { recursive: true })
  let fetched = 0
  for (const ep of ['usage', 'detail', 'calendar']) {
    for (const r of RANGES) {
      const file = path.join(FIX, `${ep}-${r}.json`)
      if (!REFRESH && fs.existsSync(file)) continue
      const url = ep === 'calendar'
        ? `${BASE}/dash-api/calendar`
        : `${BASE}/dash-api/${ep}?range=${r}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fixture fetch failed: ${url} -> HTTP ${res.status}`)
      fs.writeFileSync(file, JSON.stringify(await res.json()), 'utf8')
      fetched++
    }
  }
  if (fetched) console.log(`fetched ${fetched} fixture(s) from ${BASE}`)
}
await ensureFixtures()

const fx = (n) => JSON.parse(fs.readFileSync(path.join(FIX, n), 'utf8'))
const data = {}
for (const ep of ['usage', 'detail', 'calendar']) {
  data[ep] = {}
  for (const r of RANGES) data[ep][r] = fx(`${ep}-${r}.json`)
}

// ---------- page ----------
const client = fs.readFileSync(path.join(ROOT, 'lib/client.js'), 'utf8')
const react = fs.readFileSync(path.join(ROOT, 'node_modules/react/umd/react.production.min.js'), 'utf8')
const reactDom = fs.readFileSync(path.join(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'), 'utf8')

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:${DARK ? '#14161a' : '#f3f4f6'}}
  #root{width:1320px}
</style></head><body>
${DARK ? '<script>document.addEventListener("DOMContentLoaded",function(){document.body.setAttribute("data-ds-dark-theme","")});</script>' : ''}
<div id="root"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>window.__FIXTURE__=${JSON.stringify(data)};</script>
<script>
(function(){
  var F = window.__FIXTURE__;
  // seed the plugin's own preference key so it opens on the requested range
  try {
    localStorage.setItem('dsh.usageDashboard.v1', JSON.stringify({ range: ${JSON.stringify(RANGE)} }));
  } catch (e) {}
  window.__FETCHES__ = [];
  window.fetch = function(url){
    var u = String(url);
    var m = u.match(/\\/dash-api\\/([a-z]+)\\??(.*)$/);
    if(!m) return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({});}});
    var ep = m[1];
    var params = new URLSearchParams(m[2]||'');
    var range = params.get('range') || '90d';
    var payload = (F[ep] && (F[ep][range] || F[ep]['30d'])) || {};
    window.__FETCHES__.push({url:u, ep:ep, range:range});
    return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(payload);}});
  };
  window.__CAPTURED__ = null;
  window.__ModuleLoader__ = { load: function(def){
    var req = function(id){ if(id==='react') return window.React; throw new Error('unexpected require '+id); };
    var exports = def.factory(req);
    var ctx = {
      get: function(name){ if(name==='slots') return { inject: function(n,fn){fn();}, register: function(d,r){ window.__CAPTURED__=r; return function(){}; } }; return undefined; },
      effect: function(fn){ try{ fn(); }catch(e){ window.__EFFECT_ERR__ = String(e); } },
      on: function(){}, interval: function(){ return function(){}; }, logger: console
    };
    exports.apply(ctx);
  }};
})();
</script>
<script>${client}</script>
<script>
(function(){
  var React=window.React, ReactDOM=window.ReactDOM;
  if(${DARK}) document.body.setAttribute('data-ds-dark-theme','');
  var r=window.__CAPTURED__;
  if(!r){document.getElementById('root').textContent='NO CAPTURED';return;}
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(r));
})();
</script>
</body></html>`

const htmlPath = path.join(HARNESS, DARK ? 'render-dark.html' : 'render-light.html')
fs.writeFileSync(htmlPath, html, 'utf8')

// ---------- capture ----------
const browser = await chromium.launch({ executablePath: EXE })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'))
await page.waitForTimeout(4500)

const state = await page.evaluate(() => ({
  effectErr: window.__EFFECT_ERR__ || null,
  fetches: (window.__FETCHES__ || []).length,
  rootH: Math.round(document.getElementById('root').getBoundingClientRect().height),
  loading: !!document.querySelector('.dd-loading'),
  empty: !!document.querySelector('.dd-empty'),
  calCells: document.querySelectorAll('.dd-cal-cell').length,
  svg: document.querySelectorAll('svg').length,
  kpis: document.querySelectorAll('.dd-kpi').length,
  records: document.querySelectorAll('.dd-records tbody tr').length
}))
console.log('render state:', JSON.stringify(state))
if (pageErrors.length) console.log('pageerrors:', pageErrors.slice(0, 3))
if (state.effectErr) throw new Error('effect error: ' + state.effectErr)
if (state.loading || state.empty) throw new Error('page did not finish loading (loading/empty state)')

// box of a selector, in CSS px
async function box(sel, nth = 0) {
  return page.evaluate(([s, n]) => {
    const el = document.querySelectorAll(s)[n]
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }
  }, [sel, nth])
}

const shots = []
async function shot(name, clip, pad = 12) {
  const file = path.join(OUT, name + '.png')
  const opts = { path: file }
  if (clip) {
    opts.clip = {
      x: Math.max(0, clip.x - pad), y: Math.max(0, clip.y - pad),
      width: clip.w + pad * 2, height: clip.h + pad * 2
    }
    opts.fullPage = true
  } else {
    opts.fullPage = true
  }
  await page.screenshot(opts)
  const kb = Math.round(fs.statSync(file).size / 1024)
  shots.push({ name, file, kb })
  console.log(`  saved ${name}.png (${kb} KB)`)
}

// full page
await shot(DARK ? 'dashboard-dark' : 'dashboard-full')

if (!DARK) {
  // KPI + filter bar
  const filters = await box('.dd-filters')
  const rows = await box('.dd-rows')
  if (filters && rows) {
    await shot('dashboard-overview', {
      x: Math.min(filters.x, rows.x), y: filters.y,
      w: Math.max(filters.w, rows.w),
      h: (rows.y + rows.h) - filters.y
    })
  }
  // trend + hourly heatmap
  const trend = await box('.dd-chart', 0)
  const heat = await box('.dd-chart', 1)
  if (trend && heat) await shot('trend-heatmap', { x: trend.x, y: trend.y, w: trend.w, h: (heat.y + heat.h) - trend.y })
  // radar + cache insight (side by side row)
  const radar = await box('.dd-radar')
  const cache = await box('.dd-chart', 2)
  if (radar && cache) {
    const x = Math.min(radar.x, cache.x)
    await shot('radar-cache', { x, y: radar.y, w: Math.max(radar.x + radar.w, cache.x + cache.w) - x, h: Math.max(radar.h, cache.h) })
    await shot('cache-insight', cache, 10)
    await shot('radar', radar, 10)
  }
  // distributions
  const dist0 = await box('.dd-dist', 0)
  const dist1 = await box('.dd-dist', 1)
  if (dist0 && dist1) await shot('distributions', { x: dist0.x, y: dist0.y, w: dist0.w, h: (dist1.y + dist1.h) - dist0.y })
  // calendar + records
  const cal = await box('.dd-cal')
  const rec = await box('.dd-records')
  if (cal && rec) await shot('calendar-records', { x: Math.min(cal.x, rec.x), y: cal.y, w: Math.max(cal.w, rec.w), h: (rec.y + rec.h) - cal.y })
  if (rec) await shot('records', rec, 10)
}

await browser.close()
console.log('\n' + shots.length + ' screenshot(s) written to picture/')