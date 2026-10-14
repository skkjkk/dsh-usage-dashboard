// 视图状态持久化（localStorage，不可用时静默降级）。

import { RANGES } from './theme.js'
import { fmtDateMs } from './format.js'

export const PREFS_KEY = 'dsh.usageDashboard.v1'
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    const out = {}
    if (p.range && RANGES.some((x) => x.key === p.range)) out.range = p.range
    if (p.custom && Number.isFinite(p.custom.from) && Number.isFinite(p.custom.to)) {
      out.custom = {
        fromStr: p.custom.fromStr || fmtDateMs(p.custom.from),
        from: p.custom.from,
        toStr: p.custom.toStr || fmtDateMs(p.custom.to),
        to: p.custom.to
      }
    }
    if (Array.isArray(p.modelSel) && p.modelSel.length) out.modelSel = p.modelSel
    if (typeof p.projectSel === 'string' && p.projectSel) out.projectSel = p.projectSel
    if (p.costMode === 'usd' || p.costMode === 'cny') out.costMode = p.costMode
    if (p.tokenMode === 'intl' || p.tokenMode === 'zh') out.tokenMode = p.tokenMode
    return out
  } catch (e) { return {} }
}
export function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch (e) { /* ignore */ }
}
