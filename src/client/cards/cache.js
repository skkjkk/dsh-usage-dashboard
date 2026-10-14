// 缓存洞察卡（命中率 / 用量双视图 + 模型排行）。

import { ICON_ECG } from '../icons.js'
import { pad2, fmtH9, axisLabel } from '../format.js'
import { Segmented, Popup } from '../primitives.js'
import { React, h } from '../react.js'

export function CacheTrendCard(props) {
  const buckets = props.buckets || []
  const granularity = props.granularity || 'week'
  const totals = props.totals || {}
  const usd = !!props.usd
  const CACHE_DOT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#d946ef', '#64748b']
  const fmtCostShort = (v) => {
    const r = Math.round(usd ? v / 7 : v)
    return (usd ? '$' : '¥') + r.toLocaleString('en-US')
  }
  // 预计节省：缓存读取 token × (输入价 − 缓存价)；未定价模型 null（显示 —），免费模型如实 0
  const savedOf = (m) => m.p ? Math.max(0, (m.cacheRead || 0) * (m.p[0] - m.p[2]) / 1e6) : null
  const cacheModels = (props.models || [])
    .filter((m) => (m.cacheRead || 0) > 0)
    .sort((a, b) => b.cacheRead - a.cacheRead)
  const totalSaved = cacheModels.reduce((s, m) => { const v = savedOf(m); return v ? s + v : s }, 0)

  const [view, setView] = React.useState('hit')   // 'hit' | 'vol'
  const [switchSeq, setSwitchSeq] = React.useState(0) // 视图切换计数：作为动画层的 remount key，让入场动画每次切换都重播
  const [hoverIdx, setHoverIdx] = React.useState(null)
  const [expanded, setExpanded] = React.useState(false)
  const [infoOpen, setInfoOpen] = React.useState(false)

  const W = 460, H = 152, PAD = { top: 12, right: 14, bottom: 22, left: 38 }
  const PW = W - PAD.left - PAD.right
  const PH = H - PAD.top - PAD.bottom
  const n = buckets.length
  const toX = (i) => PAD.left + (i / Math.max(1, n - 1)) * PW
  function axisLabel(label, gran) {
    if (gran === 'hour') return pad2(Number(label)) + ':00'
    if (gran === 'week') {
      // "8/11-8/17" → "8/11"，只显示起始日期，避免标签过长重叠
      const m = label.match(/^(\d+\/\d+)/)
      return m ? m[1] : label
    }
    return label
  }

  // 有遥测的桶（命中率 + 覆盖率共同决定自适应域）
  const hitVals = []
  for (let i = 0; i < n; i++) {
    const b = buckets[i]
    if (b.cacheHitRate != null && b.cacheObserved > 0) { hitVals.push(b.cacheHitRate); hitVals.push(b.cacheCoverage || 0) }
  }
  const cacheInfo = h('div', null,
    h('div', { className: 'pop-title' }, '缓存指标说明'),
    h('div', { className: 'pop-body' },
      h('div', { className: 'pop-sec', style: { marginTop: 0 } },
        h('div', { className: 'sec-title' }, '命中率'),
        h('div', null, '能走缓存的输入 tokens 里，直接由缓存供上的比例。越高说明同样的上下文没有重复花钱。')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '覆盖率'),
        h('div', null, '计费输入中，模型上报了缓存遥测的比例。没上报的部分不计入命中率，避免把未知当成未命中。')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '预计节省'),
        h('div', null, '若缓存未命中，这些 tokens 要按各模型输入价付费，差额即节省。免费/开源模型输入本就不计费，节省为 ¥0。')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '模型排行条'),
        h('div', null, '条长 = 该模型缓存读取量的相对大小；琥珀色刻度 = 它的覆盖率；点击行可按该模型筛选全看板。'))))
  const mkHead = () => h('div', { className: 'dd-chart-head', style: { marginBottom: 12 } },
    h('div', { className: 'dd-chart-title' },
      h('span', { className: 'icon' }, ICON_ECG),
      h('span', null, '缓存洞察'),
      h(Popup, {
        open: infoOpen,
        onToggle: () => setInfoOpen(!infoOpen),
        onClose: () => setInfoOpen(false),
        width: 320,
        tip: '缓存指标说明',
        children: cacheInfo
      })),
    h('div', { className: 'dd-chart-tools' },
      h(Segmented, {
        ariaLabel: '缓存视图',
        options: [{ key: 'hit', label: '命中率' }, { key: 'vol', label: '用量' }],
        active: view,
        onSelect: (k) => { if (k === view) return; setView(k); setSwitchSeq((v) => v + 1); setHoverIdx(null) }
      })))
  if (n === 0) {
    return h('div', { className: 'dd-chart' }, mkHead(), h('div', { className: 'dd-cache-empty' }, '暂无数据'))
  }

  function niceDomain(vals) {
    let lo = 100, hi = 0
    for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v }
    const span = Math.max(4, hi - lo)
    const step = span <= 6 ? 2 : span <= 15 ? 5 : 10
    const dLo = Math.max(0, Math.floor((lo - span * 0.15) / step) * step)
    let dHi = Math.min(100, Math.ceil((hi + span * 0.15) / step) * step)
    if (dHi <= dLo) dHi = Math.min(100, dLo + step * 2)
    return [dLo, dHi]
  }
  const domain = (view === 'hit' && hitVals.length) ? niceDomain(hitVals) : [0, 100]
  const toY = (v) => v == null ? null : PAD.top + PH * (1 - (Math.max(domain[0], Math.min(domain[1], v)) - domain[0]) / (domain[1] - domain[0]))
  const tickVals = []
  for (let k = 0; k <= 4; k++) tickVals.push(Math.round(domain[0] + (domain[1] - domain[0]) * k / 4))

  // monotone cubic（Fritsch–Carlson）：平滑但不越过数据点
  function smooth(pts) {
    const m = pts.length
    if (m < 2) return ''
    const dx = [], sl = []
    for (let i = 0; i < m - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; sl[i] = (pts[i + 1][1] - pts[i][1]) / dx[i] }
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
  function segsOf(get) {
    const out = []
    for (let i = 0; i < n; i++) {
      const b = buckets[i]
      if (b.cacheHitRate == null) continue
      const p = [toX(i), toY(get(b))]
      const last = out[out.length - 1]
      if (last && last.end === i - 1) { last.end = i; last.pts.push(p) }
      else out.push({ start: i, end: i, pts: [p] })
    }
    return out
  }
  const hitSegs = segsOf((b) => b.cacheHitRate)
  const covSegs = segsOf((b) => b.cacheCoverage)
  const base = PAD.top + PH
  const hitPaths = hitSegs.map((s) => smooth(s.pts))
  const covPaths = covSegs.map((s) => smooth(s.pts))
  const areaDs = hitSegs.filter((s) => s.pts.length >= 2).map((s) =>
    smooth(s.pts) + ' L' + s.pts[s.pts.length - 1][0].toFixed(1) + ' ' + base + ' L' + s.pts[0][0].toFixed(1) + ' ' + base + ' Z')
  const hitBuckets = buckets.filter((b) => b.cacheHitRate != null)
  const hitAvg = hitBuckets.length ? hitBuckets.reduce((s, b) => s + b.cacheHitRate, 0) / hitBuckets.length : null

  // 无遥测区间的浅灰带
  const gapBands = []
  {
    let i = 0
    while (i < n) {
      if (buckets[i].cacheHitRate != null) { i++; continue }
      const st = i
      while (i < n && buckets[i].cacheHitRate == null) i++
      const x1 = st === 0 ? PAD.left : (toX(st - 1) + toX(st)) / 2
      const x2 = i >= n ? W - PAD.right : (toX(i - 1) + toX(i)) / 2
      gapBands.push([x1, x2])
    }
  }
  const lastSeg = hitSegs[hitSegs.length - 1]
  const lastIdx = lastSeg ? lastSeg.end : null

  // ---- 用量视图几何 ----
  const vol = buckets.map((b) => {
    const read = b.cacheRead || 0
    return { read, miss: Math.max(0, (b.billedInput || 0) - read) }
  })
  let volMax = 0
  for (const v of vol) if (v.read + v.miss > volMax) volMax = v.read + v.miss
  volMax = Math.max(1, volMax)
  const toYV = (v) => PAD.top + PH * (1 - Math.min(1, v / volMax))
  // 用量视图用分带（band）刻度：柱心在等宽槽位中央，首柱不会像点刻度那样半截越出
  // 绘图区压住 Y 轴刻度标签（桶少柱宽时尤其明显）；宽度上限防止单桶时柱占满全图。
  const toXB = (i) => PAD.left + (i + 0.5) * PW / n
  const BW = Math.min(26, Math.max(3, PW / n * 0.62))
  const volTick = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: PAD.top + PH * (1 - f), v: volMax * f }))

  // ---- 轴与标签 ----
  const MIN_LABEL_GAP = 44
  const maxLabels = Math.max(3, Math.floor(PW / MIN_LABEL_GAP))
  // 固定步长抽样：每隔 labelStep 个桶标一个刻度（今天 24 小时 → 每 3 小时一格）。
  // 此前「均匀取 maxLabels 个点再四舍五入」会产生 1/2/3 混合间隔，轴上看起来有的显示有的突然不显示。
  const labelStep = Math.max(1, Math.ceil(n / maxLabels))
  const labelIdx = n > maxLabels
    ? Array.from({ length: Math.ceil(n / labelStep) }, (_, k) => k * labelStep)
    : null
  const mkXLabels = (toFn) => (labelIdx || Array.from({ length: n }, (_, i) => i)).map((idx) =>
    h('text', { key: 'x' + idx, x: toFn(idx), y: PAD.top + PH + 15, textAnchor: 'middle', style: { fontSize: '10px', fill: 'var(--dd-faint,#9ca3af)' } }, axisLabel(buckets[idx].label, granularity)))
  const hitGridEls = tickVals.map((v, i) => h('g', { key: 'y' + i },
    h('line', { x1: PAD.left, y1: toY(v), x2: W - PAD.right, y2: toY(v), style: { stroke: 'var(--dd-grid,#f0f0f2)', strokeWidth: 1 } }),
    h('text', { x: PAD.left - 5, y: toY(v) + 3, textAnchor: 'end', style: { fontSize: '9px', fill: 'var(--dd-faint,#9ca3af)' } }, v + '%')))
  const volGridEls = volTick.map((t, i) => h('g', { key: 'y' + i },
    h('line', { x1: PAD.left, y1: t.y, x2: W - PAD.right, y2: t.y, style: { stroke: 'var(--dd-grid,#f0f0f2)', strokeWidth: 1 } }),
    h('text', { x: PAD.left - 5, y: t.y + 3, textAnchor: 'end', style: { fontSize: '9px', fill: 'var(--dd-faint,#9ca3af)' } }, fmtH9(t.v))))

  // ---- hover ----
  const hoverB = hoverIdx != null ? buckets[hoverIdx] : null
  let tipEl = null
  if (hoverB) {
    const tipTime = granularity === 'hour' ? pad2(Number(hoverB.label)) + ':00' : hoverB.label
    const noData = hoverB.cacheHitRate == null
    const pct = (view === 'hit' ? toX(hoverIdx) : toXB(hoverIdx)) / W * 100
    const tx = pct < 30 ? 'translateX(-12%)' : pct > 70 ? 'translateX(-88%)' : 'translateX(-50%)'
    tipEl = h('div', {
      className: 'dd-cache-tip',
      style: { position: 'absolute', left: pct.toFixed(1) + '%', top: 6, transform: tx, pointerEvents: 'none' }
    },
      h('div', { className: 'dd-cache-tip-line' }, tipTime),
      view === 'hit'
        ? h('div', { key: 'r1', style: { fontSize: '11px', color: noData ? 'var(--dd-faint,#a1a1aa)' : 'var(--dd-text2,#18181b)', whiteSpace: 'nowrap', fontWeight: noData ? '400' : '600' } }, '命中率: ' + (noData ? '无遥测' : hoverB.cacheHitRate.toFixed(1) + '%'))
        : h('div', { key: 'r1', style: { fontSize: '11px', color: 'var(--dd-green4,#047857)', whiteSpace: 'nowrap', fontWeight: '600' } }, '缓存读取: ' + fmtH9(hoverB.cacheRead || 0)),
      view === 'hit'
        ? h('div', { key: 'r2', style: { fontSize: '11px', color: 'var(--dd-muted2,#71717a)', whiteSpace: 'nowrap' } }, '缓存读取: ' + fmtH9(hoverB.cacheRead || 0))
        : h('div', { key: 'r2', style: { fontSize: '11px', color: 'var(--dd-muted2,#71717a)', whiteSpace: 'nowrap' } }, '未命中输入: ' + fmtH9(Math.max(0, (hoverB.billedInput || 0) - (hoverB.cacheRead || 0)))),
      view === 'hit'
        ? h('div', { key: 'r3', style: { fontSize: '11px', color: 'var(--dd-muted2,#71717a)', whiteSpace: 'nowrap' } }, '覆盖率: ' + (!noData && hoverB.cacheCoverage != null ? hoverB.cacheCoverage.toFixed(1) + '%' : '—'))
        : h('div', { key: 'r3', style: { fontSize: '11px', color: 'var(--dd-muted2,#71717a)', whiteSpace: 'nowrap' } }, '命中率: ' + (noData ? '无遥测' : hoverB.cacheHitRate.toFixed(1) + '%')))
  }
  const guideX = hoverIdx != null ? (view === 'hit' ? toX(hoverIdx) : toXB(hoverIdx)) : 0
  const guideLine = hoverIdx != null ? h('line', {
    key: 'guide', x1: guideX, y1: PAD.top, x2: guideX, y2: base,
    style: { stroke: 'var(--dd-faint,#a1a1aa)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.6 }
  }) : null
  const hoverRect = h('rect', {
    key: 'hit-area',
    x: PAD.left, y: PAD.top, width: PW, height: PH,
    style: { fill: 'transparent', cursor: 'crosshair' },
    onMouseMove: (e) => {
      const svgEl = e.currentTarget.closest('svg')
      if (!svgEl) return
      const rect = svgEl.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / rect.width * W
      // 命中率视图是点刻度（round 最近点）；用量视图是分带刻度（floor 落在哪个槽位）
      const idx = view === 'hit'
        ? Math.round(((mx - PAD.left) / PW) * (n - 1))
        : Math.floor(((mx - PAD.left) / PW) * n)
      setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
    },
    onMouseLeave: () => setHoverIdx(null)
  })

  // ---- SVG 内容：两个视图层常驻，交叉淡入淡出；激活层通过 CSS 动画重播入场效果 ----
  // 折线用 pathLength=1 归一化后动画 stroke-dashoffset（描边生长）；柱子 scaleY 从基线弹起并按索引错峰。
  // 基态样式 = 动画终态，所以淡出的旧层立即呈现完整图形、只走 opacity 过渡。
  const hitLayer = h('g', { key: 'Lhit', className: 'ddc-layer' + (view === 'hit' ? ' on' : '') }, [
    gapBands.map(([x1, x2], i) => h('rect', { key: 'gap' + i, x: x1, y: PAD.top, width: Math.max(0, x2 - x1), height: PH, style: { fill: 'var(--dd-band,#fafafa)' } })),
    h('g', { key: 'grid' }, hitGridEls),
    h('g', { key: 'area' }, areaDs.map((d, i) => h('path', { key: 'ar' + i, className: 'ddc-area', d, style: { fill: 'url(#ddCacheGrad)' } }))),
    h('g', { key: 'cov', className: 'ddc-cov' }, covPaths.map((d, i) => h('path', { key: 'cov' + i, d, style: { stroke: 'var(--dd-amber,#f59e0b)', strokeWidth: 1.4, fill: 'none', strokeDasharray: '4 3', opacity: 0.8 } }))),
    hitAvg != null && hitAvg > domain[0] && hitAvg < domain[1] ? h('g', { key: 'avg', className: 'ddc-area' },
      h('line', { x1: PAD.left, x2: W - PAD.right, y1: toY(hitAvg), y2: toY(hitAvg), style: { stroke: 'var(--dd-faint,#a1a1aa)', strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.55 } }),
      h('text', { x: PAD.left + 4, y: toY(hitAvg) - 3, textAnchor: 'start', style: { fontSize: '9px', fill: 'var(--dd-faint,#a1a1aa)' } }, '均值 ' + hitAvg.toFixed(1) + '%')) : null,
    h('g', { key: 'lines' }, hitPaths.map((d, i) => h('path', {
      key: 'ln' + i, className: 'ddc-line', d, pathLength: 1,
      style: { stroke: 'var(--dd-green,#10b981)', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: 1, strokeDashoffset: 0 }
    }))),
    h('g', { key: 'dots', className: 'ddc-area' }, buckets.map((b, i) => b.cacheHitRate == null
      ? h('circle', { key: 'd' + i, cx: toX(i), cy: base, r: 2, style: { fill: 'none', stroke: 'var(--dd-border2,#d4d4d8)', strokeWidth: 1.5 } })
      : i === lastIdx ? null : h('circle', { key: 'd' + i, cx: toX(i), cy: toY(b.cacheHitRate), r: hoverIdx === i ? 4 : 2.4, style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.2 } }))),
    lastIdx != null ? h('g', { key: 'ld', className: 'ddc-area' }, hoverIdx === lastIdx
      ? h('circle', { cx: toX(lastIdx), cy: toY(buckets[lastIdx].cacheHitRate), r: 4, style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.8 } })
      : [h('circle', { key: 'c', cx: toX(lastIdx), cy: toY(buckets[lastIdx].cacheHitRate), r: 4, style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.8 } }),
        (() => {
          const cw = 46
          const cx = Math.max(PAD.left, Math.min(W - PAD.right - cw, toX(lastIdx) - cw - 10))
          const cy = Math.max(1, toY(buckets[lastIdx].cacheHitRate) - 24)
          return [h('rect', { key: 'r', x: cx, y: cy, width: cw, height: 17, rx: 8.5, style: { fill: 'var(--dd-green,#10b981)' } }),
            h('text', { key: 't', x: cx + cw / 2, y: cy + 12, textAnchor: 'middle', style: { fontSize: '10px', fontWeight: '700', fill: 'var(--dd-oninv,#fff)' } }, buckets[lastIdx].cacheHitRate.toFixed(1) + '%')]
        })()]) : null,
    mkXLabels(toX)
  ])
  const volLayer = h('g', { key: 'Lvol', className: 'ddc-layer' + (view === 'vol' ? ' on' : '') }, [
    h('g', { key: 'grid' }, volGridEls),
    h('g', { key: 'bars' }, vol.map((v, i) => {
      const tot = v.read + v.miss
      if (!tot) return h('rect', { key: 'b' + i, x: toXB(i) - BW / 2, y: base - 2, width: BW, height: 2, rx: 1, style: { fill: 'var(--dd-grid,#f0f0f2)' } })
      const yTot = toYV(tot), yRead = toYV(v.read)
      const dim = hoverIdx != null && hoverIdx !== i
      return h('g', { key: 'b' + i, className: 'ddc-bar', style: { opacity: dim ? 0.45 : 1, '--i': i } },
        h('rect', { x: toXB(i) - BW / 2, y: yTot, width: BW, height: Math.max(1, yRead - yTot), rx: 2, style: { fill: 'var(--dd-bar-o,#e4e4e7)' } }),
        v.read > 0 ? h('rect', { x: toXB(i) - BW / 2, y: yRead, width: BW, height: Math.max(1, base - yRead), rx: 2, style: { fill: 'var(--dd-green,#10b981)', opacity: 0.85 } }) : null)
    })),
    mkXLabels(toXB)
  ])
  const svgKids = [
    h('defs', { key: 'defs' }, h('linearGradient', { id: 'ddCacheGrad', x1: '0', y1: '0', x2: '0', y2: '1' },
      h('stop', { offset: '0', style: { stopColor: 'var(--dd-green,#10b981)', stopOpacity: '0.14' } }),
      h('stop', { offset: '1', style: { stopColor: 'var(--dd-green,#10b981)', stopOpacity: '0' } }))),
    hitLayer,
    volLayer,
    guideLine,
    hoverRect
  ]

  // ---- KPI 条 ----
  const deltaPp = totals.cacheHitRateDeltaPp
  const kpi = (lab, valEl, hero) => h('div', { key: lab, className: 'dd-cache-kpi' + (hero ? ' hero' : '') },
    h('div', { className: 'lab' }, lab), h('div', { className: 'val' }, valEl))
  const kpis = view === 'hit'
    ? h('div', { key: 'k' + switchSeq, className: 'dd-cache-kpis ddc-in' },
        kpi('窗口命中率', totals.cacheHitRate != null
          ? [String(totals.cacheHitRate.toFixed(1)) + '%', deltaPp != null ? h('span', { key: 'd', className: 'delta ' + (deltaPp >= 0 ? 'up' : 'down') }, (deltaPp >= 0 ? '▲' : '▼') + Math.abs(deltaPp).toFixed(1) + 'pp') : null]
          : '—'),
        kpi('遥测覆盖率', totals.cacheCoverage > 0 ? totals.cacheCoverage.toFixed(1) + '%' : '—'),
        kpi('预计节省', cacheModels.length ? fmtCostShort(totalSaved) : '—', true))
    : h('div', { key: 'k' + switchSeq, className: 'dd-cache-kpis ddc-in' },
        kpi('缓存读取', (totals.cacheRead || totals.cacheReadTokens) ? fmtH9(totals.cacheRead || totals.cacheReadTokens) : '—'),
        kpi('计费输入', (totals.billedInput || totals.billedInputTokens) ? fmtH9(totals.billedInput || totals.billedInputTokens) : '—'),
        kpi('读取占比', totals.billedInput > 0 ? [String((100 * (totals.cacheRead || 0) / totals.billedInput).toFixed(1)), h('small', { key: 'u' }, '%')] : '—', true))

  const legend = view === 'hit'
    ? h('div', { key: 'g' + switchSeq, className: 'dd-cache-legend ddc-in' },
        h('span', { className: 'lg' }, h('i', { className: 'sw', style: { borderTopColor: 'var(--dd-green,#10b981)' } }), '命中率'),
        h('span', { className: 'lg' }, h('i', { className: 'sw', style: { borderTopColor: 'var(--dd-amber,#f59e0b)', borderTopStyle: 'dashed' } }), '覆盖率'),
        h('span', { className: 'lg' }, h('i', { className: 'sw', style: { borderTopColor: 'var(--dd-faint,#a1a1aa)', borderTopStyle: 'dotted' } }), '均值'))
    : h('div', { key: 'g' + switchSeq, className: 'dd-cache-legend ddc-in' },
        h('span', { className: 'lg' }, h('i', { className: 'sw blk', style: { background: 'var(--dd-green,#10b981)' } }), '缓存读取'),
        h('span', { className: 'lg' }, h('i', { className: 'sw blk', style: { background: 'var(--dd-bar-o,#e4e4e7)' } }), '未命中计费输入'))

  // ---- 模型排行 ----
  let modelsEl = null
  if (cacheModels.length) {
    const sel = props.modelSel
    const shown = expanded ? cacheModels : cacheModels.slice(0, 5)
    const maxRead = cacheModels[0].cacheRead || 1
    modelsEl = h('div', { className: 'dd-cache-models' },
      h('div', { className: 'dd-cache-mtitle' },
        h('span', null, '模型缓存排行 · 按读取量'),
        cacheModels.length > 5 ? h('button', { type: 'button', className: 'dd-cache-zoom', onClick: () => setExpanded(!expanded) }, expanded ? '▴ 收起' : '▾ 全部 ' + cacheModels.length) : null),
      h('div', { className: 'dd-cache-mbody' + (expanded ? ' open' : '') }, shown.map((m, i) => {
        const isSel = Array.isArray(sel) && sel.length === 1 && sel[0] === m.id
        const sv = savedOf(m)
        const name = m.id.length > 16 ? m.id.slice(0, 15) + '…' : m.id
        const color = CACHE_DOT_COLORS[i % CACHE_DOT_COLORS.length]
        return h('div', {
          key: m.id, className: 'dd-cache-mrow' + (isSel ? ' sel' : ''),
          title: m.id + ' · 点击' + (isSel ? '取消筛选' : '按此模型筛选'),
          onClick: () => props.onPickModel && props.onPickModel(m.id)
        },
          h('span', { className: 'dot', style: { background: color } }),
          h('span', { className: 'mname' }, name),
          h('div', { className: 'mtrack' },
            h('div', { className: 'mfill', style: { width: Math.max(1.5, m.cacheRead / maxRead * 100).toFixed(1) + '%', background: color } }),
            m.cacheCoverage != null ? h('div', { className: 'mcov', style: { left: Math.min(98.5, Math.max(0.5, m.cacheCoverage)).toFixed(1) + '%' } }) : null),
          h('span', { className: 'mval' }, m.cacheHitRate != null ? m.cacheHitRate.toFixed(1) + '%' : '—'),
          h('span', { className: 'msave' }, sv == null ? '—' : '省 ' + fmtCostShort(sv)))
      })))
  }

  return h('div', { className: 'dd-chart' },
    mkHead(),
    kpis,
    legend,
    h('div', { className: 'dd-cache-chart', style: { position: 'relative', width: '100%' } },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { display: 'block', width: '100%', height: 'auto' } }, svgKids),
      tipEl),
    modelsEl)
}

// 活跃热力图：最近 40 周的 7 行 × 40 列网格，周日起始，固定正方形单元格。
