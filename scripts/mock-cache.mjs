// 缓存卡重设计 mock：拉真实 API 数据 → 生成自包含 HTML（含两种视图），供 headless 截图预览
import { writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:3080'
async function get(u) { const r = await fetch(BASE + u); return r.json() }

const [d90, d30] = await Promise.all([get('/dash-api/usage?range=90d'), get('/dash-api/usage?range=30d')])

// ---- 真实口径计算 ----
const savedOf = (m) => (m.p && m.cacheRead) ? Math.max(0, m.cacheRead * (m.p[0] - m.p[2]) / 1e6) : 0
const models30 = [...d30.meta.models].filter((m) => m.cacheRead > 0).sort((a, b) => b.cacheRead - a.cacheRead)
const totalSaved30 = models30.reduce((s, m) => s + savedOf(m), 0)
const buckets = d90.buckets
const hitVals = buckets.filter((b) => b.cacheHitRate != null).map((b) => b.cacheHitRate)
const covVals = buckets.filter((b) => b.cacheHitRate != null).map((b) => b.cacheCoverage)
const fmtN = (e) => e >= 1e9 ? (e / 1e9).toFixed(1) + 'B' : e >= 1e6 ? (e / 1e6).toFixed(1) + 'M' : e >= 1e3 ? (e / 1e3).toFixed(1) + 'K' : String(Math.round(e))
const fmtY = (v) => '¥' + Math.round(v).toLocaleString('en-US')

console.log('window(30d) hit=%s cov=%s saved=%s', d30.totals.cacheHitRate.toFixed(1), d30.totals.cacheCoverage.toFixed(1), fmtY(totalSaved30))
console.log('top saved models:', models30.map((m) => m.id + ':' + fmtY(savedOf(m))).slice(0, 8).join('  '))

// ---- 图表几何 ----
const W = 460, H = 168, PAD = { l: 38, r: 14, t: 10, b: 22 }
const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b
const n = buckets.length

// 自适应 y 域：数据 min/max 外扩，取整到 nice 步长
function niceDomain(vals) {
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const span = Math.max(4, hi - lo)
  const step = span <= 6 ? 2 : span <= 15 ? 5 : 10
  const dLo = Math.max(0, Math.floor((lo - span * 0.15) / step) * step)
  const dHi = Math.min(100, Math.ceil((hi + span * 0.15) / step) * step)
  return [dLo, Math.max(dHi, dLo + step)]
}
const domain = niceDomain([...hitVals, ...covVals])
const toX = (i) => PAD.l + (i / Math.max(1, n - 1)) * PW
const toY = (v) => PAD.t + PH * (1 - (Math.max(domain[0], Math.min(domain[1], v)) - domain[0]) / (domain[1] - domain[0]))

// monotone cubic（Fritsch–Carlson）平滑
function smooth(pts) {
  const m = pts.length
  if (m < 2) return ''
  const dx = [], dy = [], sl = []
  for (let i = 0; i < m - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; sl[i] = dy[i] / dx[i] }
  const t = [sl[0]]
  for (let i = 1; i < m - 1; i++) t[i] = (sl[i - 1] * sl[i] <= 0) ? 0 : (sl[i - 1] + sl[i]) / 2
  t[m - 1] = sl[m - 2]
  for (let i = 0; i < m - 1; i++) if (sl[i] === 0) { t[i] = 0; t[i + 1] = 0 }
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1)
  for (let i = 0; i < m - 1; i++) {
    const h3 = dx[i] / 3
    d += ' C' + (pts[i][0] + h3).toFixed(1) + ' ' + (pts[i][1] + t[i] * h3).toFixed(1) +
      ' ' + (pts[i + 1][0] - h3).toFixed(1) + ' ' + (pts[i + 1][1] - t[i + 1] * h3).toFixed(1) +
      ' ' + pts[i + 1][0].toFixed(1) + ' ' + pts[i + 1][1].toFixed(1)
  }
  return d
}
// 连续有数据段
const segs = []
for (let i = 0; i < n; i++) {
  const b = buckets[i]
  if (b.cacheHitRate == null) continue
  const last = segs[segs.length - 1]
  if (last && last.end === i - 1) { last.end = i; last.pts.push([toX(i), toY(b.cacheHitRate)]) }
  else segs.push({ start: i, end: i, pts: [[toX(i), toY(b.cacheHitRate)]] })
}
const hitPaths = segs.map((s) => smooth(s.pts))
const firstSeg = segs[0], lastSeg = segs[segs.length - 1]
const areaPath = (() => {
  const all = segs.flatMap((s) => s.pts)
  // 用整段（首末有数据）做渐变底
  const a = toX(firstSeg.start), b2 = toX(lastSeg.end)
  const pa = firstSeg.pts[0], pb = lastSeg.pts[lastSeg.pts.length - 1]
  return 'M' + a.toFixed(1) + ' ' + (PAD.t + PH) + ' L' + pa[0].toFixed(1) + ' ' + pa[1].toFixed(1) +
    (hitPaths.length === 1 ? hitPaths[0].replace(/^M[^C]+/, '') : '') +
    ' L' + pb[0].toFixed(1) + ' ' + (PAD.t + PH) + ' Z'
})()
const covPts = buckets.map((b, i) => b.cacheHitRate == null ? null : [toX(i), toY(b.cacheCoverage)])
const covPath = smooth(covPts.filter(Boolean))
const hitAvg = hitVals.reduce((s, v) => s + v, 0) / hitVals.length
const lastIdx = lastSeg.end, lastB = buckets[lastIdx]

const yTicks = []
for (let v = domain[0]; v <= domain[1]; v += (domain[1] - domain[0]) / 4) yTicks.push(Math.round(v))
const xLabels = buckets.map((b, i) => (i % 3 === 0 || i === n - 1) ? b.label.split('-')[0] : '')

// 用量视图（stacked：缓存读取 vs 未命中计费输入）
const vol = buckets.map((b) => ({ read: b.cacheRead || 0, miss: Math.max(0, (b.billedInput || 0) - (b.cacheRead || 0)) }))
const volMax = Math.max(...vol.map((v) => v.read + v.miss))
const BW = PW / n * 0.56

const cardCss = `
body{margin:0;background:#f3f4f6;font-family:"JetBrains Mono",ui-monospace,"PingFang SC","Microsoft YaHei",monospace;color:#09090b}
.wrap{display:flex;gap:24px;padding:24px;align-items:flex-start}
.card{width:520px;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:20px 24px;box-sizing:border-box}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.title{font-size:15px;font-weight:500;color:#52525b;display:flex;gap:6px;align-items:center}
.seg{display:inline-flex;border-radius:999px;background:#e2e3e7;padding:2px;gap:1px}
.segb{border:none;background:transparent;font-size:11px;padding:3px 10px;border-radius:999px;color:#52525b;cursor:pointer;font-family:inherit}
.segb.on{background:#18181b;color:#fff;font-weight:600}
.kpis{display:flex;gap:8px;margin-bottom:12px}
.kpi{flex:1;border:1px solid #ececf0;border-radius:8px;padding:8px 12px;background:#fafafa}
.kpi .lab{font-size:10px;color:#a1a1aa;letter-spacing:.4px}
.kpi .val{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:#18181b;margin-top:2px}
.kpi .val small{font-size:11px;color:#71717a;font-weight:500}
.kpi .delta{font-size:10px;font-weight:700;margin-left:6px}
.up{color:#10b981}.down{color:#ef4444}
.kpi.hero{background:linear-gradient(135deg,#ecfdf5 0%,#f6fefb 60%);border-color:#d1fae5}
.kpi.hero .val{color:#047857}
.models{margin-top:10px;border-top:1px solid #f0f0f2;padding-top:8px}
.mtitle{font-size:10px;color:#a1a1aa;letter-spacing:.4px;margin-bottom:4px;display:flex;justify-content:space-between}
.mrow{display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer}
.mrow:hover{background:#fafafa}
.dot{width:7px;height:7px;border-radius:99px;flex:none}
.mname{font-size:11px;color:#3f3f46;width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
.mtrack{flex:1;height:12px;position:relative;background:#f6f6f8;border-radius:3px;overflow:hidden}
.mfill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;opacity:.85}
.mcov{position:absolute;top:2px;bottom:2px;width:2px;background:#f59e0b;border-radius:2px;opacity:.9}
.mval{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:#18181b;width:46px;text-align:right;flex:none}
.msave{font-size:10px;color:#059669;width:64px;text-align:right;flex:none;font-variant-numeric:tabular-nums}
.legend{display:flex;gap:14px;font-size:10px;color:#71717a;margin:2px 0 6px}
.lg{display:flex;align-items:center;gap:5px}
.sw{width:14px;height:0;border-top:2px solid}
svg text{font-family:inherit}
.tip{position:absolute;background:#fff;border:1px solid #d4d4d8;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.08);padding:7px 10px;font-size:11px;pointer-events:none}
`

const lineEls = hitPaths.map((d) => `<path d="${d}" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round"/>`)
const covEl = `<path d="${covPath}" fill="none" stroke="#f59e0b" stroke-width="1.4" stroke-dasharray="4 3" opacity=".8"/>`
const avgEl = `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${toY(hitAvg)}" y2="${toY(hitAvg)}" stroke="#a1a1aa" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/><text x="${W - PAD.r}" y="${toY(hitAvg) - 3}" text-anchor="end" font-size="9" fill="#a1a1aa">均值 ${hitAvg.toFixed(1)}%</text>`
const gapEl = (() => {
  let s = ''
  let i = 0
  while (i < n) {
    if (buckets[i].cacheHitRate == null) {
      const st = i
      while (i < n && buckets[i].cacheHitRate == null) i++
      s += `<rect x="${(toX(st) - 6).toFixed(1)}" y="${PAD.t}" width="${(Math.max(12, toX(Math.min(i, n - 1)) - toX(st)) + 12).toFixed(1)}" height="${PH}" fill="#fafafa"/>`
      continue
    }
    i++
  }
  return s
})()
const dotsEl = buckets.map((b, i) => b.cacheHitRate == null
  ? `<circle cx="${toX(i).toFixed(1)}" cy="${(PAD.t + PH).toFixed(1)}" r="2" fill="none" stroke="#d4d4d8" stroke-width="1.5"/>`
  : (i === lastIdx ? '' : `<circle cx="${toX(i).toFixed(1)}" cy="${toY(b.cacheHitRate).toFixed(1)}" r="2.4" fill="#10b981" stroke="#fff" stroke-width="1.2"/>`)).join('')
const lastPt = `<g><circle cx="${toX(lastIdx).toFixed(1)}" cy="${toY(lastB.cacheHitRate).toFixed(1)}" r="4" fill="#10b981" stroke="#fff" stroke-width="1.8"/>
<rect x="${(toX(lastIdx) - 54).toFixed(1)}" y="${(toY(lastB.cacheHitRate) - 24).toFixed(1)}" width="46" height="17" rx="8" fill="#10b981"/>
<text x="${(toX(lastIdx) - 31).toFixed(1)}" y="${(toY(lastB.cacheHitRate) - 12).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${lastB.cacheHitRate.toFixed(1)}%</text></g>`
const yGrid = yTicks.map((v) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${toY(v).toFixed(1)}" y2="${toY(v).toFixed(1)}" stroke="#f0f0f2"/><text x="${PAD.l - 5}" y="${(toY(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af">${v}%</text>`).join('')
const xGrid = xLabels.map((l, i) => l ? `<text x="${toX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#9ca3af">${l}</text>` : '').join('')

const hitView = `<div class="card"><div class="head"><div class="title">⚡ 缓存洞察</div>
<div class="seg"><button class="segb on">命中率</button><button class="segb">用量</button><button class="segb" style="min-width:44px">0–100 ⤓</button></div></div>
<div class="kpis">
  <div class="kpi"><div class="lab">窗口命中率</div><div class="val">94.9%<span class="delta up">▲2.1pp</span></div></div>
  <div class="kpi"><div class="lab">遥测覆盖率</div><div class="val">92.3%</div></div>
  <div class="kpi hero"><div class="lab">预计节省 ⛁</div><div class="val">${fmtY(totalSaved30)}</div></div>
</div>
<div class="legend"><span class="lg"><span class="sw" style="border-color:#10b981"></span>命中率</span><span class="lg"><span class="sw" style="border-color:#f59e0b;border-top-style:dashed"></span>覆盖率</span><span class="lg"><span class="sw" style="border-color:#a1a1aa;border-top-style:dotted"></span>均值</span></div>
<div style="position:relative"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10b981" stop-opacity=".14"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></linearGradient></defs>
${gapEl}${yGrid}
<path d="${areaPath}" fill="url(#g)"/>
${covEl}${avgEl}${lineEls.join('')}${dotsEl}${lastPt}${xGrid}
<line x1="${toX(11).toFixed(1)}" y1="${PAD.t}" x2="${toX(11).toFixed(1)}" y2="${PAD.t + PH}" stroke="#a1a1aa" stroke-dasharray="3 3" opacity=".6"/>
<circle cx="${toX(11).toFixed(1)}" cy="${toY(buckets[11].cacheHitRate).toFixed(1)}" r="4" fill="#10b981" stroke="#fff" stroke-width="1.8"/>
</svg>
<div class="tip" style="left:${(toX(11) / W * 100).toFixed(0)}%;top:6px"><div style="color:#52525b">8/31-9/6</div><div style="font-weight:700">命中率: 91.3%</div><div style="color:#71717a">缓存读取: 544.0M</div><div style="color:#71717a">覆盖率: 89.6%</div></div>
</div>
<div class="models"><div class="mtitle"><span>模型缓存排行 · 读取量 Top ${Math.min(6, models30.length)}（点击筛选）</span><span style="color:#d4d4d8">▾ 展开</span></div>
${models30.slice(0, 6).map((m, i) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
  const name = m.id.length > 15 ? m.id.slice(0, 14) + '…' : m.id
  return `<div class="mrow"><span class="dot" style="background:${colors[i % 6]}"></span><span class="mname">${name}</span>
<div class="mtrack"><div class="mfill" style="width:${m.cacheHitRate.toFixed(1)}%;background:${colors[i % 6]}"></div><div class="mcov" style="left:${Math.min(99, m.cacheCoverage).toFixed(1)}%"></div></div>
<span class="mval">${m.cacheHitRate.toFixed(1)}%</span><span class="msave">省 ${fmtY(savedOf(m))}</span></div>`
}).join('')}
</div></div>`

// 用量视图
const volBars = vol.map((v, i) => {
  const tot = v.read + v.miss
  if (!tot) return `<rect x="${(toX(i) - BW / 2).toFixed(1)}" y="${(PAD.t + PH - 2).toFixed(1)}" width="${BW.toFixed(1)}" height="2" fill="#f0f0f2"/>`
  const hTot = PH * tot / volMax
  const hRead = hTot * v.read / tot
  return `<g><rect x="${(toX(i) - BW / 2).toFixed(1)}" y="${(PAD.t + PH - hTot).toFixed(1)}" width="${BW.toFixed(1)}" height="${hTot.toFixed(1)}" rx="2" fill="#e4e4e7"/>
<rect x="${(toX(i) - BW / 2).toFixed(1)}" y="${(PAD.t + PH - hRead).toFixed(1)}" width="${BW.toFixed(1)}" height="${hRead.toFixed(1)}" rx="2" fill="#10b981" opacity=".85"/></g>`
}).join('')
const volLabels = [0, .25, .5, .75, 1].map((f) => {
  const v = volMax * f
  return `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${(PAD.t + PH * (1 - f)).toFixed(1)}" y2="${(PAD.t + PH * (1 - f)).toFixed(1)}" stroke="#f0f0f2"/><text x="${PAD.l - 5}" y="${(PAD.t + PH * (1 - f) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af">${fmtN(v)}</text>`
}).join('')
const miss = (b) => Math.max(0, (b.billedInput || 0) - (b.cacheRead || 0))
const volView = `<div class="card"><div class="head"><div class="title">⚡ 缓存洞察</div>
<div class="seg"><button class="segb">命中率</button><button class="segb on">用量</button><button class="segb" style="min-width:44px">0–100 ⤓</button></div></div>
<div class="kpis">
  <div class="kpi"><div class="lab">缓存读取</div><div class="val">${fmtN(d90.totals.cacheReadTokens)}</div></div>
  <div class="kpi"><div class="lab">计费输入</div><div class="val">${fmtN(d90.totals.billedInputTokens)}</div></div>
  <div class="kpi hero"><div class="lab">读取占比</div><div class="val">${(d90.totals.cacheReadTokens / d90.totals.billedInputTokens * 100).toFixed(1)}<small>%</small></div></div>
</div>
<div class="legend"><span class="lg"><span class="sw" style="border-color:#10b981;border-top-width:6px;opacity:.85"></span>缓存读取</span><span class="lg"><span class="sw" style="border-color:#e4e4e7;border-top-width:6px"></span>未命中计费输入</span></div>
<div style="position:relative"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
${volLabels}${volBars}${xGrid}
</svg>
<div class="tip" style="left:38%;top:10px"><div style="color:#52525b">8/31-9/6</div><div style="font-weight:700;color:#047857">缓存读取 544.0M</div><div style="color:#71717a">未命中 121.0M · 命中率 91.3%</div></div>
</div>
<div class="models"><div class="mtitle"><span>模型缓存排行 · 读取量 Top 6（点击筛选）</span><span style="color:#d4d4d8">▾ 展开</span></div>
${models30.slice(0, 6).map((m, i) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
  const name = m.id.length > 15 ? m.id.slice(0, 14) + '…' : m.id
  const rw = Math.min(100, m.cacheRead / models30[0].cacheRead * 100)
  return `<div class="mrow"><span class="dot" style="background:${colors[i % 6]}"></span><span class="mname">${name}</span>
<div class="mtrack"><div class="mfill" style="width:${rw.toFixed(1)}%;background:${colors[i % 6]}"></div></div>
<span class="mval">${fmtN(m.cacheRead)}</span><span class="msave">省 ${fmtY(savedOf(m))}</span></div>`
}).join('')}
</div></div>`

writeFileSync(new URL('../mockup-cache.html', import.meta.url),
`<!doctype html><meta charset="utf-8"><title>cache card mock</title><style>${cardCss}</style><div class="wrap">${hitView}${volView}</div>`)
console.log('written mockup-cache.html')
