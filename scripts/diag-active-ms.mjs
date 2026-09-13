// Diagnostic: does a REAL session produce type-6 generation intervals?
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { zstdDecompressSync } from 'node:zlib'
import { foldSession } from '../lib/core/rollup.js'

const MAGIC = 0xfd2fb528
function scanFrames (buf) {
  const frames = []; let off = 0
  while (off + 5 <= buf.length) {
    if (buf.readUInt32LE(off) !== MAGIC) break
    const desc = buf[off + 4]; if ((desc & 24) !== 0) break
    const fcsFlag = desc >> 6, singleSeg = (desc >> 5) & 1, checksum = (desc >> 2) & 1, dictFlag = desc & 3
    let p = off + 5; if (!singleSeg) p += 1; p += [0, 1, 2, 4][dictFlag]
    p += fcsFlag === 0 ? (singleSeg ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8
    for (;;) {
      if (p + 3 > buf.length) return { frames }
      const v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)
      if (((v >> 1) & 3) === 3) return { frames }
      p += 3 + (((v >> 1) & 3) === 1 ? 1 : v >> 3)
      if (v & 1) break
    }
    if (checksum) p += 4
    frames.push([off, p]); off = p
  }
  return { frames }
}

// pick the largest session-* v0 log under the store (most chunk events)
const STORE = path.join(os.homedir(), '.dsh', 'sessions')
let best = null
for (const proj of fs.readdirSync(STORE, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue
  const pp = path.join(STORE, proj.name)
  for (const sd of fs.readdirSync(pp, { withFileTypes: true })) {
    if (!sd.isDirectory() || !/^session-/.test(sd.name)) continue
    const dir = path.join(pp, sd.name)
    for (const f of fs.readdirSync(dir)) {
      if (!/^session\.jsonl\.zstd$/.test(f) && !/^session\.v\d+\.jsonl\.zstd$/.test(f)) continue
      const sz = fs.statSync(path.join(dir, f)).size
      if (!best || sz > best.sz) best = { file: path.join(dir, f), sz }
    }
  }
}
console.log('sample:', best.file, best.sz, 'bytes')
const buf = fs.readFileSync(best.file)
const { frames } = scanFrames(buf)
const events = []
for (const [a, b] of frames) {
  const text = zstdDecompressSync(buf.subarray(a, b)).toString('utf8')
  for (let i = 0; i < text.length; i++) {
    const nl = text.indexOf('\n', i)
    const line = nl < 0 ? text.slice(i) : text.slice(i, nl)
    i = nl < 0 ? text.length : nl
    if (!line) continue
    try { const e = JSON.parse(line); if (e.type !== 'session') events.push(e) } catch (x) {}
  }
}
const typeCount = {}
for (const e of events) typeCount[e.type] = (typeCount[e.type] || 0) + 1
console.log('event types:', JSON.stringify(typeCount))
const chunks = events.filter((e) => e.type === 'assistant/chunk')
console.log('assistant/chunk events:', chunks.length)
if (chunks.length) {
  const kinds = {}
  for (const c of chunks) { const k = c.data && c.data.chunk && c.data.chunk.type; kinds[k] = (kinds[k] || 0) + 1 }
  console.log('chunk.data.chunk.type:', JSON.stringify(kinds))
  const withTurn = chunks.filter((c) => c.data && c.data.turn !== undefined && c.data.step !== undefined).length
  console.log('chunks carrying turn+step:', withTurn, '/', chunks.length)
  const sample = chunks.find((c) => c.data && c.data.chunk && String(c.data.chunk.type).includes('delta')) || chunks[0]
  console.log('sample chunk event data keys:', JSON.stringify({ ...sample.data, chunk: sample.data && sample.data.chunk ? { ...sample.data.chunk, text: undefined, delta: undefined } : null }).slice(0, 300))
}
const r = foldSession(events)
let t6 = 0, t6closed = 0
for (const [, b] of r.buckets) for (const e of b.evts) { if (e[1] === 6) { t6++; if (typeof e[11] === 'number' && e[11] > e[0]) t6closed++ } }
console.log('folded type-6 intervals:', t6, ' closed(valid end):', t6closed)
