// README screenshot pipeline: render the REAL client bundle (lib/client.js) with
// REAL captured /dash-api fixtures in headless Chromium, then crop per-section.
//
//   node scripts/capture-screenshots.mjs [--range 30d] [--dark] [--refresh] [--raw]
//
// Fixtures are fetched from the live dashboard endpoints and cached in
// .tmp-fixtures/ (gitignored). Start DSH with the plugin mounted first, or pass
// --base http://127.0.0.1:<port>. Use --refresh to re-fetch.
//
// PRIVACY (audit F21): the PNGs are published in the README, and the fixtures carry
// real project ids (absolute cwd paths) and titles. Every capture therefore
// anonymizes them in memory — project-a, project-b, … — and asserts after render
// that no real identifier reached the page; see "anonymization" below. `--raw`
// renders the fixtures verbatim (local debugging only) and skips that assertion —
// never commit the output of a --raw run.
//
// Deps: react / react-dom / playwright are devDependencies (npm ci), no --no-save step.
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
const RAW = argv.includes('--raw')
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

// ---------- anonymization (privacy, audit F21) ----------
// The published PNGs must not carry real project names. The three places the
// dashboard reads them from are usage.meta.projects[].{id,title},
// usage.meta.dist.projects[].{id,label} and detail.rows[].project (records card);
// `detail.rows[].project` is a TITLE while the meta entries are id+title, so map
// both. Ids are ranked by the widest window's distribution so the legend keeps
// its natural order, and every id/title/label collected here becomes the
// denylist the leak assertion re-checks against the rendered page.
const NONE_ID = '__none__'
const WIDEST = ['90d', '30d', '7d', '24h', 'today']
const anonLabel = (i) => {
  let s = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(97 + (n % 26)) + s
  return 'project-' + s
}
function anonymize() {
  const order = []
  const seen = new Set()
  const add = (id) => { if (id && id !== NONE_ID && !seen.has(id)) { seen.add(id); order.push(id) } }
  for (const r of WIDEST) for (const p of ((data.usage[r] || {}).meta && data.usage[r].meta.dist || {}).projects || []) add(p.id)
  for (const r of WIDEST) for (const p of ((data.usage[r] || {}).meta || {}).projects || []) add(p.id)

  const byId = new Map()
  const byTitle = new Map()
  const real = new Set()
  order.forEach((id, i) => { byId.set(id, anonLabel(i)); real.add(id) })
  for (const r of WIDEST) for (const p of ((data.usage[r] || {}).meta || {}).projects || []) {
    if (!byId.has(p.id)) continue
    if (p.title) byTitle.set(p.title, byId.get(p.id))
    if (p.title) real.add(p.title)
  }

  const unmapped = []
  // `__none__` is the "ungrouped" bucket: its label is a UI string ("未分组"), not
  // a project, so it stays verbatim and is allowed through the fail-closed check.
  const noneLabels = new Set()
  for (const r of RANGES) {
    const meta = (data.usage[r] || {}).meta || {}
    for (const p of meta.projects || []) if (p.id === NONE_ID && p.title) noneLabels.add(p.title)
    for (const p of (meta.dist || {}).projects || []) if (p.id === NONE_ID && p.label) noneLabels.add(p.label)
  }
  for (const r of RANGES) {
    const meta = (data.usage[r] || {}).meta
    if (meta) {
      for (const p of meta.projects || []) {
        const a = byId.get(p.id)
        if (a) { real.add(p.id); real.add(p.title); p.id = 'anon/' + a; p.title = a }
        else if (p.id !== NONE_ID) unmapped.push(`meta.projects(${r}) ${p.id}`)
      }
      for (const p of (meta.dist || {}).projects || []) {
        const a = byId.get(p.id)
        if (a) { real.add(p.id); real.add(p.label); p.id = 'anon/' + a; p.label = a }
        else if (p.id !== NONE_ID) unmapped.push(`meta.dist.projects(${r}) ${p.id}`)
      }
    }
    for (const row of (data.detail[r] || {}).rows || []) {
      if (!row.project || noneLabels.has(row.project)) continue
      const a = byTitle.get(row.project)
      if (a) { real.add(row.project); row.project = a }
      else unmapped.push(`detail.rows(${r}) ${row.project}`)
    }
  }
  // Fail closed: a project the mapping does not know about would be painted verbatim.
  if (unmapped.length) {
    throw new Error('anonymization incomplete — ' + unmapped.length +
      ' project entr(y|ies) have no mapping: ' + [...new Set(unmapped)].slice(0, 5).join(' | '))
  }
  return [...real].filter((s) => typeof s === 'string' && s.length >= 4)
}

const realNames = RAW ? [] : anonymize()
if (RAW) console.log('!! --raw: fixtures rendered verbatim — do NOT commit these PNGs')
else console.log(`anonymized ${new Set([...realNames]).size} project identifier(s) → project-a …`)

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

// ---------- leak assertion ----------
// Every glyph the browser can paint comes from a text node or a title/aria/alt
// attribute, so those are exactly what this collects (SVG <text> included; the
// injected <style>/<script> bodies are skipped). Whitespace is stripped because
// hints/labels may wrap, and the comparison is case-insensitive.
if (!RAW) {
  const painted = await page.evaluate(() => {
    const parts = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const tag = n.parentElement && n.parentElement.tagName
      if (tag === 'STYLE' || tag === 'SCRIPT') continue
      parts.push(n.nodeValue || '')
    }
    const els = document.body.querySelectorAll('*')
    for (let i = 0; i < els.length; i++) {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) {
        const v = els[i].getAttribute(a)
        if (v) parts.push(v)
      }
    }
    return parts.join('\u0001')
  })
  const squeeze = (s) => String(s).replace(/\s+/g, '').toLowerCase()
  const hay = squeeze(painted)
  const leaked = realNames.filter((n) => hay.includes(squeeze(n)))
  if (leaked.length) {
    throw new Error('anonymization leak — real project identifier painted on the page: ' +
      leaked.slice(0, 5).join(' | '))
  }
  // Fixture-independent second net: project ids ARE local paths, so any painted
  // drive-letter path means some future UI change started rendering one. This
  // catches a new leak vector even when the denylist above is incomplete.
  const pathLeak = painted.split('\u0001').filter((t) => /[a-z]:[\\/]/i.test(t))
  if (pathLeak.length) {
    throw new Error('anonymization leak — a filesystem path is painted on the page: ' +
      pathLeak.slice(0, 3).join(' | '))
  }
  console.log(`leak check ok: 0 / ${realNames.length} real identifier(s) and 0 painted path(s)`)
}

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

// Only these six crops are referenced by README.md / README.en.md. Everything else
// this run produced (full-page / extra per-card crops) is pruned so picture/ stays
// exactly the reviewed, published set — an unreviewed crop must never end up as an
// untracked file that gets committed by accident. `--keep-all` opts out.
const PUBLISHED = ['dashboard-overview', 'trend-heatmap', 'distributions', 'calendar-records', 'radar-cache', 'dashboard-dark']
if (!argv.includes('--keep-all')) {
  for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith('.png') || PUBLISHED.includes(f.slice(0, -4))) continue
    fs.rmSync(path.join(OUT, f))
    console.log(`  pruned ${f} (not referenced by the READMEs)`)
  }
}