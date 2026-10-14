// CSV 导出纯函数（剩余任务 D2）：字段合法性与公式注入防护。
// 端到端用例仍在 scripts/smoke-host.mjs（"export formula field"）覆盖同一条路径。
import test from 'node:test'
import assert from 'node:assert/strict'

import { csvCell, buildCsv } from '../src/core/csv.js'

// 最小 CSV 行解析器（只处理本仓库会产出的形态：双引号包裹、"" 转义）
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += ch
    } else if (ch === '"' && cur === '') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

test('csvCell: 公式型值先加字面单引号，再整体加 CSV 引号', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('a"b'), '"a""b"')
  assert.equal(csvCell('a\nb'), '"a\nb"')

  // = + - @ 开头一律加前导单引号（在 CSV 引号之内）
  assert.equal(csvCell('=1+1'), "'=1+1")
  assert.equal(csvCell('+1'), "'+1")
  assert.equal(csvCell('-1'), "'-1")
  assert.equal(csvCell('@x'), "'@x")
  // 前导空白/控制字符不能绕过检测（审计 F28）
  assert.equal(csvCell(' =1+1'), "' =1+1")
  assert.equal(csvCell('\t=1'), "'\t=1")
  assert.equal(csvCell('\u0000=1'), "'\u0000=1")
  // 含逗号的公式型值：单引号必须在字段内，否则会被解析成多列
  assert.equal(csvCell('=1,=2'), '"\'=1,=2"')

  assert.equal(csvCell(null), '')
  assert.equal(csvCell(undefined), '')
  assert.equal(csvCell(0), '0')
})

test('buildCsv: 表头 + 每行恰好 8 列，含逗号的公式型值不拆列', () => {
  const rows = [
    {
      t: Date.UTC(2026, 9, 14, 4),
      project: '=1,=2',
      model: 'x"y',
      input: 1000,
      output: 2000,
      cache: 3000,
      cost: 4.5
    },
    { t: 1791907200000, project: 'D:/a,b', model: 'gpt-5', input: 0, output: 0, cache: 0, cost: 0 }
  ]
  const out = buildCsv(rows)
  assert.equal(out.rows, 2)
  assert.equal(out.skipped, 0)
  const lines = out.csv.split('\r\n')
  assert.equal(lines.length, 3)
  assert.equal(lines[0], '时间,项目,模型,工具,输入tokens,输出tokens,缓存tokens,费用(元)')

  const first = parseCsvLine(lines[1])
  assert.equal(first.length, 8, '公式型项目名不得把一行拆成多列')
  assert.equal(first[1], "'=1,=2", '解析后的单元格以字面单引号开头')
  assert.ok(!/^[=+\-@]/.test(first[1]))
  assert.equal(first[2], 'x"y')
  assert.equal(first[3], 'dsh')
  assert.equal(first[4], '1000')
  assert.equal(first[7], '4.500000')

  const second = parseCsvLine(lines[2])
  assert.equal(second.length, 8)
  assert.equal(second[1], 'D:/a,b', '含逗号的普通项目名整体引用后仍是 1 列')
})

test('buildCsv: 坏时间戳跳过并计数，不影响其余行', () => {
  const rows = [
    { t: NaN, project: 'a' },
    { t: '2026-10-14', project: 'b' },
    { t: Date.UTC(2026, 9, 14, 4), project: 'c', input: 1 }
  ]
  const out = buildCsv(rows)
  assert.equal(out.rows, 1)
  assert.equal(out.skipped, 2, 'NaN 与不可解析的时间戳都要计数（审计 F9）')
  assert.equal(out.csv.split('\r\n').length, 2)
})

test('buildCsv: 空输入只有表头，且不带 BOM（BOM 由前端 Blob 添加）', () => {
  const out = buildCsv([])
  assert.equal(out.rows, 0)
  assert.equal(out.skipped, 0)
  assert.equal(out.csv, '时间,项目,模型,工具,输入tokens,输出tokens,缓存tokens,费用(元)')
  assert.ok(!out.csv.startsWith('\uFEFF'))
})
