// 模型效能雷达（六轴）+ 标尺行数值卡。

import { ICON_MODEL } from '../icons.js'
import { RADAR_COLORS, RADAR_AXES, RADAR_ANGLE_STEP, RADAR_ANGLE_OFF, RADAR_PLOT, RADAR_CX, RADAR_CY, RADAR_R, RADAR_LABEL_R, RADAR_DEFS } from '../chart-math.js'
import { Popup } from '../primitives.js'
import { React, h } from '../react.js'

export function RadarCard(props) {
  const [hoverId, setHoverId] = React.useState(null)
  // 图例 hover 是「粘性聚焦」：移开鼠标仍保持高亮（否则用户把指针移向
  // 图形查看时高亮瞬间消失，看起来像 hover 失效）。点击 = 显式锁定。
  const [legendId, setLegendId] = React.useState(null)
  const [selectedId, setSelectedId] = React.useState(null)
  const [radarInfoOpen, setRadarInfoOpen] = React.useState(false)
  const toggleSelected = (id) => setSelectedId((prev) => (prev === id ? null : id))
  const models = props.models || []
  const modelSel = props.modelSel || null
  const filtered = modelSel && modelSel.length
    ? models.filter((m) => modelSel.indexOf(m.id) >= 0)
    : models
  const top = filtered.slice()
    .filter((m) => m.calls > 0 && m.output > 0)
    .sort((a, b) => b.calls - a.calls || a.id.localeCompare(b.id))
    .slice(0, 4)
  // 筛选变化后重置选中：选中的模型已不在 top 中时清空
  React.useEffect(() => {
    if (selectedId && !top.some((m) => m.id === selectedId)) setSelectedId(null)
  }, [selectedId, top])
  const COLORS = RADAR_COLORS
  const STROKE_COLORS = RADAR_COLORS
  const AXES = RADAR_AXES
  const ANGLE_STEP = RADAR_ANGLE_STEP
  const ANGLE_OFF = RADAR_ANGLE_OFF
  const DEFS = RADAR_DEFS
  const PLOT = RADAR_PLOT
  const CX = RADAR_CX, CY = RADAR_CY, R = RADAR_R
  const LABEL_R = RADAR_LABEL_R
  function axisAngle(i) { return ANGLE_OFF + i * ANGLE_STEP }
  function polar(r, a) { return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) } }
  const norms = top.map((m) => DEFS.map((d) => d.score(m)))
  const chipText = top.map((m) => DEFS.map((d) => d.fmt(m)))
  function makePoly(pts) {
    let d = ''
    let firstValid = true
    for (let i = 0; i < AXES; i++) {
      if (pts[i] == null) continue
      const a = axisAngle(i)
      const p = polar(R * pts[i], a)
      d += (firstValid ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)
      firstValid = false
    }
    if (!firstValid) d += ' Z'
    return d
  }
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0].map((f) => {
    const pts = Array.from({ length: AXES }, (_, i) => {
      const d = polar(R * f, axisAngle(i))
      return d.x.toFixed(2) + ',' + d.y.toFixed(2)
    }).join(' ')
    return h('polygon', { key: f, points: pts, style: { fill: 'none', stroke: f === 1 ? 'var(--dd-radar-ring,#d4d4d8)' : 'var(--dd-radar-web,#e9e9ec)', strokeWidth: 1 } })
  })
  const axes = Array.from({ length: AXES }, (_, i) => {
    const end = polar(R, axisAngle(i))
    return h('line', { key: i, x1: CX, y1: CY, x2: end.x.toFixed(2), y2: end.y.toFixed(2), style: { stroke: 'var(--dd-radar-web,#e9e9ec)', strokeWidth: 1 } })
  })
  // 当前展示模型（chart hover > 图例 hover > 点击锁定 > 第一个）
  const focusId = hoverId || legendId || selectedId
  const activeIdx = focusId ? top.findIndex((m) => m.id === focusId) : 0
  const activeModel = top[activeIdx] || null
  const labelEls = DEFS.map((d, i) => {
    const lp = polar(LABEL_R, axisAngle(i))
    const anchor = Math.abs(lp.x - CX) < 1 ? 'middle' : (lp.x > CX ? 'start' : 'end')
    return h('text', {
      key: i, x: lp.x.toFixed(2), y: (lp.y + 6).toFixed(2),
      textAnchor: anchor, dominantBaseline: 'middle',
      style: { fontSize: '22px', fill: 'var(--dd-radar-label,#52525b)', fontWeight: 600 }
    }, d.name)
  })
  // 外圈基准值不再画在图上（太杂乱），完整标定说明在 ⓘ 弹窗里
  const polys = top.map((m, idx) => {
    const d = makePoly(norms[idx])
    const isFocus = focusId != null && m.id === focusId
    const isDim = focusId !== null && m.id !== focusId
    if (!d) return null
    return h('path', {
      key: m.id, d,
      fill: COLORS[idx],
      fillOpacity: isDim ? 0.03 : (isFocus ? 0.20 : 0.13),
      stroke: STROKE_COLORS[idx],
      strokeOpacity: isDim ? 0.12 : 0.85,
      strokeWidth: isFocus ? 2 : 1.4,
      onMouseEnter: () => setHoverId(m.id),
      onMouseLeave: () => setHoverId(null)
    })
  }).filter(Boolean)
  const dots = top.map((m, idx) => norms[idx].map((v, ai) => {
    if (v == null) return null
    const p = polar(R * v, axisAngle(ai))
    const isH = focusId != null && m.id === focusId
    const isDim = focusId !== null && m.id !== focusId
    return h('circle', {
      key: m.id + '-' + ai, cx: p.x.toFixed(2), cy: p.y.toFixed(2), r: isH ? 3.5 : 2.5,
      fill: STROKE_COLORS[idx],
      fillOpacity: isDim ? 0.12 : 0.85,
      stroke: 'var(--dd-surface,#fff)',
      strokeOpacity: isDim ? 0.15 : 1,
      strokeWidth: 1.2,
      style: { transition: 'fill-opacity .15s ease, stroke-opacity .15s ease' },
      onMouseEnter: () => setHoverId(m.id),
      onMouseLeave: () => setHoverId(null)
    })
  })).flat().filter(Boolean)
  // 顶点真值标签：安静风——白底细灰描边、墨色文字，无投影（最后绘制防遮挡）
  const chipEls = []
  if (activeModel && norms[activeIdx]) {
    norms[activeIdx].forEach((f, i) => {
      const text = chipText[activeIdx][i]
      if (f == null || text == null) return
      const p = polar(Math.min(Math.max(R * f, R * 0.32) + 20, R - 6), axisAngle(i))
      const w = Math.max(64, text.length * 12 + 26)
      chipEls.push(h('g', { key: i },
        h('rect', {
          x: (p.x - w / 2).toFixed(1), y: (p.y - 16).toFixed(1), width: w, height: 32, rx: 16,
          fill: 'var(--dd-surface,#ffffff)', stroke: 'var(--dd-border2,#dcdce1)', strokeWidth: 1
        }),
        h('text', {
          x: p.x.toFixed(1), y: (p.y + 5.8).toFixed(1), textAnchor: 'middle',
          style: { fontSize: '20px', fontWeight: 600, fill: 'var(--dd-text2,#3f3f46)', fontFamily: '"JetBrains Mono",ui-monospace,monospace' }
        }, text)))
    })
  }
  const plotEl = h('svg', { viewBox: '-78 -25 583 470', style: { display: 'block', width: '100%', height: '100%' } },
    rings, axes, polys, dots, labelEls, chipEls)
  const legendEl = h('div', { className: 'dd-radar-legend', style: { display: 'flex', flexDirection: 'column', gap: 1 } },
    top.map((m, idx) => {
      const isDim = focusId !== null && m.id !== focusId
      return h('div', {
        key: m.id,
        className: 'dd-dist-item' + (isDim ? ' dim' : ''),
        style: { display: 'block', padding: '3px 8px', cursor: 'pointer' },
        onMouseEnter: () => setLegendId(m.id),
        onMouseLeave: () => setLegendId(null),
        onClick: () => toggleSelected(m.id),
        title: m.id + '\n' + DEFS.map((d, i) => d.name + ': ' + (chipText[idx][i] == null ? '—' : chipText[idx][i])).join('\n')
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
          h('span', { className: 'dot', style: { backgroundColor: STROKE_COLORS[idx], width: 8, height: 8, borderRadius: 99, flex: 'none' } }),
          h('span', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--dd-text2,#3f3f46)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.id)),
        h('div', { style: { fontSize: 10.5, color: 'var(--dd-faint,#a1a1aa)', paddingLeft: 14 } }, m.calls.toLocaleString() + ' 次'))
    }))
  // 数值卡：每轴一行「标尺」——真值 + 轨道上全部模型的落点（当前模型放大带
  // 白圈光晕，其余半透明），主色淡填充到当前落点。比纯文字多了对比与量感。
  const numsEl = (activeModel && norms[activeIdx]) ? h('div', {
    style: { display: 'flex', flexDirection: 'column', fontSize: '11px', padding: '6px 10px 4px', border: '1px solid var(--dd-border4,#ececee)', borderRadius: 8, marginTop: 4, gap: 2 }
  },
    DEFS.map((d, i) => {
      const f = norms[activeIdx][i]
      const text = chipText[activeIdx][i]
      const dots = []
      for (let mi = 0; mi < top.length; mi++) {
        const v = norms[mi] ? norms[mi][i] : null
        if (v == null) continue
        const cur = mi === activeIdx
        dots.push(h('span', {
          key: mi,
          title: top[mi].id + ' · ' + d.name + ': ' + (chipText[mi][i] == null ? '—' : chipText[mi][i]),
          style: { position: 'absolute', top: '50%', left: (Math.max(0.015, Math.min(1, v)) * 100).toFixed(1) + '%', transform: 'translate(-50%,-50%)',
            width: cur ? 7 : 5, height: cur ? 7 : 5, borderRadius: 99, background: STROKE_COLORS[mi],
            opacity: cur ? 0.9 : 0.35, boxSizing: 'border-box',
            border: cur ? '1.5px solid var(--dd-surface,#fff)' : 'none',
            boxShadow: cur ? '0 0 0 1px ' + STROKE_COLORS[mi] + '66' : 'none', zIndex: cur ? 2 : 1 }
        }))
      }
      return h('div', { key: d.name, style: { padding: '2px 0 1px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } },
          h('span', { style: { color: 'var(--dd-muted2,#71717a)' } }, d.name),
          h('span', { style: { fontWeight: 700, fontFamily: '"JetBrains Mono",ui-monospace,monospace', color: f == null ? 'var(--dd-faint,#a1a1aa)' : 'var(--dd-text2,#3f3f46)', fontVariantNumeric: 'tabular-nums' } }, text == null ? '—' : text)),
        h('div', { style: { padding: '0 5px' } },
          h('div', { style: { position: 'relative', height: 11 } },
            h('span', { style: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, marginTop: -1, background: 'var(--dd-border3,#f0f0f2)', borderRadius: 99 } }),
            f != null ? h('span', { style: { position: 'absolute', left: 0, top: '50%', height: 2, marginTop: -1, width: (Math.max(0.015, Math.min(1, f)) * 100).toFixed(1) + '%', background: STROKE_COLORS[activeIdx], opacity: 0.18, borderRadius: 99 } }) : null,
            dots)))
    })) : null
  const radarPopup = h('div', null,
    h('div', { className: 'pop-title' }, '雷达图六维度说明'),
    h('div', { className: 'pop-body' },
      h('div', { className: 'pop-sec', style: { marginTop: 0 } },
        h('div', { className: 'sec-title' }, '响应速度'),
        h('div', null, '一次请求通常要等多久（中位数）。外圈 = 1 秒')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '输出速度'),
        h('div', null, '模型每秒吐出多少 tokens。外圈 = 166 tok/s')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '平均输出量'),
        h('div', null, '平均每次回复写多少 tokens。外圈 = 1,645 tok/次')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '平均输入量'),
        h('div', null, '平均每次读入多少 tokens。外圈 = 29.4 万 tok/次')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '稳定性'),
        h('div', null, '最慢的 5% 请求比典型请求慢几倍。外圈 = 慢 ≤8.3 倍')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '实际单价'),
        h('div', null, '每百万 tokens 实际花多少钱。外圈 = ¥0.10/M'))))
  const radarInfo = h(Popup, {
    open: radarInfoOpen,
    onToggle: () => setRadarInfoOpen(!radarInfoOpen),
    onClose: () => setRadarInfoOpen(false),
    width: 300,
    children: radarPopup
  })
  const head = h('div', { className: 'dd-chart-head' },
    h('div', { className: 'dd-chart-title' },
      h('span', { className: 'icon' }, ICON_MODEL),
      h('span', null, '模型效能雷达'),
      radarInfo))
  if (top.length === 0) {
    return h('div', { className: 'dd-radar' },
      head,
      h('div', { className: 'dd-empty' }, '暂无可用模型数据'))
  }
  return h('div', {
    className: 'dd-radar',
    // 图例悬停是即时的：放上高亮该模型，移开即恢复全览（item 级 mouseleave）。
    // 卡级 leave 只作兜底（指针从图例直接飞出窗口等场景）。点击 = 显式锁定。
    onMouseLeave: () => setLegendId(null)
  },
    head,
    h('div', { className: 'dd-radar-body', style: { display: 'flex', alignItems: 'center', gap: 12 } },
      h('div', { className: 'dd-radar-donut', style: { width: 250, height: 250, flex: 'none' } }, plotEl),
      h('div', { style: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' } },
        legendEl,
        numsEl)))
}

// 缓存洞察：KPI 条 + 双视图（命中率/用量）+ 自适应 Y 轴 + 模型缓存排行（点击筛选）
