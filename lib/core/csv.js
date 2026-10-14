// CSV 导出的纯字符串变换（无 ctx、无 IO）。
//
// 以前藏在 src/host.js 的 apply() 体内，只能通过 smoke 的端到端导出用例测（剩余任务 D2）；
// 挪出来之后可以直接断言字段合法性与公式注入防护。

// 单元格转义 + 公式注入防护。
export function csvCell(v) {
  const s = String(v == null ? '' : v)
  // 公式注入防护：先剥掉前导空白/控制字符再判断，否则 " =cmd|..." 这类
  // 前导空格/制表符开头的值可绕过（审计 F28）。
  const probe = s.replace(/^[\s\u0000-\u001f]+/, '')
  // The apostrophe is part of the CELL value, not a prefix outside its CSV
  // quotes. Prefix first, then quote the entire field; otherwise a hostile
  // value containing commas can split into additional formula-capable cells.
  const safe = /^[=+\-@]/.test(probe) ? "'" + s : s
  if (/[",\r\n]/.test(safe)) return '"' + safe.replace(/"/g, '""') + '"'
  return safe
}

// rows → { csv, rows, skipped }
export function buildCsv(rows) {
  const header = '时间,项目,模型,工具,输入tokens,输出tokens,缓存tokens,费用(元)'
  const lines = [header]
  let skipped = 0
  for (const r of rows) {
    // 一条坏时间戳不再让整次导出 500：跳过该行并计数（审计 F9）。
    if (!Number.isFinite(r.t)) { skipped++; continue }
    let iso
    try { iso = new Date(r.t).toISOString() } catch (e) { skipped++; continue }
    lines.push([
      iso,
      r.project || '',
      r.model || '',
      'dsh',
      r.input || 0,
      r.output || 0,
      r.cache || 0,
      (r.cost || 0).toFixed(6)
    ].map(csvCell).join(','))
  }
  return { csv: lines.join('\r\n'), rows: lines.length - 1, skipped }
}
