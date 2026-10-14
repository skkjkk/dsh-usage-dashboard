// 看板主体：KPI 行 + 图表网格 + 筛选联动。

import { COST_TIP, DUR_TIP, TOTAL_TIP } from './theme.js'
import { ICON_MODEL, ICON_PROJECT } from './icons.js'
import { fmtH9, fmtIntl, fmtUsd, fmtCny, fmtDur, fmtZhTokens, defaultCustom } from './format.js'
import { FilterBar, DurPopup, PricingPopup, UnmatchedBadge, CacheUnknownBadge, StatCard } from './primitives.js'
import { TrendChart } from './cards/trend.js'
import { HeatChart, DistributionCard } from './cards/heat.js'
import { RadarCard } from './cards/radar.js'
import { CacheTrendCard } from './cards/cache.js'
import { CalendarChart } from './cards/calendar.js'
import { RecordsCard } from './cards/records.js'
import { loadPrefs, savePrefs } from './prefs.js'
import { React, h } from './react.js'
import { host } from './host.js'

// 看板轮询间隔（毫秒）。此前由构建期把 `ctx.interval(...)` 正则替换成 setInterval，
// 现在直接写标准 API——源码本身就是最终形态，不再依赖字符串改写（审计 F16）。
const POLL_INTERVAL_MS = 30000

export function Dashboard() {
  const [state, setState] = React.useState({ loading: true, error: false, data: null })
  const [refreshSeq, setRefreshSeq] = React.useState(0)
  const prefsRef = React.useRef(null)
  if (prefsRef.current === null) prefsRef.current = loadPrefs()
  const prefs = prefsRef.current
  const [range, setRange] = React.useState(prefs.range || 'today')
  const [custom, setCustom] = React.useState(prefs.custom || defaultCustom())
  const [modelSel, setModelSel] = React.useState(prefs.modelSel || null)
  const [projectSel, setProjectSel] = React.useState(prefs.projectSel || null)
  const [busy, setBusy] = React.useState(false)
  const [costMode, setCostMode] = React.useState(prefs.costMode || 'cny')
  const [tokenMode, setTokenMode] = React.useState(prefs.tokenMode || 'intl')
  const [anim, setAnim] = React.useState(false)
  const animTimer = React.useRef(0)
  const dataKeyRef = React.useRef(null)
  const loadSeq = React.useRef(0)
  const load = React.useCallback((silent) => {
    loadSeq.current += 1
    const seq = loadSeq.current
    if (!silent) setBusy(true)
    // busy 只由「最新一次请求」收尾。被顶掉的旧请求会提前 return，若它顺手清 busy
    // 就会清掉新请求的转圈；而旧实现里被 silent 轮询顶掉的非 silent 请求直接 return，
    // setBusy(false) 永不执行 → 转圈永久残留（审计 F12）。
    const settle = () => { if (seq === loadSeq.current) setBusy(false) }
    host.call('usage', { range: range, from: custom.from, to: custom.to, models: modelSel && modelSel.length ? modelSel : null, projects: projectSel ? [projectSel] : null }).then((r) => {
      if (seq !== loadSeq.current) return
      setState({ loading: false, error: !r || !!r.error, data: !r || r.error ? null : r })
      if (r && !r.error) setRefreshSeq((v) => v + 1)
      settle()
      // 筛选/范围变化时内容区做一次淡入过渡（同键的周期刷新不重复触发）。
      // 用 JSON 而非 join(",") 拼键：项目 id 是 cwd，含逗号的路径会让
      // ['a,b'] 与 ['a','b'] 撞成同一个键，切换筛选时漏掉淡入（审计 F14）。
      const key = range + '|' + custom.from + '|' + custom.to + '|' + JSON.stringify(modelSel || []) + '|' + JSON.stringify(projectSel || '')
      if (dataKeyRef.current !== key) {
        dataKeyRef.current = key
        setAnim(true)
        clearTimeout(animTimer.current)
        animTimer.current = setTimeout(() => setAnim(false), 450)
      }
    }).catch((err) => {
      // 保留错误对象并留日志：静默吞掉会让「请求失败」与「真的没数据」不可区分（审计 F13）。
      console.warn('[usage-dashboard] usage request failed', err)
      if (seq !== loadSeq.current) return
      setState({ loading: false, error: true, data: null })
      settle()
    })
  }, [range, custom.from, custom.to, modelSel, projectSel])
  React.useEffect(() => {
    savePrefs({ range, custom, modelSel, projectSel, costMode, tokenMode })
  }, [range, custom, modelSel, projectSel, costMode, tokenMode])
  React.useEffect(() => {
    load(true)
    const off = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => { clearInterval(off) }
  }, [load])
  // 卸载时清掉淡入定时器，避免对已卸载组件 setState（审计 F30）。
  React.useEffect(() => () => { clearTimeout(animTimer.current) }, [])

  const secHead = h('div', { className: 'dd-sec-head' },
    h('h2', { className: 'dd-sec-heading' }, '数据看板'),
    h('p', { className: 'dd-sec-intro' }, '查看 DSH 会话的 Token 用量、费用与时长统计。'))
  if (state.loading) {
    return h('div', { className: 'dd-root' }, secHead, h('div', { className: 'dd-dash' }, h('div', { className: 'dd-loading' }, '加载中...')))
  }
  if (state.error || !state.data || !state.data.totals) {
    return h('div', { className: 'dd-root' }, secHead,
      h('div', { className: 'dd-dash' },
        h('div', { className: 'dd-empty' }, '数据加载失败', h('button', { type: 'button', onClick: () => load(false), style: { color: 'var(--dd-text2,#18181b)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 } }, '重试'))))
  }
  const t = state.data.totals
  const pct = t.pct || {}
  const meta = state.data.meta || { models: [], projects: [], vendors: {} }
  // 数字/英文字体统一：四个 Token 卡片共用同一个单位切换（intl/zh），不会出现「缓存千万、其他 M」混用
  const fmtTokens = (n) => tokenMode === 'zh' ? fmtZhTokens(n) : fmtH9(n)
  const fmtCostVal = (n) => costMode === 'cny' ? fmtCny(n) : fmtUsd(n)

  const durPopup = h(DurPopup, null)
  const pricingPopup = h(PricingPopup, { pricing: meta.pricing })

  const cards1 = [
    { title: '预估费用', color: 'dd-v-cost', tip: COST_TIP, popup: pricingPopup, popupWidth: 400, popupId: 'pricing', pct: pct.cost, onClick: () => setCostMode(costMode === 'cny' ? 'usd' : 'cny'), num: t.cost, fmt: fmtCostVal },
    { title: '总 Token', pct: pct.totalTokens, onClick: () => setTokenMode(tokenMode === 'intl' ? 'zh' : 'intl'), num: t.totalTokens, fmt: fmtTokens },
    { title: '输入 Token', pct: pct.inputTokens, num: t.inputTokens, fmt: fmtTokens },
    { title: '输出 Token', pct: pct.outputTokens, num: t.outputTokens, fmt: fmtTokens },
    { title: '缓存 Token', color: 'dd-v-cache', pct: pct.cacheTokens, onClick: () => setTokenMode(tokenMode === 'intl' ? 'zh' : 'intl'), num: t.cacheTokens, fmt: fmtTokens }
  ]
  const cards2 = [
    { title: '活跃时长', color: 'dd-v-dur', tip: DUR_TIP, popup: durPopup, popupWidth: 340, pct: pct.activeMs, num: t.activeMs / 1000, fmt: fmtDur },
    { title: '总时长', tip: TOTAL_TIP, popup: durPopup, popupWidth: 340, pct: pct.totalMs, num: t.totalMs / 1000, fmt: fmtDur },
    { title: '会话数', pct: pct.sessions, num: t.sessions, fmt: fmtIntl },
    { title: '总消息数', pct: pct.totalMessages, num: t.totalMessages, fmt: fmtIntl },
    { title: '用户消息数', pct: pct.userMessages, num: t.userMessages, fmt: fmtIntl }
  ]
  // 选择了模型后只保留费用/Token 5 项 KPI（时长与会话数隐藏）
  const modelFiltered = !!(modelSel && modelSel.length)
  const kpiCards = modelFiltered ? cards1 : cards1.concat(cards2)
  return h('div', { className: 'dd-root' },
    secHead,
    h('div', { className: 'dd-dash' },
      h(FilterBar, {
        range: range, setRange: setRange,
        custom: custom, setCustom: setCustom,
        modelSel: modelSel, setModelSel: setModelSel,
        projectSel: projectSel, setProjectSel: setProjectSel,
        meta: meta, busy: busy,
        onApply: (next) => { setCustom(next) }
      }),
      h(UnmatchedBadge, { pricing: meta.pricing }),
      h(CacheUnknownBadge, { pricing: meta.pricing }),
      h('div', { className: 'dd-anim' + (anim ? ' on' : '') },
        h('div', { className: 'dd-rows' }, kpiCards.map(renderCard)),
        h('div', { className: 'dd-charts' },
          h(TrendChart, { buckets: state.data.buckets || [], granularity: state.data.granularity || 'week' }),
          h(HeatChart, { heat: state.data.heat || null })),
        h('div', { className: 'dd-side-row' },
          h(RadarCard, { models: meta.models || [], modelSel: modelSel }),
          h(CacheTrendCard, {
            buckets: state.data.buckets || [], granularity: state.data.granularity || 'week',
            totals: t, models: meta.models || [], modelSel: modelSel,
            usd: costMode === 'usd',
            onPickModel: (id) => setModelSel(modelSel && modelSel.length === 1 && modelSel[0] === id ? null : [id])
          })),
        h('div', { className: 'dd-dist-row' },
          h(DistributionCard, { icon: ICON_MODEL, title: '模型分布', items: (meta.dist && meta.dist.models) || [] }),
          h(DistributionCard, { icon: ICON_PROJECT, title: '项目分布', items: (meta.dist && meta.dist.projects) || [] })),
        h('div', { className: 'dd-charts' },
          h(CalendarChart, { modelSel: modelSel, projectSel: projectSel, refreshSeq: refreshSeq })),
        h(RecordsCard, { range: range, custom: custom, modelSel: modelSel, projectSel: projectSel, costMode: costMode, refreshSeq: refreshSeq }))))
}

export function renderCard(c) {
  return h(StatCard, {
    key: c.title,
    title: c.title,
    color: c.color,
    tip: c.tip,
    popup: c.popup,
    popupWidth: c.popupWidth,
    pct: c.pct,
    onClick: c.onClick,
    num: c.num,
    fmt: c.fmt
  })
}
