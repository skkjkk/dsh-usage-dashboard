// 通用 UI 原子：分段控件、下拉、弹层、KPI 卡片。

import { RANGES } from './theme.js'
import { ICON_MODEL, ICON_PROJECT, ARROW, CHECK, ICON_INFO } from './icons.js'
import { fmtPct, fmtPrice, fmtPriceRange, fmtIntl, dateToMs } from './format.js'
import { useTween } from './hooks.js'
import { React, h } from './react.js'

export function Segmented(props) {
  return h('div', { className: 'dd-seg-group', role: 'group', 'aria-label': props.ariaLabel },
    props.options.map((m) => h('button', {
      key: m.key,
      type: 'button',
      className: 'dd-seg-btn' + (props.active === m.key ? ' on' : ''),
      'aria-pressed': props.active === m.key,
      onClick: () => props.onSelect(m.key)
    }, m.icon || null, m.label)))
}

export function Dropdown(props) {
  const open = !!props.open
  const menu = open ? h('div', { className: 'dd-drop-menu' },
    props.options.map((o) => h('button', {
      key: o.key,
      type: 'button',
      className: 'dd-drop-item' + (o.active ? ' on' : ''),
      onClick: () => { props.onSelect(o.key); props.onToggle(false) }
    },
    h('span', { className: 'dd-check' }, o.active ? CHECK : null),
    h('span', { className: 'label' }, o.label),
    o.sub ? h('span', { className: 'sub' }, o.sub) : null))) : null
  return h('div', { className: 'dd-drop' },
    h('button', { type: 'button', className: 'dd-drop-btn' + (open ? ' open' : ''), onClick: () => props.onToggle(!open) },
      h('span', { className: 'dd-drop-icon' }, props.icon),
      h('span', { className: 'dd-drop-label' }, props.title),
      h('span', { className: 'dd-drop-value' }, props.value),
      h('span', { className: 'dd-drop-arrow' }, ARROW)),
    menu)
}

// 模型多选下拉：按系列（厂商，来自 pricing CSV）分组，系列可展开勾选具体模型；
// 选中后按钮只显示「模型 N项」（灰色），不显示具体模型名
export function ModelSelect(props) {
  const [open, setOpen] = React.useState(false)
  const [expanded, setExpanded] = React.useState({})
  const selected = props.selected || []
  const models = props.models || []
  const vendors = props.vendors || {}
  const seriesMap = new Map()
  for (const m of models) {
    const s = vendors[m.id] || '其他'
    let arr = seriesMap.get(s)
    if (!arr) { arr = []; seriesMap.set(s, arr) }
    arr.push(m.id)
  }
  const series = Array.from(seriesMap.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh'))
  const toggle = (id) => {
    const has = selected.indexOf(id) >= 0
    const next = has ? selected.filter((x) => x !== id) : selected.concat(id)
    props.onSelect(next.length ? next : null)
  }
  return h('div', { className: 'dd-drop' },
    h('button', {
      type: 'button',
      className: 'dd-drop-btn' + (open ? ' open' : ''),
      onClick: () => setOpen(!open)
    },
      h('span', { className: 'dd-drop-icon' }, props.icon),
      h('span', { className: 'dd-drop-label' }, '模型'),
      selected.length > 0 ? h('span', { className: 'dd-drop-count' }, selected.length + '项') : h('span', { className: 'dd-drop-value' }, '全部'),
      h('span', { className: 'dd-drop-arrow' }, ARROW)),
    open ? h('div', { className: 'dd-model-menu' },
      h('div', { className: 'dd-model-actions' },
        h('button', { type: 'button', className: 'link', onClick: () => props.onSelect(null) }, '全部'),
        // 全选 == 不过滤：置空而非把全部模型 id 塞进查询串（245+ id 会逼近 URL/头部上限）
        h('button', { type: 'button', className: 'link', onClick: () => props.onSelect(null) }, '全选'),
        h('span', { className: 'spacer' }),
        h('span', { className: 'cnt' }, '已选 ' + selected.length + ' 项')),
      h('div', { className: 'dd-model-scroll' },
        series.map(([name, ids]) => {
          const isOpen = expanded[name] === true
          return h('div', { key: name, className: 'dd-series' },
            h('button', {
              type: 'button',
              className: 'dd-series-head',
              onClick: () => setExpanded(Object.assign({}, expanded, { [name]: !isOpen }))
            },
              h('span', { className: 'chev' + (isOpen ? ' open' : '') }, ARROW),
              h('span', { className: 'name' }, name),
              h('span', { className: 'cnt' }, ids.length)),
            isOpen ? h('div', { className: 'dd-series-body' },
              ids.map((id) => h('label', { key: id, className: 'dd-model-item' },
                h('input', { type: 'checkbox', checked: selected.indexOf(id) >= 0, onChange: () => toggle(id) }),
                h('span', { className: 'lbl' }, id)))) : null)
        }))) : null)
}

export function FilterBar(props) {
  const r = props.range
  const meta = props.meta || { models: [], projects: [], vendors: {} }
  const [openDrop, setOpenDrop] = React.useState(null)
  const [draftCustom, setDraftCustom] = React.useState(props.custom)
  React.useEffect(() => setDraftCustom(props.custom), [props.custom.from, props.custom.to, props.custom.fromStr, props.custom.toStr])
  const projectOptions = [{ key: 'all', label: '全部' }].concat(meta.projects.map((p) => ({ key: p.id, label: p.title, sub: p.sessions + ' 会话' })))
  const proj = meta.projects.find((p) => p.id === props.projectSel)
  const projectValue = proj ? proj.title : (props.projectSel || '全部')
  const customRow = r === 'custom' ? h('div', { className: 'dd-custom' },
    h('input', { type: 'date', value: draftCustom.fromStr, onChange: (e) => setDraftCustom({ fromStr: e.target.value, from: dateToMs(e.target.value, false), toStr: draftCustom.toStr, to: draftCustom.to }) }),
    h('span', { className: 'sep' }, '–'),
    h('input', { type: 'date', value: draftCustom.toStr, onChange: (e) => setDraftCustom({ fromStr: draftCustom.fromStr, from: draftCustom.from, toStr: e.target.value, to: dateToMs(e.target.value, true) }) }),
    h('div', { className: 'dd-spacer' }),
    h('button', { type: 'button', className: 'apply', onClick: () => props.onApply(draftCustom) }, '应用')) : null
  const hasFilter = (props.modelSel && props.modelSel.length) || props.projectSel
  return h('div', { className: 'dd-filters' },
    h('div', { className: 'dd-range' },
      RANGES.map((x) => h('button', {
        key: x.key,
        type: 'button',
        title: x.title,
        className: 'dd-pill' + (r === x.key ? ' on' : ''),
        onClick: () => props.setRange(x.key)
      }, x.label))),
    customRow,
    h('div', { className: 'dd-spacer' }),
    h('div', { className: 'dd-filter-row' },
      h(ModelSelect, {
        icon: ICON_MODEL,
        selected: props.modelSel,
        models: meta.models,
        vendors: meta.vendors,
        onSelect: props.setModelSel
      }),
      h(Dropdown, {
        open: openDrop === 'project', onToggle: (v) => setOpenDrop(v ? 'project' : null),
        icon: ICON_PROJECT, title: '项目', value: projectValue,
        options: projectOptions,
        onSelect: (k) => props.setProjectSel(k === 'all' ? null : k)
      }),
      hasFilter ? h('button', { type: 'button', className: 'dd-clear', onClick: () => { props.setModelSel(null); props.setProjectSel(null) } }, '清除') : null,
      props.busy ? h('span', { className: 'dd-busy' }, h('span', { className: 'spinner' }), '统计中') : null))
}

// 点击弹出的信息面板（fixed 定位，点击外部关闭；视口内防溢出）
export function Popup(props) {
  const [pos, setPos] = React.useState(null)
  const btnRef = React.useRef(null)
  React.useEffect(() => {
    if (!props.open) { setPos(null); return }
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = props.width || 320
    const left = Math.min(Math.max(r.left, 8), Math.max(8, window.innerWidth - w - 8))
    setPos({ left: left, top: r.bottom + 8 })
  }, [props.open])
  React.useEffect(() => {
    if (!props.open || !pos) return
    const el = document.querySelector('.dd-pop')
    if (!el) return
    const hh = el.getBoundingClientRect().height
    const maxTop = window.innerHeight - hh - 8
    if (pos.top > maxTop) setPos({ left: pos.left, top: Math.max(8, maxTop) })
  }, [props.open, pos])
  React.useEffect(() => {
    if (!props.open) return
    const onDoc = (e) => {
      const t = e.target
      if (!t || typeof t.closest !== 'function') return
      if (!t.closest('.dd-pop') && t !== btnRef.current) props.onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [props.open])
  return h('span', { className: 'dd-info-wrap' },
    h('button', {
      ref: btnRef,
      type: 'button',
      className: 'dd-info',
      'data-dd-popup': props.popupId,
      'aria-label': '详情',
      title: props.tip,
      onClick: (e) => { e.stopPropagation(); props.onToggle() }
    }, ICON_INFO),
    props.open && pos ? h('div', { className: 'dd-pop', style: { left: pos.left, top: pos.top, width: props.width || 320 } }, props.children) : null)
}

export function DurPopup() {
  return h('div', null,
    h('div', { className: 'pop-title' }, '会话时长说明'),
    h('div', { className: 'pop-body' },
      h('div', { className: 'pop-sec', style: { marginTop: 0 } },
        h('div', { className: 'sec-title' }, '活跃时长'),
        h('div', null, '模型每完成一次回复（step）记一段生成时间：从请求发出到回复完毕，之后的工具执行不计入。旧版日志保留了输出分块事件时，从 AI 开始输出算起，不含排队等待与首 Token 延迟（TTFT）。两次 prompt 之间的空闲不计入；并行会话分别累加，所以活跃时长可能超过 24H。')),
      h('div', { className: 'pop-sec' },
        h('div', { className: 'sec-title' }, '总时长'),
        h('div', null, '总时长 = 各会话从首条消息到末条消息的时间跨度，先合并重叠区间（并行会话只计一次）再相加。包含中间思考、看代码等空闲时间，但不包含会话之间的间隔，不会超过所选时间范围。'))))
}
export function PricingPopup(props) {
  const pricing = props.pricing || { coverage: 0, rows: [] }
  const rows = pricing.rows || []
  const hasDs = rows.some((r) => r.ds)
  const unmatched = rows.filter((r) => !r.matched)
  const cacheUnknownUsed = pricing.cacheUnknownUsed || []
  // 缓存读取价未知的行：PRICES 里是 0，但那是「没核到官方价」而不是「官方价 0」，
  // 表格里必须显示成「未知」而不是 ¥0（审计 F23）。
  const cell = (r, i) => {
    if (i === 2 && r.cacheUnknown) return r.ds ? fmtPriceRange(r.off[i], r.peak[i]) + '?' : '未知'
    return r.ds ? fmtPriceRange(r.off[i], r.peak[i]) : (r.p ? fmtPrice(r.p[i]) : '-')
  }
  return h('div', null,
    h('div', { className: 'pop-title' }, '模型定价匹配'),
    h('div', { className: 'pop-body' },
      h('div', null, '当前定价覆盖 ' + pricing.coverage + '% 的 Token 用量，未匹配的模型暂不计费。'),
      unmatched.length ? h('div', { className: 'pop-sec', style: { marginTop: 6 } },
        '未匹配 ' + unmatched.length + ' 个模型：' + unmatched.map((r) => r.model).join('、') + '。可在 GitHub 提交模型定价补充。') : null,
      cacheUnknownUsed.length ? h('div', { className: 'pop-sec', style: { marginTop: 6 } },
        '缓存读取价未核到官方价：' + cacheUnknownUsed.length + ' 个模型（' + cacheUnknownUsed.map((r) => r.model).join('、') +
        '），本窗口约 ' + fmtIntl(pricing.cacheUnknownTokens || 0) + ' 缓存 token 按 ¥0 计——费用可能被低估。') : null,
      hasDs ? h('div', { className: 'pop-sec', style: { marginTop: 6 } }, 'DeepSeek 现行两型号按峰谷计费：高峰 9:00-12:00、14:00-18:00（北京时间），空闲为高峰一半；表中 ¥a~b/M 为空闲~高峰。V4.1 Flash 新价自 2026-09-10 12:00 起生效；V4 Pro 自 2026-09-14 12:00 起路由到 Flash 并按 Flash 单价计费。') : null),
    h('table', null,
      h('thead', null, h('tr', null,
        h('th', null, '模型'),
        h('th', null, '匹配'),
        h('th', null, '输入'),
        h('th', null, '输出'),
        h('th', null, '缓存'))),
      h('tbody', null, rows.map((r) => h('tr', { key: r.model },
        h('td', { className: 'mdl' }, r.model),
        h('td', null, r.matched || '未匹配'),
        h('td', null, cell(r, 0)),
        h('td', null, cell(r, 1)),
        h('td', null, cell(r, 2)))))))
}

// 未匹配价格提醒：pricing.coverage < 100% 且确有未匹配行时，过滤栏右侧
// 常驻一枚琥珀色徽标，点击直接打开费用卡片上的定价弹层。¥0 静默漏计
// 曾经真实发生过（大小写/后缀类），可见化是同类问题的通用解。
// 两个徽标（未匹配 / 缓存价未知）共用这段「打开定价弹层」的交互。
function openPricingPopup(e) {
  // 打开定价弹层本身。旧实现点击费用卡片只会切换 ¥/$（卡片 onClick 的职责），
  // 与徽标承诺的「点击查看详情」不符（审计 F15）。
  const root = e.currentTarget.closest('.dd-root')
  const trigger = root && root.querySelector('[data-dd-popup="pricing"]')
  if (trigger) trigger.click()
  else if (root) {
    const card = root.querySelector('.dd-kpi')
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

export function UnmatchedBadge(props) {
  const pricing = props.pricing || { coverage: 100, rows: [] }
  const rows = pricing.rows || []
  const unmatched = rows.filter((r) => !r.matched)
  if (pricing.coverage >= 100 || !unmatched.length) return null
  return h('button', {
    type: 'button',
    className: 'dd-unmatched-badge',
    title: '未匹配定价的模型：' + unmatched.map((r) => r.model).join('、') + '（这些模型的费用未计入，点击查看详情）',
    onClick: openPricingPopup
  }, '⚠ ' + unmatched.length + ' 个模型未匹配价格，费用未计入')
}

// 缓存读取价未知提醒（审计 F23）：模型本身是「已匹配」的（覆盖率不变），但 CSV 第 5 列为空
// ——没核到官方缓存读取价，而本窗口确实有缓存 token，按 ¥0 计会**静默低估**费用。
// 与未匹配徽标区分开：未匹配是「整条费用没算」，这里是「缓存那部分没算」。
export function CacheUnknownBadge(props) {
  const pricing = props.pricing || {}
  const used = pricing.cacheUnknownUsed || []
  if (!used.length) return null
  const models = used.map((r) => r.model)
  return h('button', {
    type: 'button',
    className: 'dd-unmatched-badge dd-cache-unknown-badge',
    title: '缓存读取价未核到官方价：' + models.join('、') + '（本窗口约 ' + fmtIntl(pricing.cacheUnknownTokens || 0) +
      ' 缓存 token 按 ¥0 计，费用可能低估，点击查看详情）',
    onClick: openPricingPopup
  }, '⚠ ' + models.length + ' 个模型的缓存读取价未知，费用可能低估')
}

export function StatCard(props) {
  const cls = 'dd-kpi' + (props.onClick ? ' clickable' : '')
  const pct = props.pct
  const pv = useTween(pct == null ? 0 : pct, 500)
  const pctEl = pct == null ? null : h('span', { className: 'pct ' + (pct > 0 ? 'dd-pct-up' : pct < 0 ? 'dd-pct-down' : 'dd-pct-flat') }, fmtPct(pv))
  const val = useTween(props.num, 600)
  const [open, setOpen] = React.useState(false)
  const info = props.popup ? h(Popup, {
    open: open,
    onToggle: () => setOpen(!open),
    onClose: () => setOpen(false),
    width: props.popupWidth || 320,
    tip: props.tip,
    popupId: props.popupId,
    children: props.popup
  }) : null
  return h('div', {
     className: cls,
     onClick: props.onClick,
     role: props.onClick ? 'button' : undefined,
     tabIndex: props.onClick ? 0 : undefined,
     'aria-label': props.onClick ? props.title + '，点击切换显示单位' : undefined,
     onKeyDown: props.onClick ? (e) => {
       // 只处理卡片自身获得焦点时的按键：内层 ⓘ 按钮有自己的 Enter/Space 行为，
       // 冒泡到卡片会让一次按键同时「切换单位」和「打开弹层」（审计 F30）。
       if (e.target !== e.currentTarget) return
       if (e.key === 'Enter' || e.key === ' ') {
         e.preventDefault()
         props.onClick()
       }
     } : undefined
   },
    h('div', { className: 'dd-kpi-label' },
      h('span', { className: 'lt' },
        h('span', null, props.title),
        info),
      pctEl),
    h('div', { className: 'dd-kpi-value' + (props.color ? ' ' + props.color : '') }, props.fmt(val)))
}

