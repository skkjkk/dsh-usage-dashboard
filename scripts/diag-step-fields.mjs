// Check pairing fields: step/start and assistant/message on REAL v0 logs.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { zstdDecompressSync } from 'node:zlib'

const MAGIC = 0xfd2fb528
function firstFrame (buf) {
  const desc = buf[4]
  const fcsFlag = desc >> 6, singleSeg = (desc >> 5) & 1, checksum = (desc >> 2) & 1, dictFlag = desc & 3
  let p = 5; if (!singleSeg) p += 1; p += [0, 1, 2, 4][dictFlag]
  p += fcsFlag === 0 ? (singleSeg ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8
  for (;;) {
    const v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)
    p += 3 + (((v >> 1) & 3) === 1 ? 1 : v >> 3)
    if (v & 1) break
  }
  if (checksum) p += 4
  return zstdDecompressSync(buf.subarray(0, p)).toString('utf8')
}

const STORE = path.join(os.homedir(), '.dsh', 'sessions')
// sample several sessions; report field shapes of step/start + assistant/message + step/end
let shown = 0
for (const proj of fs.readdirSync(STORE, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue
  const pp = path.join(STORE, proj.name)
  for (const sd of fs.readdirSync(pp, { withFileTypes: true })) {
    if (!sd.isDirectory() || !/^session-/.test(sd.name)) continue
    const dir = path.join(pp, sd.name)
    let file = null
    for (const f of fs.readdirSync(dir)) if (/^session\.v\d+\.jsonl\.zstd$/.test(f) || f === 'session.jsonl.zstd') { file = path.join(dir, f); break }
    if (!file) continue
    const sz = fs.statSync(file).size
    if (sz < 200000 || sz > 3000000) continue
    shown++
    if (shown > 3) break
    const text = firstFrame(fs.readFileSync(file))
    const seen = { 'step/start': null, 'assistant/message': null, 'step/end': null }
    for (let i = 0; i < text.length; i++) {
      const nl = text.indexOf('\n', i)
      const line = nl < 0 ? text.slice(i) : text.slice(i, nl)
      i = nl < 0 ? text.length : nl
      let e
      try { e = JSON.parse(line) } catch (x) { continue }
      if (seen[e.type] === null && e.data) {
        seen[e.type] = { keys: Object.keys(e.data), turn: e.data.turn, step: e.data.step, time: e.time ? 'time@evt' : (e.data.time ? 'time@data' : 'NONE?') }
      }
    }
    console.log('---', sd.name.slice(0, 20))
    console.log(JSON.stringify(seen, null, 1))
  }
  if (shown > 3) break
}
