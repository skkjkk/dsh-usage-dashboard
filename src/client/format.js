// 展示格式化：数字/时长/日期。纯函数，无 React/IO，可直接单测。

import { BJ_OFFSET } from './theme.js'

export function pad2(n) { return n < 10 ? '0' + n : String(n) }
export function fmtH9(e) {
  e = Number(e) || 0
  if (e >= 1e9) return (e / 1e9).toFixed(1) + 'B'
  if (e >= 1e6) return (e / 1e6).toFixed(1) + 'M'
  if (e >= 1e3) return (e / 1e3).toFixed(1) + 'K'
  return String(e)
}
export function fmtIntl(e) { return new Intl.NumberFormat('en-US').format(Math.round(Number(e) || 0)) }
// 宿主成本为人民币；$ = ÷7 固定汇率
export function fmtUsd(n) {
  const c = (Number(n) || 0) / 7
  if (c === 0) return '$0.00'
  if (c < 0.01) return '$' + c.toFixed(4)
  return '$' + c.toFixed(2)
}
export function fmtCny(n) {
  const c = Number(n) || 0
  if (c === 0) return '¥0.00'
  if (c < 0.01) return '¥' + c.toFixed(4)
  return '¥' + c.toFixed(2)
}
export function fmtDur(sec) {
  sec = Math.floor(Number(sec) || 0)
  if (sec < 60) return sec + 's'
  const hh = Math.floor(sec / 3600)
  const mm = Math.floor((sec % 3600) / 60)
  if (hh === 0) return mm + 'm'
  return mm > 0 ? hh + 'h ' + mm + 'm' : hh + 'h'
}
export function fmtPct(v) {
  if (v == null) return null
  const n = Math.abs(v)
  const s = n >= 100 ? String(Math.round(n)) + '%' : n.toFixed(1) + '%'
  return (v > 0 ? '+' : v < 0 ? '-' : '') + s
}
export function fmtPrice(v) {
  if (!(v > 0)) return '-'
  const s = String(v)
  return '¥' + s + '/M'
}
export function fmtZhTokens(tokens) {
  const count = Math.trunc(Number(tokens) || 0)
  if (!Number.isFinite(count) || count < 0) return '—'
  if (count < 1000) return String(count)
  const units = [
    { factor: 1e12, suffix: '万亿' },
    { factor: 1e8, suffix: '亿' },
    { factor: 1e7, suffix: '千万' },
    { factor: 1e4, suffix: '万' },
    { factor: 1e3, suffix: '千' }
  ]
  let idx = 0
  while (idx < units.length - 1 && count < units[idx].factor) idx += 1
  while (true) {
    const unit = units[idx]
    const coeff = round3(count / unit.factor)
    const rounded = coeff * unit.factor
    const next = units[idx - 1]
    if (next && rounded >= next.factor) { idx -= 1; continue }
    const s = coeff % 1 === 0 ? String(Math.round(coeff)) : coeff.toFixed(1).replace(/\.0$/, '')
    return s + unit.suffix
  }
}
export function round3(v) {
  const f = Math.pow(10, 3 - Math.floor(Math.log10(Math.abs(v))) - 1)
  return Math.round((v + Number.EPSILON * Math.max(1, Math.abs(v)) * 10) * f) / f
}
// 数字滚动动画：目标值变化时从当前值丝滑过渡（easeOutCubic），切换时间范围数字从小到大/从大到小过渡；
// 目标归零时直接跳变——避免「大数字闪成 0」的拖尾长串数字
export function bjDate(t) { return new Date(t + BJ_OFFSET) }
export function bjMidnight(y, m, d) { return Date.UTC(y, m, d) - BJ_OFFSET }
export function fmtDateParts(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d) }
export function fmtDateMs(t) {
  const d = bjDate(t)
  return fmtDateParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
export function fmtDT(t) {
  const d = bjDate(t)
  const now = bjDate(Date.now())
  const sameDay = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate()
  const hm = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes())
  return sameDay ? hm : (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + hm
}
// 详细记录时间桶标签：小时桶 → 8月14日 21:00；天桶 → 8月10日 00:00
export function fmtBucket(t, gran) {
  const d = bjDate(t)
  const md = (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日'
  return gran === 'hour' ? md + ' ' + pad2(d.getUTCHours()) + ':00' : md + ' 00:00'
}
export function fmtDate(d) {
  return fmtDateParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
export function defaultCustom() {
  const now = bjDate(Date.now())
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
  const from = new Date(Date.UTC(y, m, d - 6))
  const to = new Date(Date.UTC(y, m, d))
  return {
    fromStr: fmtDate(from), from: bjMidnight(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    toStr: fmtDate(to), to: bjMidnight(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1) - 1
  }
}
export function dateToMs(str, endOfDay) {
  const parts = String(str || '').split('-')
  if (parts.length !== 3) return null
  const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2])
  if (!y || !m || !d) return null
  return endOfDay ? bjMidnight(y, m - 1, d + 1) - 1 : bjMidnight(y, m - 1, d)
}
export function axisLabel(label, gran) {
  if (gran === 'hour') return pad2(Number(label)) + ':00'
  return label
}
export function fmtPriceRange(off, peak) {
  const f = (n) => String(n).replace(/\.0+$/, '')
  return '¥' + f(off) + '~' + f(peak) + '/M'
}
