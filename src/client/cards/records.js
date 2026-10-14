// 详细记录卡（分页明细 + CSV 导出）。

import { ICON_CAL } from '../icons.js'
import { fmtH9, fmtIntl, fmtUsd, fmtCny, fmtBucket } from '../format.js'
import { React, h } from '../react.js'
import { host } from '../host.js'

export function RecordsCard(props) {
  const PAGE = 20
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [exporting, setExporting] = React.useState(false)
  const baseArgs = {
    range: props.range, from: props.custom.from, to: props.custom.to,
    models: props.modelSel && props.modelSel.length ? props.modelSel : null,
    projects: props.projectSel ? [props.projectSel] : null
  }
  const fetchPage = (p) => host.call('detail', Object.assign({}, baseArgs, { offset: (p - 1) * PAGE, limit: PAGE }))
  // 导出：后端分页拉全并拼 CSV，前端 Blob 下载。文件名带当前范围。
  const doExport = () => {
    if (exporting) return
    setExporting(true)
    host.call('export', baseArgs).then((r) => {
      setExporting(false)
      if (!r || r.error || !r.csv) return
      const blob = new Blob(['\uFEFF' + r.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dsh-usage-' + props.range + '-' + new Date().toISOString().slice(0, 10) + '.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }).catch((err) => { console.warn('[usage-dashboard] export request failed', err); setExporting(false) })
  }
  const fetchSeq = React.useRef(0)
  const pageRef = React.useRef(1)
  const filterKey = [props.range, props.custom.from, props.custom.to, JSON.stringify(props.modelSel || []), props.projectSel || ''].join('|')
  const filterKeyRef = React.useRef(null)
  React.useEffect(() => {
    const filterChanged = filterKeyRef.current !== filterKey
    filterKeyRef.current = filterKey
    const requestedPage = filterChanged ? 1 : pageRef.current
    if (filterChanged) {
      pageRef.current = 1
      setPage(1)
      setData(null)
    }
    const seq = ++fetchSeq.current
    let alive = true
    setLoading(true)
    fetchPage(requestedPage).then((r) => {
      if (alive && seq === fetchSeq.current) {
        setData({ rows: (r && r.rows) ? r.rows : [], total: (r && r.total) || 0, gran: (r && r.gran) || 'day' })
        setLoading(false)
      }
    }).catch((err) => {
      console.warn('[usage-dashboard] detail request failed', err)
      if (alive && seq === fetchSeq.current) {
        setLoading(false)
        setData((d) => d || { rows: [], total: 0, gran: 'day' })
      }
    })
    return () => { alive = false }
  }, [filterKey, props.refreshSeq])
  const go = (p) => {
    if (p < 1) return
    pageRef.current = p
    fetchSeq.current += 1
    const seq = fetchSeq.current
    setPage(p)
    setLoading(true)
    fetchPage(p).then((r) => {
      if (seq !== fetchSeq.current) return
      setData({ rows: (r && r.rows) ? r.rows : [], total: (r && r.total) || 0, gran: (r && r.gran) || 'day' })
      setLoading(false)
    }).catch((err) => { console.warn('[usage-dashboard] detail page request failed', err); if (seq !== fetchSeq.current) return; setLoading(false); setData((d) => d || { rows: [], total: 0, gran: 'day' }) })
  }
  const rows = (data && data.rows) || []
  const total = (data && data.total) || 0
  const gran = (data && data.gran) || 'day'
  const pageCount = Math.max(1, Math.ceil(total / PAGE))
  // 分页收敛：周期刷新后 total 可能变小，使当前页越界（旧实现会显示「41-30 条，共 30 条」
  // 并停在空页）。越界时钳制到最后一页并重新拉取（审计 F30）。
  React.useEffect(() => {
    if (page > pageCount) go(pageCount)
  }, [page, pageCount])
  const fmtCost = props.costMode === 'usd' ? fmtUsd : fmtCny
  const head = h('div', { className: 'dd-records-head' },
    h('div', { className: 'dd-records-title' },
      h('span', { className: 'icon' }, ICON_CAL),
      h('span', null, '详细记录')),
    h('div', { className: 'dd-records-tools' },
      total > 0 ? h('span', { className: 'dd-records-count' },
        '显示 ' + ((page - 1) * PAGE + 1) + '-' + Math.min(page * PAGE, total) + ' 条，共 ' + fmtIntl(total) + ' 条') : null,
      total > 0 ? h('button', { type: 'button', className: 'dd-export-btn', disabled: exporting, onClick: doExport },
        exporting ? '导出中…' : '导出 CSV') : null))
  let body
  if (loading) {
    body = h('div', { className: 'dd-loading' }, '加载中...')
  } else if (rows.length === 0) {
    body = h('div', { className: 'empty' }, '暂无记录')
  } else {
    body = h('div', null,
      h('div', { className: 'dd-records-scroll' },
        h('table', null,
          h('colgroup', null,
            h('col', { style: { width: 100 } }),
            h('col', { style: { width: 150 } }),
            h('col', { style: { width: 120 } }),
            h('col', { style: { width: 56 } }),
            h('col', { style: { width: 64 } }),
            h('col', { style: { width: 64 } }),
            h('col', { style: { width: 64 } }),
            h('col', { style: { width: 88 } })),
          h('thead', null, h('tr', null,
            h('th', null, '时间'),
            h('th', null, '项目'),
            h('th', null, '模型'),
            h('th', null, '工具'),
            h('th', { className: 'num' }, '输入'),
            h('th', { className: 'num' }, '输出'),
            h('th', { className: 'num' }, '缓存'),
            h('th', { className: 'num' }, '费用'))),
          h('tbody', null, rows.map((r) => h('tr', { key: r.t + ':' + (r.model || '') + ':' + (r.project || '') },
            h('td', null, fmtBucket(r.t, gran)),
            h('td', null, h('span', { className: 'sess', title: r.project }, r.project || '-')),
            h('td', null, h('span', { className: 'sess', title: r.model }, r.model || '-')),
            h('td', null, 'dsh'),
            h('td', { className: 'num' }, fmtH9(r.input)),
            h('td', { className: 'num' }, fmtH9(r.output)),
            h('td', { className: 'num' }, fmtH9(r.cache)),
            h('td', { className: 'num' }, fmtCost(r.cost))))))),
      total > PAGE ? h('div', { className: 'dd-records-foot' },
        h('div', { className: 'pg' },
          h('button', { type: 'button', disabled: page <= 1, onClick: () => go(page - 1) }, '上一页'),
          h('span', { className: 'cur' }, page + '/' + pageCount),
          h('button', { type: 'button', disabled: page >= pageCount, onClick: () => go(page + 1) }, '下一页'))) : null)
  }
  return h('div', { className: 'dd-records' }, head, body)
}
