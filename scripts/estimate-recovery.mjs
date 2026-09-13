// Estimate recoverable token/cost volume per session group, using the
// plugin's own aggregation engine (foldSession) on top of the tolerant
// zstd frame decoder. Read-only; writes a small markdown report.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { foldSession } from '../src/core/rollup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(os.homedir(), '.dsh', 'sessions')
const MAGIC = 0xfd2fb528

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
      if (p + 3 > buf.length) return { frames }
      const v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)
      const last = v & 1
      const type = (v >> 1) & 3
      if (type === 3) return { frames }
      p += 3 + (type === 1 ? 1 : v >> 3)
      if (last) break
    }
    if (checksum) p += 4
    frames.push([off, p])
    off = p
  }
  return { frames }
}

function decodeLog (buf) {
  const { frames } = scanFrames(buf)
  if (!frames.length) return null
  const events = []
  let first = true
  for (const [a, b] of frames) {
    const text = z2str(buf.subarray(a, b))
    for (let i = 0; i < text.length; i++) {
      const nl = text.indexOf('\n', i)
      const line = nl < 0 ? text.slice(i) : text.slice(i, nl)
      i = nl < 0 ? text.length : nl
      if (!line) continue
      if (first) { first = false; continue } // header line
      try { events.push(JSON.parse(line)) } catch (e) { /* tolerant skip */ }
    }
  }
  return events
}
import { zstdDecompressSync } from 'node:zlib'
function z2str (u8) { return zstdDecompressSync(u8).toString('utf8') }

function sumRollup (r) {
  let input = 0; let output = 0; let cache = 0; let cost = 0
  for (const b of r.buckets.values()) {
    for (const per of b.per.values()) {
      input += per[0]; output += per[1]; cache += per[2]
      cost += per[3] + per[4] + per[5]
    }
  }
  return { input, output, cache, cost }
}

const groups = {
  'readable-v3': { sessions: 0, input: 0, output: 0, cache: 0, cost: 0 },
  'session-v0': { sessions: 0, input: 0, output: 0, cache: 0, cost: 0 },
  'legacy-subagent': { sessions: 0, input: 0, output: 0, cache: 0, cost: 0 }
}

let n = 0
const dirs = []
for (const proj of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue
  const pp = path.join(ROOT, proj.name)
  for (const sd of fs.readdirSync(pp, { withFileTypes: true })) {
    if (!sd.isDirectory()) continue
    dirs.push({ pp: path.join(pp, sd.name), name: sd.name, legacy: !/^session-/.test(sd.name) })
  }
}
console.log('dirs: ' + dirs.length)
for (const d of dirs) {
  n++
  if (n % 40 === 0) console.error('... ' + n + '/' + dirs.length)
  const files = fs.readdirSync(d.pp)
  const v3 = files.find((f) => /^session\.v\d+\.jsonl\.zstd$/.test(f))
  const v0 = files.find((f) => /^session\.jsonl\.zstd$/.test(f))
  const file = v3 || v0
  if (!file) continue
  let events = null
  try { events = decodeLog(fs.readFileSync(path.join(d.pp, file))) } catch (e) { /* ignore */ }
  if (!events || !events.length) continue
  const key = v3 ? 'readable-v3' : (d.legacy ? 'legacy-subagent' : 'session-v0')
  const sum = sumRollup(foldSession(events))
  const g = groups[key]
  g.sessions += 1
  g.input += sum.input; g.output += sum.output; g.cache += sum.cache; g.cost += sum.cost
}

for (const [k, g] of Object.entries(groups)) {
  g.totalTokens = g.input + g.output + g.cache
  g.cost = Math.round(g.cost)
  delete g['']
}
console.log(JSON.stringify(groups, null, 1))

const lines = []
lines.push('# Token 恢复估算（用插件自身引擎逐会话折叠）')
lines.push('')
lines.push('生成时间：' + new Date().toLocaleString('zh-CN') + '\n')
lines.push('| 分组 | 会话数 | 输入 tokens | 输出 tokens | 缓存 tokens | 总 tokens | 估算费用(¥) |')
lines.push('|---|---|---|---|---|---|---|')
for (const [k, g] of Object.entries(groups)) {
  const label = k === 'readable-v3' ? '当前可读（v3，含在 23.5B 里）' : k === 'session-v0' ? 'v0 普通会话（当前已统计到）' : '旧版子代理会话（当前无法统计）'
  lines.push('| ' + label + ' | ' + g.sessions + ' | ' + fmt(g.input) + ' | ' + fmt(g.output) + ' | ' + fmt(g.cache) + ' | ' + fmt(g.totalTokens) + ' | ' + g.cost + ' |')
}
lines.push('')
function fmt (v) { return v >= 1e8 ? (v / 1e8).toFixed(2) + ' 亿' : v >= 1e4 ? (v / 1e4).toFixed(1) + ' 万' : String(v) }
fs.writeFileSync(path.join(__dirname, 'estimate-recovery-report.md'), lines.join('\n'), 'utf8')
console.log('written: scripts/estimate-recovery-report.md')
