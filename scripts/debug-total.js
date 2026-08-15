// dsh-usage-dashboard — real-data debugger for the 总时长 (totalMs) metric.
//
// Reads the REAL DSH session store (default C:\Users\<user>\.dsh\sessions),
// folds every session with the production engine (src/core/rollup.js), and
// prints, per window (today / 24h / 7d):
//   * sum-of-spans  — the OLD (wrong) semantics: overlapping parallel
//                     sessions double-count time
//   * union         — the NEW semantics: merge overlapping spans first
//   * per-session breakdown of the biggest contributors
//
// Usage: node scripts/debug-total.js [sessionRoot]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { foldSession, queryUsage, rangeBounds } from '../src/core/rollup.js'

const ROOT = process.argv[2] || (process.env.USERPROFILE || 'C:/Users/17644') + '/.dsh/sessions'
const HOUR = 3600000
const DAY = 86400000

// ---------- zstd concatenated-frame JSONL reader ----------
// Mirrors @deepseek-ai/dsh-session-persistence-jsonl scanZstdFrames: parses
// the frame header + block headers to find EXACT frame boundaries (magic-byte
// guessing misaligns frames when magic bytes occur inside compressed data).
const ZSTD_MAGIC = 4247762216 // 0xFD2FB528 little-endian → bytes 28 B5 2F FD

function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return frames
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = blockHeader >>> 1 & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) return frames
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return frames
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) break
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

function readSessionFile(file) {
  const buf = readFileSync(file)
  const lines = []
  for (const { start, end } of scanZstdFrames(buf)) {
    let text
    try { text = zstdDecompressSync(buf.subarray(start, end)).toString('utf8') } catch { continue }
    text = text.trim()
    if (!text) continue
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try { lines.push(JSON.parse(line)) } catch { /* partial line */ }
    }
  }
  return lines
}

// ---------- main ----------
const projects = readdirSync(ROOT)
const sessions = []
for (const proj of projects) {
  const projDir = join(ROOT, proj)
  if (!statSync(projDir).isDirectory()) continue
  let ids
  try { ids = readdirSync(projDir) } catch { continue }
  for (const id of ids) {
    const file = join(projDir, id, 'session.jsonl.zstd')
    try {
      if (!statSync(file).isFile()) continue
    } catch { continue }
    let events
    try { events = readSessionFile(file) } catch { continue }
    if (!events || events.length === 0) continue
    const rollup = foldSession(events)
    if (rollup.last === null) continue
    rollup.id = id
    rollup.cwd = proj.replace(/^--/, '').replace(/--$/, '')
    rollup.projectTitle = rollup.cwd.split(/[\\/]/).filter(Boolean).pop() || '未分组'
    rollup.nEvents = events.length
    rollup.nMsg = events.filter((e) => e.type !== 'step/start').length
    sessions.push(rollup)
  }
}
console.log('sessions found: ' + sessions.length + '  (root: ' + ROOT + ')')
if (sessions.length === 0) process.exit(1)
console.log('\nper-session detail (msg = non step/start events):')
for (const r of sessions.sort((a, b) => b.last - a.last)) {
  const f = r.first ? new Date(r.first).toLocaleString('zh-CN', { hour12: false }) : '—'
  const l = r.last ? new Date(r.last).toLocaleString('zh-CN', { hour12: false }) : '—'
  console.log('  ' + r.id.padEnd(40) + ' evts=' + String(r.nEvents).padStart(6) + ' msg=' + String(r.nMsg).padStart(6) + '  ' + f + ' → ' + l)
}

function fmtDur(ms) {
  const h = ms / HOUR
  if (h >= 1) return (h).toFixed(1) + 'h'
  return Math.round(ms / 60000) + 'm'
}

function analyze(label, req) {
  const [lo, hi] = rangeBounds(req)
  const ints = []
  const spans = []
  for (const r of sessions) {
    if (r.first === null || r.last === null || r.last < lo || r.first > hi) continue
    const s = Math.max(r.first, lo)
    const e = Math.min(r.last, hi)
    if (e <= s) continue
    ints.push([s, e])
    spans.push({ id: r.id.slice(0, 8), title: (r.projectTitle + ' / ' + (r.title || '')).slice(0, 40), span: e - s })
  }
  const sum = spans.reduce((a, x) => a + x.span, 0)
  ints.sort((a, b) => a[0] - b[0])
  let union = 0
  let cs = ints[0] && ints[0][0]
  let ce = ints[0] && ints[0][1]
  for (let i = 1; i < ints.length; i++) {
    if (ints[i][0] <= ce) ce = Math.max(ce, ints[i][1])
    else { union += ce - cs; cs = ints[i][0]; ce = ints[i][1] }
  }
  if (ints.length) union += ce - cs
  spans.sort((a, b) => b.span - a.span)
  console.log('\n== ' + label + '  (' + new Date(lo).toLocaleString() + ' → ' + new Date(hi).toLocaleString() + ')')
  console.log('   sessions in window : ' + spans.length)
  console.log('   旧口径 相加(sum)  : ' + fmtDur(sum) + '   ← 重叠重复计算，就是之前的 90+ 小时')
  console.log('   新口径 并集(union): ' + fmtDur(union) + '   ← 并行会话只计一次')
  console.log('   窗口上限           : ' + fmtDur(hi - lo))
  console.log('   最大贡献者:')
  for (const x of spans.slice(0, 10)) console.log('     - ' + x.id + '  ' + x.title.padEnd(44) + fmtDur(x.span))
}

analyze('今天 (today)', { range: 'today' })
analyze('24H', { range: '24h' })
analyze('7D', { range: '7d' })

// cross-check against the production queryUsage (KPI path)
for (const range of ['today', '24h', '7d']) {
  const q = queryUsage(sessions, { range }, {})
  console.log('\nKPI 校验 queryUsage(' + range + '): 总时长 = ' + fmtDur(q.totals.totalMs) + '  会话数 = ' + q.totals.sessions)
}
