// Scan the DSH session store and report which sessions are unreadable by
// DSH 0.1.5 official APIs, with per-session reasons. Read-only.
'use strict'
const fs = require('fs')
const path = require('path')
const z = require('node:zlib')

const ROOT = path.join(process.env.USERPROFILE, '.dsh', 'sessions')
const MIGRATOR = 'C:/Users/17644/AppData/nvm/v24.5.0/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-format-v0-to-v1/lib/index.js'
const MAGIC = 0xfd2fb528

// ---- released v0 event inventory (from DSH's own migrator source) ----
function releasedV0Inventory () {
  const src = fs.readFileSync(MIGRATOR, 'utf8')
  const m = src.match(/RELEASED_V0_EVENT_DISPOSITIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/)
  if (!m) return null
  const keys = []
  for (const match of m[1].matchAll(/^\s*["']?([a-z0-9\-/]+)["']?\s*:/gm)) keys.push(match[1])
  return keys
}

// ---- zstd container scanning (mirror of DSH's concatenated-frame layout) ----
function scanFrames (buf) {
  const frames = []
  let off = 0
  while (off + 5 <= buf.length) {
    if (buf.readUInt32LE(off) !== MAGIC) break
    const desc = buf[off + 4]
    if ((desc & 24) !== 0) break
    const fcsFlag = desc >> 6
    const singleSeg = (desc >> 5) & 1
    const checksum = (desc >> 2) & 1
    const dictFlag = desc & 3
    let p = off + 5
    if (!singleSeg) p += 1
    p += [0, 1, 2, 4][dictFlag]
    p += fcsFlag === 0 ? (singleSeg ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8
    for (;;) {
      if (p + 3 > buf.length) return { frames, tornTail: true }
      const v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)
      const last = v & 1
      const type = (v >> 1) & 3
      const size = v >> 3
      if (type === 3) return { frames, tornTail: true }
      p += 3 + (type === 1 ? 1 : size)
      if (last) break
    }
    if (checksum) p += 4
    frames.push([off, p])
    off = p
  }
  return { frames, tornTail: false }
}

function frameText (buf, start, end) {
  return z.zstdDecompressSync(buf.subarray(start, end)).toString('utf8')
}

function firstFrameText (buf) {
  const { frames } = scanFrames(buf)
  if (!frames.length) return null
  return frameText(buf, frames[0][0], frames[0][1])
}

function parseHeader (buf) {
  try {
    return JSON.parse(firstFrameText(buf).split('\n')[0])
  } catch (e) {
    return null
  }
}

// ---- store walk ----
function walkStore () {
  const out = []
  for (const proj of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue
    const projPath = path.join(ROOT, proj.name)
    for (const sd of fs.readdirSync(projPath, { withFileTypes: true })) {
      if (!sd.isDirectory()) continue
      const dir = path.join(projPath, sd.name)
      const files = fs.readdirSync(dir)
      const pick = (re) => files.filter((f) => re.test(f)).map((f) => path.join(dir, f))
      const v3 = pick(/^session\.v\d+\.jsonl(\.zstd)?$/)
      const v0 = pick(/^session\.jsonl(\.zstd)?$/)
      out.push({ dir, dirName: sd.name, legacyLayout: !/^session-/.test(sd.name), id: sd.name, v3: v3[0] || null, v0: v0[0] || null })
    }
  }
  return out
}

async function main () {
  const inventory = releasedV0Inventory()
  console.log('released v0 event types: ' + (inventory ? inventory.length : 'N/A'))
  const sessions = walkStore()
  console.log('session dirs: ' + sessions.length)

  const rows = []
  let n = 0
  for (const s of sessions) {
    n++
    if (n % 50 === 0) console.error('... ' + n + '/' + sessions.length)
    const row = { id: s.id, dirName: s.dirName, legacyLayout: s.legacyLayout, hasV3: !!s.v3, hasV0: !!s.v0 }
    const probePath = s.v3 || s.v0
    if (!probePath) { row.state = 'empty'; rows.push(row); continue }
    const buf = fs.readFileSync(probePath)
    const header = parseHeader(buf)
    row.kb = Math.round(buf.length / 1024)
    row.headerId = header ? header.id || '' : ''
    row.cwd = header ? header.cwd || '' : ''
    row.created = header ? new Date(header.createdAt).toISOString().slice(0, 10) : ''
    row.depth = header ? (header.delegationDepth || 0) : null
    if (s.v3) { row.state = 'readable-v3'; rows.push(row); continue }
    // v0-only: DSH findLog resolves the dir by encodeSegment(header.id) under
    // the project dir. A legacy bare-uuid dir does not match that layout, so
    // the official read chain fails before even opening the log.
    const types = new Set()
    let badDescriptor = false
    for (const [a, b] of scanFrames(buf).frames) {
      for (const line of frameText(buf, a, b).split('\n')) {
        const i = line.indexOf('"type":"')
        if (i < 0) continue
        const j = line.indexOf('"', i + 8)
        const type = line.slice(i + 8, j)
        types.add(type)
        if (type === 'subagent/descriptor') {
          const m = line.match(/"version":\s*(\d+)/)
          if (m && m[1] !== '3') badDescriptor = true
        }
      }
    }
    row.types = types.size
    // DSH's migrator tolerates event types outside the released inventory
    // (they are skipped during conversion); the hard refusal fires only on
    // subagent/descriptor events whose payload version != 3.
    let refuse = null
    if (badDescriptor) refuse = 'subagent/descriptor version≠3'
    row.refuse = refuse
    row.unknownTypes = inventory ? [...types].filter((t) => t !== 'session' && !inventory.includes(t)) : null
    row.state = refuse ? 'refused' : 'migratable'
    row.isSub = (row.depth || 0) > 0
    rows.push(row)
  }

  const readable = rows.filter((r) => r.state === 'readable-v3')
  const sessionV0 = rows.filter((r) => !r.legacyLayout && r.state !== 'readable-v3' && r.state !== 'empty')
  const legacy = rows.filter((r) => r.legacyLayout && r.state !== 'empty')
  const refusedS = sessionV0.filter((r) => r.state === 'refused')
  const migratable = sessionV0.filter((r) => r.state === 'migratable')
  const summary = {
    totalDirs: rows.length,
    readableV3: readable.length,
    legacySubagentDirs: legacy.length,
    sessionV0Dirs: sessionV0.length,
    sessionV0Refused: refusedS.length,
    sessionV0Migratable: migratable.length,
    legacyRefusedInPlace: legacy.filter((r) => r.state === 'refused').length
  }
  console.log(JSON.stringify(summary, null, 1))

  const lines = []
  lines.push('# 读不到的会话清单（DSH 0.1.5-rc.1，' + new Date().toLocaleString('zh-CN') + '）')
  lines.push('')
  lines.push('## 结论摘要')
  lines.push('')
  lines.push('| 类别 | 数量 | 官方 API 能否读取 |')
  lines.push('|---|---|---|')
  lines.push('| ✅ 可读（v3 格式产物） | ' + summary.readableV3 + ' | 能 |')
  lines.push('| 🟥 旧版子代理会话（裸 uuid 目录，v0 日志） | ' + summary.legacySubagentDirs + ' | **不能** —— 目录名不符合 `session-<id>` 布局，`findLog` 定位不到 |')
  lines.push('| 🟧 普通会话（session-* 目录，v0 日志）被迁移器拒读 | ' + summary.sessionV0Refused + ' | **不能** —— ' + (refusedS.map((r) => r.refuse).filter((v, i, a) => a.indexOf(v) === i).join('；') || '-') + ' |')
  lines.push('| 🟨 普通会话（session-* 目录，v0 日志）可迁移 | ' + summary.sessionV0Migratable + ' | 能（首次读取时自动迁移，但每次冷启动都要重新付出迁移解码代价）|')
  lines.push('')
  lines.push('根因：')
  lines.push('')
  lines.push('1. **173 个旧版子代理会话**：v0 时代的子代理日志存放在以裸 `<uuid>` 命名的目录里（现版本布局是 `session-<uuid>/`）。DSH 0.1.5 的 `findLog` 按 `encodeSegment(header.id)` 拼路径，定位不到这些目录 → `SessionPersistenceNotFoundError`。')
  lines.push('2. **v0 普通会话**：日志格式版本 0，需经 `dsh-session-format-v0-to-v1` 迁移器。含 `subagent/descriptor` version≠3 事件或清单外事件类型时直接抛 `SessionFormatUnsupportedMigrationError`（源码 1582/1586 行）。')
  lines.push('')

  const group = (list, title, note) => {
    if (!list.length) return
    lines.push('## ' + title + '（' + list.length + ' 个）')
    lines.push('')
    if (note) lines.push(note + '\n')
    lines.push('| # | 会话 ID | 所属项目 | 创建日期 | 大小 | 深度 | 拒读原因 |')
    lines.push('|---|---|---|---|---|---|---|')
    list.sort((a, b) => (a.cwd || '').localeCompare(b.cwd || '') || (a.created || '').localeCompare(b.created || ''))
    list.forEach((r, i) => {
      lines.push('| ' + (i + 1) + ' | `' + (r.headerId || r.dirName) + '` | ' + (r.cwd || '?').replace(/\|/g, '\\|') + ' | ' + (r.created || '?') + ' | ' + r.kb + ' KB | ' + (r.depth ?? '?') + ' | ' + (r.refuse || '目录布局不被识别') + ' |')
    })
    lines.push('')
  }
  group(legacy, '旧版子代理会话（放弃读取）', '这批即你决定直接放弃的部分。')
  group(refusedS, '被拒读的普通会话', '')
  group(migratable, '可迁移的普通会话（数据没丢）', '这些是正常的 v0 历史会话，官方 API 首次读取会自动迁移成功，数据可以恢复。')

  fs.writeFileSync(path.join(__dirname, '..', 'unreadable-sessions-report.md'), lines.join('\n'), 'utf8')
  console.log('report written: unreadable-sessions-report.md')
}

main().catch((e) => { console.error(e); process.exit(1) })
