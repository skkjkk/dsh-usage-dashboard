// 趋势卡（Token / 费用 / 时长三模式，折线与堆叠柱）。

import { TREND_SEG_COLORS, MODES } from '../theme.js'
import { ICON_ECG } from '../icons.js'
import { fmtH9, fmtIntl, fmtCny, fmtDur, axisLabel } from '../format.js'
import { Segmented } from '../primitives.js'
import { React, h } from '../react.js'

export function TrendChart(props) {
  const buckets = props.buckets || []
  const gran = props.granularity || 'week'
  const [mode, setMode] = React.useState('token')
  const [segs, setSegs] = React.useState({ output: true, input: true, cache: true })
  const [durSegs, setDurSegs] = React.useState({ active: true, total: true })
  // 点击柱子：选中高亮（其他柱子变淡），再点一次或点空白处恢复
  const [sel, setSel] = React.useState(null)
  React.useEffect(() => { setSel(null) }, [buckets])
  const isDur = mode === 'dur'
  const isCost = mode === 'cost'
  const title = gran === 'hour' ? '每小时趋势' : gran === 'day' ? '每日趋势' : '每周趋势'

  let M = 1
  if (isDur) {
    M = Math.max.apply(null, buckets.map((w) => durSegs.total ? w.totalMs : durSegs.active ? w.activeMs != null ? w.activeMs : w.durMs : 0)) || 1
  } else if (isCost) {
    M = Math.max.apply(null, buckets.map((w) => w.costIn + w.costOut + w.costCache)) || 0.01
  } else {
    M = Math.max.apply(null, buckets.map((w) => (segs.input ? w.input : 0) + (segs.output ? w.output : 0) + (segs.cache ? w.cache : 0))) || 1
  }
  const n = buckets.length
  // 今天/24H 底部均匀 8 个时间点；7D/30D/90D 均匀 7 个
  // 今天/24H 底部按固定步长标注（24 小时 → 每 3 小时一格），7D/30D/90D 同理；
  // 旧的「均匀取点再舍入」会让时间跳距忽大忽小（03→07→10），看起来像漏标。
  const labelCount = gran === 'hour' ? 8 : 7
  const labelStep = Math.max(1, Math.ceil(n / labelCount))
  const labelIdx = n <= labelCount ? null : Array.from({ length: Math.ceil(n / labelStep) }, (_, k) => k * labelStep)

  const head = h('div', { className: 'dd-chart-head' },
    h('div', { className: 'dd-chart-title' },
      h('span', { className: 'icon' }, ICON_ECG),
      h('span', null, title)),
    h('div', { className: 'dd-chart-tools' },
      !isDur && !isCost ? h('div', { className: 'dd-legend' },
        [{ key: 'output', label: '输出', color: TREND_SEG_COLORS.output },
         { key: 'input', label: '输入', color: TREND_SEG_COLORS.input },
         { key: 'cache', label: '缓存', color: TREND_SEG_COLORS.cache }].map((s) => h('button', {
          key: s.key,
          type: 'button',
          title: (segs[s.key] ? '隐藏' : '显示') + s.label,
          className: 'dd-legend-btn' + (segs[s.key] ? '' : ' off'),
          onClick: () => setSegs(Object.assign({}, segs, { [s.key]: !segs[s.key] }))
        },
        h('span', { className: 'dd-swatch', style: { backgroundColor: s.color } }),
        h('span', null, s.label)))) : null,
      isDur ? h('div', { className: 'dd-legend' },
        [{ key: 'active', label: '活跃时长', color: 'var(--dd-blue,#60a5fa)' },
         { key: 'total', label: '总时长', color: 'rgba(96,165,250,0.3)' }].map((s) => h('button', {
          key: s.key,
          type: 'button',
          title: (durSegs[s.key] ? '隐藏' : '显示') + s.label,
          className: 'dd-legend-btn' + (durSegs[s.key] ? '' : ' off'),
          onClick: () => setDurSegs(Object.assign({}, durSegs, { [s.key]: !durSegs[s.key] }))
        },
        h('span', { className: 'dd-swatch', style: { backgroundColor: s.color } }),
        h('span', null, s.label)))) : null,
      h(Segmented, { ariaLabel: '趋势指标', options: MODES, active: mode, onSelect: setMode })))

  if (buckets.length === 0) {
    return h('div', { className: 'dd-chart' }, head, h('div', { className: 'dd-empty' }, '暂无数据'))
  }

  const yTop = isDur ? fmtDur(M / 1000) : isCost ? fmtCny(M) : fmtH9(M)
  const yBot = isCost ? '¥0' : '0'

  const cols = buckets.map((w, i) => {
    // 三种模式共用固定三个段槽（key a/b/c）：切换模式时 React 复用同一批 DOM 节点，
    // .dd-seg 的 height/backgroundColor 过渡才能真正生效。此前各模式 key 不同
    // （token=0/1/2、cost=0、dur=total/active），跨模式切换整列重建，动画丢失。
    const segStyle = (hFrac, bg, rad) => ({
      height: Math.max(0, hFrac * 100) + '%',
      backgroundColor: bg,
      borderRadius: hFrac > 0 && rad > 0 ? rad + 'px ' + rad + 'px 0 0' : '0'
    })
    let segsEl
    if (isDur) {
      // 总时长是背景，活跃时长是其子集，使用底部叠覆而不是相加堆叠。
      const totalH = durSegs.total ? w.totalMs / M : 0
      const activeH = durSegs.active ? (w.activeMs != null ? w.activeMs : w.durMs) / M : 0
      segsEl = h('div', { className: 'dd-bar-inner' },
        h('div', { key: 'a', className: 'dd-seg', style: segStyle(totalH, TREND_SEG_COLORS.durTotal, Math.min(4, totalH * 220 / 2)) }),
        h('div', { key: 'b', className: 'dd-seg dd-seg-overlay', style: segStyle(activeH, TREND_SEG_COLORS.durActive, Math.min(4, activeH * 220 / 2)) }),
        h('div', { key: 'c', className: 'dd-seg', style: segStyle(0, TREND_SEG_COLORS.cache, 0) }))
    } else {
      let segArr
      if (isCost) {
        segArr = [{ h: (w.costIn + w.costOut + w.costCache) / M, bg: TREND_SEG_COLORS.cost }, { h: 0, bg: TREND_SEG_COLORS.input }, { h: 0, bg: TREND_SEG_COLORS.cache }]
      } else {
        segArr = [
          { h: segs.output ? w.output / M : 0, bg: TREND_SEG_COLORS.output },
          { h: segs.input ? w.input / M : 0, bg: TREND_SEG_COLORS.input },
          { h: segs.cache ? w.cache / M : 0, bg: TREND_SEG_COLORS.cache }
        ]
      }
      // 自适应顶部圆角：顶部段太矮时圆角随高度收缩，避免短段被 4px 圆角剪成“尖尖”凸出
      let topIdx = -1
      for (let j = 0; j < segArr.length; j++) {
        if (segArr[j].h > 0) { topIdx = j; break }
      }
      const rad = topIdx >= 0 ? Math.min(4, segArr[topIdx].h * 220 / 2) : 0
      segsEl = h('div', { className: 'dd-bar-inner' },
        segArr.map((s, j) => h('div', {
          key: j === 0 ? 'a' : j === 1 ? 'b' : 'c',
          className: 'dd-seg',
          style: segStyle(s.h, s.bg, j === topIdx ? rad : 0)
        })))
    }
    let tipRows = null
    if (isDur) {
      tipRows = [
        h('div', { key: 'a', className: 'tt-dur' }, '活跃: ' + fmtDur((w.activeMs != null ? w.activeMs : w.durMs) / 1000)),
        h('div', { key: 't', className: 'tt-dur2' }, '总时长: ' + fmtDur(w.totalMs / 1000)),
        h('div', { key: 'c', className: 'tt-row' }, '会话: ' + fmtIntl(w.sessions))
      ]
    } else if (isCost) {
      tipRows = [h('div', { key: 'cost', className: 'tt-cost' }, '费用: ' + fmtCny(w.costIn + w.costOut + w.costCache))]
    } else {
      tipRows = [
        h('div', { key: 't', className: 'tt-row' }, '总 Token: ' + fmtIntl(w.input + w.output + w.cache)),
        h('div', { key: 'i', className: 'tt-row' }, '输入: ' + fmtIntl(w.input)),
        h('div', { key: 'o', className: 'tt-row' }, '输出: ' + fmtIntl(w.output)),
        h('div', { key: 'c', className: 'tt-row' }, '缓存: ' + fmtIntl(w.cache)),
        h('div', { key: 'cost', className: 'tt-cost' }, '费用: ' + fmtCny(w.costIn + w.costOut + w.costCache))
      ]
    }
    return h('div', {
      key: gran + ':' + i + ':' + w.label,
      className: 'dd-col' + (sel !== null && sel !== i ? ' dim' : ''),
      onClick: (e) => { e.stopPropagation(); setSel(sel === i ? null : i) }
    },
      segsEl,
      h('div', { className: 'dd-tip' },
        h('div', { className: 'tt-title' }, axisLabel(w.label, gran)),
        tipRows))
  })

  const xrow = h('div', { className: 'dd-x' },
    h('div', { className: 'labels' },
      labelIdx ? labelIdx.map((idx) => {
        // 标签居中对齐所属列的列心（列是等宽 flex，列心 = (idx+0.5)/n）
        return h('div', {
          key: idx,
          className: 'cell abs',
          style: { left: ((idx + 0.5) * 100 / n).toFixed(2) + '%' }
        }, h('span', null, axisLabel(buckets[idx].label, gran)))
      }) : buckets.map((w, i) => h('div', { key: i, className: 'cell' },
        h('span', null, axisLabel(w.label, gran))))))

  return h('div', { className: 'dd-chart' },
    head,
    h('div', { className: 'dd-plot-row' },
      h('div', { className: 'dd-y' }, h('span', null, yTop), h('span', null, yBot)),
      h('div', { className: 'dd-plot', onClick: () => setSel(null) }, cols)),
    xrow)
}

