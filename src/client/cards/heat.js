// 活跃热力图与分布卡（环形图 + 排行）。

import { DAYS, HEAT_SCALES, MODES, DIST_COLORS, DIST_NAMED_LIMIT } from '../theme.js'
import { ICON_CAL, ICON_PIE } from '../icons.js'
import { heatBreakpoints, heatColor } from '../chart-math.js'
import { pad2, fmtH9, fmtIntl, fmtCny, fmtDur } from '../format.js'
import { Segmented } from '../primitives.js'
import { React, h } from '../react.js'

export function HeatChart(props) {
  const heat = props.heat || null
  const [mode, setMode] = React.useState('token')
  const cells = heat ? (mode === 'dur' ? (Array.isArray(heat.active) ? heat.active : heat.dur) : heat[mode]) : null
  const colors = HEAT_SCALES[mode] || HEAT_SCALES.tokens
  const bps = cells ? heatBreakpoints(cells) : []
  const head = h('div', { className: 'dd-chart-head' },
    h('div', { className: 'dd-chart-title' },
      h('span', { className: 'icon' }, ICON_CAL),
      h('span', null, '分时活跃')),
    h('div', { className: 'dd-chart-tools' },
      h(Segmented, { ariaLabel: '热力图指标', options: MODES, active: mode, onSelect: setMode })))
  const tipLabel = mode === 'cost' ? '费用' : mode === 'dur' ? '活跃' : 'Token'
  const tipCls = mode === 'cost' ? 'tt-cost' : mode === 'dur' ? 'tt-dur' : 'tt-token'
  const tipVal = (v) => mode === 'cost' ? fmtCny(v) : mode === 'dur' ? fmtDur(v / 1000) : fmtIntl(v)
  const rows = cells ? DAYS.map((d, di) => h('div', { key: d, className: 'dd-heat-row' },
    h('span', { className: 'dd-heat-day' }, d),
    h('div', { className: 'dd-heat-cells' },
      Array.from({ length: 24 }, (_, hh) => {
        const v = cells[di * 24 + hh]
        return h('div', { key: hh, className: 'dd-heat-cell' + (hh === 0 ? ' edge-left' : hh === 23 ? ' edge-right' : '') },
          h('div', { className: 'inner', style: { backgroundColor: heatColor(v, bps, colors) } }),
          h('div', { className: 'tip' },
            h('div', { className: 'tt-title' }, d + ' ' + pad2(hh) + ':00'),
            h('div', { className: tipCls }, tipLabel + ': ' + tipVal(v))))
      })))) : null
  const xrow = h('div', { className: 'dd-heat-x' },
    h('div', { className: 'labels' },
      Array.from({ length: 24 }, (_, hh) => h('div', { key: hh, className: 'cell' },
        hh % 3 === 0 ? h('span', null, pad2(hh)) : null))))
  return h('div', { className: 'dd-chart' },
    head,
    cells ? h('div', { className: 'dd-heat' },
      rows,
      xrow,
      h('div', { className: 'dd-heat-legend' },
        h('span', { className: 'lbl' }, '少'),
        h('div', { className: 'dots' }, colors.slice(1).map((c, i) => h('span', { key: i, className: 'dd-dot', style: { backgroundColor: c } }))),
        h('span', { className: 'lbl' }, '多'))) : h('div', { className: 'dd-empty' }, '暂无数据'))
}

// 圆环图：按占比切分描边弧段（自顶部顺时针）；dim 段变暗（hover 联动）
export function Donut(props) {
  const items = props.items || []
  const total = items.reduce((s, x) => s + x.v, 0)
  const R = 44
  const C = 2 * Math.PI * R
  let acc = 0
  const segs = items.map((x, i) => {
    const frac = total > 0 ? x.v / total : 0
    const len = frac > 0 ? Math.max(0, frac * C - 1.5) : 0
    const circleProps = {
      key: i,
      cx: 60, cy: 60, r: R,
      fill: 'none',
      stroke: x.color,
      strokeWidth: 15,
      strokeDasharray: len + ' ' + C,
      strokeDashoffset: -acc,
      strokeLinecap: 'butt',
      opacity: x.dim ? 0.18 : 1,
      role: x.ariaLabel ? 'img' : undefined,
      'aria-label': x.ariaLabel,
      onMouseEnter: x.onMouseEnter,
      onMouseLeave: x.onMouseLeave,
      onFocus: x.onMouseEnter,
      onBlur: x.onMouseLeave,
      tabIndex: x.ariaLabel ? 0 : undefined
    }
    const seg = x.title ? h('circle', circleProps, h('title', null, x.title)) : h('circle', circleProps)
    acc += frac * C
    return seg
  })
  return h('svg', { width: 120, height: 120, viewBox: '0 0 120 120' },
    h('g', { transform: 'rotate(-90 60 60)' }, segs))
}

// 分布卡片：左侧圆环 + 右侧图例（名称 … Token量 占比），右上角 Token/费用 切换
// 颜色固定：蓝 绿 橙 红 紫 黄 各对应前 6 项；其余聚合为「其他」（黑灰，不显示具体名称）
export function DistributionCard(props) {
  const [mode, setMode] = React.useState('token')
  const [hover, setHover] = React.useState(null)
  const raw = props.items || []
  const sorted = raw.map((x) => {
    const tokens = Number(x.tokens) || 0
    const cost = Number(x.cost) || 0
    return { id: x.id, label: x.label || x.id, tokens, cost, v: mode === 'cost' ? cost : tokens }
  })
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || String(a.label).localeCompare(String(b.label)))
  const items = []
  for (let i = 0; i < sorted.length; i++) {
    const x = sorted[i]
    if (i < DIST_NAMED_LIMIT) {
      items.push({ id: x.id, label: x.label, tokens: x.tokens, cost: x.cost, v: x.v, color: DIST_COLORS[i] })
    } else {
      let o = items.find((y) => y.id === '__other__')
      if (!o) {
        o = { id: '__other__', label: '其他', tokens: 0, cost: 0, v: 0, color: DIST_COLORS[DIST_NAMED_LIMIT] }
        items.push(o)
      }
      o.tokens += x.tokens
      o.cost += x.cost
      o.v += x.v
    }
  }
  const total = items.reduce((s, x) => s + x.v, 0)
  const totalTokens = items.reduce((s, x) => s + x.tokens, 0)
  const totalCost = items.reduce((s, x) => s + x.cost, 0)
  const hoverItem = hover === null ? null : items.find((x) => x.id === hover) || null
  const activeHover = hoverItem ? hover : null
  const centerTarget = hoverItem || { tokens: totalTokens, cost: totalCost }
  const centerValue = mode === 'cost' ? fmtCny(centerTarget.cost) : fmtH9(centerTarget.tokens)
   const centerLabel = hoverItem
     ? (mode === 'cost' ? '当前费用' : '当前 Token')
     : (mode === 'cost' ? '总费用' : '总 Token')
   const opts = [{ key: 'token', label: 'Token' }, { key: 'cost', label: '费用' }]
  const pctLabel = (x) => (total > 0 ? (x.v / total * 100).toFixed(1) : '0.0') + '%'
  const fullLabel = (x) => (x.id === '__other__' ? '其他（聚合）' : x.label) + '：Token ' + fmtIntl(x.tokens) + '，费用 ' + fmtCny(x.cost) + '，占比 ' + pctLabel(x)
  const totalLabel = (mode === 'cost' ? '总费用 ' + fmtCny(totalCost) + '，Token ' + fmtIntl(totalTokens) : '总 Token ' + fmtIntl(totalTokens) + '，费用 ' + fmtCny(totalCost))
  const centerTitle = hoverItem ? fullLabel(hoverItem) : totalLabel
  const head = h('div', { className: 'dd-chart-head' },
    h('div', { className: 'dd-chart-title' },
      h('span', { className: 'icon' }, props.icon || ICON_PIE),
      h('span', null, props.title)),
    h('div', { className: 'dd-chart-tools' },
      h(Segmented, { ariaLabel: props.title + '指标', options: opts, active: mode, onSelect: setMode })))
  let body
  if (items.length === 0) {
    body = h('div', { className: 'dd-empty' }, '暂无数据')
  } else {
    body = h('div', { className: 'dd-dist-body' },
      h('div', { className: 'dd-dist-donut' },
        h(Donut, { items: items.map((x) => ({
          v: x.v,
          color: x.color,
          dim: activeHover !== null && activeHover !== x.id,
          title: fullLabel(x),
          ariaLabel: fullLabel(x),
          onMouseEnter: () => setHover(x.id),
          onMouseLeave: () => setHover(null)
        })) }),
        h('div', { className: 'dd-dist-center', title: centerTitle, 'aria-label': centerTitle },
          h('span', { className: 'v' }, centerValue),
           h('span', { className: 'l' }, centerLabel))),
      h('div', { className: 'dd-dist-legend' },
        items.map((x) => {
          const label = fullLabel(x)
          return h('div', {
            key: x.id,
            className: 'dd-dist-item' + (activeHover !== null && activeHover !== x.id ? ' dim' : ''),
            title: label,
            'aria-label': label,
            onMouseEnter: () => setHover(x.id),
            onMouseLeave: () => setHover(null)
          },
            h('span', { className: 'dot', style: { backgroundColor: x.color } }),
            h('span', { className: 'name', title: x.label }, x.label),
            h('span', { className: 'val' }, mode === 'cost' ? fmtCny(x.cost) : fmtIntl(x.tokens)),
            h('span', { className: 'pct' }, pctLabel(x)))
        })))
  }
  return h('div', { className: 'dd-dist' }, head, body)
}

// Radar card v3 — six honest axes, real-value vertex chips, numeric card.
// 每轴：score（0–1，双端固定标定的对数带宽归一）+ fmt（顶点真值标签）。
// 对数带宽 score = log(v/floor)/log(ceil/floor)：两端都定标（外圈=快/多/省，
// 中心=floor），比值类轴（如 1/P50 跨两个数量级）不再全员贴中心。
// 标定基准（2026-09-12，90d + 当日窗口实测分布）：
//   响应速度 外圈 P50=1s / 中心 120s；输出速度 1–166 t/s；平均输出量 50–1645 tok；
//   平均输入量 5k–29.4万 tok；稳定性 慢125倍–慢8.3倍；实际单价 ¥2/M–¥0.10/M。
// 方向统一：越靠外圈越好。平均输出/输入量是使用画像而非强弱（弹窗注明）。
