// 活跃日历（最近 40 周 × 7 天）。

import { BJ_OFFSET, CAL_LEVELS } from '../theme.js'
import { ICON_GRID } from '../icons.js'
import { calLevel } from '../chart-math.js'
import { fmtIntl, bjDate } from '../format.js'
import { React, h } from '../react.js'
import { host } from '../host.js'

export function CalendarChart(props) {
  const [data, setData] = React.useState(null)
  const [tip, setTip] = React.useState(null)
  const [failed, setFailed] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setFailed(false)
    host.call('calendar', {
      models: props.modelSel && props.modelSel.length ? props.modelSel : null,
      projects: props.projectSel ? [props.projectSel] : null
    }).then((r) => {
      if (!alive) return
      if (r && !r.error) { setData(r); setFailed(false) } else { setData(null); setFailed(true) }
    }).catch((err) => {
      // 静默吞掉错误会让「请求失败」和「没有数据」不可区分（审计 F13）。
      console.warn('[usage-dashboard] calendar request failed', err)
      if (alive) { setData(null); setFailed(true) }
    })
    return () => { alive = false }
  }, [props.modelSel, props.projectSel, props.refreshSeq, retry])
  const head = h('div', { className: 'dd-chart-head' },
    h('div', { className: 'dd-chart-title' },
      h('span', { className: 'icon' }, ICON_GRID),
      h('span', null, '活跃热力图')))
  if (!data || !data.start) {
    if (failed) {
      return h('div', { className: 'dd-chart' }, head,
        h('div', { className: 'dd-empty' }, '热力图加载失败',
          h('button', {
            type: 'button',
            onClick: () => setRetry((v) => v + 1),
            style: { color: 'var(--dd-text2,#18181b)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginLeft: 6 }
          }, '重试')))
    }
    return h('div', { className: 'dd-chart' }, head, h('div', { className: 'dd-loading' }, '加载中...'))
  }
  const COLS = 40
  const dayMap = new Map()
  for (const dd of data.days || []) dayMap.set(dd.t, dd.tokens)
  const endDate = bjDate(data.end || Date.now())
  const endSunday = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() - endDate.getUTCDay()) - BJ_OFFSET
  const gridStart = endSunday - (COLS - 1) * 7 * 86400000
  const dayAt = (offset) => gridStart + offset * 86400000
  const showTip = (event, text) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.max(12, Math.min(window.innerWidth - 12, box.left + box.width / 2))
    const above = box.top > 110
    setTip({ x, y: above ? box.top - 8 : box.bottom + 8, above, text })
  }
  const colsEl = Array.from({ length: COLS }, (_, c) => {
    const cells = Array.from({ length: 7 }, (_, r) => {
      const t = dayAt(c * 7 + r)
      const tokens = dayMap.get(t) || 0
      const lv = calLevel(tokens)
      const d = bjDate(t)
      const text = d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日：' + fmtIntl(tokens) + ' tokens'
      return h('div', {
        key: r,
        className: 'dd-cal-cell',
        style: { backgroundColor: CAL_LEVELS[lv].color },
        onMouseEnter: (e) => showTip(e, text),
        onMouseMove: (e) => showTip(e, text),
        onMouseLeave: () => setTip(null)
      })
    })
    return h('div', { key: c, className: 'dd-cal-col' }, cells)
  })
  return h('div', { className: 'dd-chart' },
    head,
    h('div', { className: 'dd-cal' },
      h('div', { className: 'dd-cal-body' },
        h('div', { className: 'dd-cal-cols' }, colsEl)),
      h('div', { className: 'dd-cal-legend' },
        h('span', { className: 'lbl' }, '少'),
        h('div', { className: 'dots' }, CAL_LEVELS.slice(1).map((l, i) => h('span', { key: i, className: 'dd-cal-dot', title: l.label, 'aria-label': l.label, style: { backgroundColor: l.color } }))),
        h('span', { className: 'lbl' }, '多'))),
    tip ? h('div', {
      className: 'dd-cal-floating-tip' + (tip.above ? '' : ' below'),
      style: { left: tip.x, top: tip.y }
    }, h('div', { className: 'tt-token' }, tip.text)) : null)
}

// 详细记录：时间 | 项目 | 模型 | 工具（固定 dsh）| 输入 | 输出 | 缓存 | 费用
// 分页：每页 20 条；右上角「显示 x-y 条，共 z 条」，底部「上一页 p/n 下一页」
