// 图表数学：热力分档、雷达轴归一化与标定。纯函数，无 React/IO，可直接单测。

import { BREAK_PTS, CAL_LEVELS } from './theme.js'

export function calLevel(tokens) {
  let lv = 0
  for (let i = CAL_LEVELS.length - 1; i >= 0; i--) {
    if (tokens >= CAL_LEVELS[i].min) { lv = i; break }
  }
  return lv
}
export function heatBreakpoints(values) {
  const t = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (t.length === 0) return []
  return BREAK_PTS.map((p) => t[Math.min(Math.floor(p / 100 * t.length), t.length - 1)])
}
export function heatColor(v, bps, colors) {
  if (v <= 0 || bps.length === 0) return colors[0]
  for (let s = colors.length - 1; s >= 1; s--) {
    if (v >= bps[s]) return colors[s]
  }
  return colors[1]
}
export const RADAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
export const RADAR_AXES = 6
export const RADAR_ANGLE_STEP = (2 * Math.PI) / RADAR_AXES
export const RADAR_ANGLE_OFF = -Math.PI / 2
export const RADAR_PLOT = 420
export const RADAR_CX = RADAR_PLOT / 2, RADAR_CY = RADAR_PLOT / 2, RADAR_R = 165
export const RADAR_LABEL_R = RADAR_R + 42
export const RADAR_BAND = (v, floor, ceil) => (v == null || !(v > 0)) ? null
  : Math.max(0, Math.min(1, Math.log(v / floor) / Math.log(ceil / floor)))
export const RADAR_DEFS = [
  { name: '响应速度',
    score: m => m.p50ResponseMs > 0 ? Math.max(0, Math.min(1, Math.log(120000 / m.p50ResponseMs) / Math.log(120))) : null,
    fmt: m => m.p50ResponseMs > 0 ? (m.p50ResponseMs / 1000).toFixed(1) + 's' : null },
  { name: '输出速度',
    score: m => m.responseMsSum > 0 ? RADAR_BAND(m.output * 1000 / m.responseMsSum, 1, 166) : null,
    fmt: m => m.responseMsSum > 0 ? Math.round(m.output * 1000 / m.responseMsSum) + ' t/s' : null },
  { name: '平均输出量',
    score: m => m.calls > 0 ? RADAR_BAND(m.output / m.calls, 50, 1645) : null,
    fmt: m => { if (!(m.calls > 0)) return null; const v = m.output / m.calls
      return (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v))) + ' tok' } },
  { name: '平均输入量',
    score: m => m.calls > 0 ? RADAR_BAND(m.billedInput / m.calls, 5000, 293667) : null,
    fmt: m => m.calls > 0 ? (m.billedInput / m.calls / 10000).toFixed(1) + '万' : null },
  { name: '稳定性',
    score: m => m.p50ResponseMs > 0 && m.p95ResponseMs > m.p50ResponseMs
      ? RADAR_BAND(m.p50ResponseMs / m.p95ResponseMs, 0.008, 0.12) : null,
    fmt: m => m.p50ResponseMs > 0 && m.p95ResponseMs ? '慢' + Math.round(m.p95ResponseMs / m.p50ResponseMs) + '倍' : null },
  { name: '实际单价',
    score: m => { const tot = m.input + m.output + m.cache
      return m.cost > 0 && tot > 0 ? RADAR_BAND(1 / (m.cost / (tot / 1e6)), 0.5, 10) : null },
    fmt: m => { const tot = m.input + m.output + m.cache
      return m.cost > 0 && tot > 0 ? '¥' + (m.cost / (tot / 1e6)).toFixed(2) + '/M' : '未定价' } }
]
