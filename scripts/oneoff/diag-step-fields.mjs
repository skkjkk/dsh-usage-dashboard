// Check pairing fields: step/start and assistant/message on REAL v0 logs.
//
// 一次性诊断脚本（见同目录 README）。`firstFrame` 现在是**有边界**的纯函数并导出，
// 便于 node:test 直接断言「损坏/截断的日志会抛错而不是死循环」（审计 F26 / 剩余任务 E2）：
// 旧实现的 `for (;;)` 在截断文件上会让块头读数恒为 0（bit0 永不为 1）→ 永不退出。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { zstdDecompressSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const MAGIC = 0xfd2fb528
// 块头 3 字节：bit0 = last block、bit1–2 = 类型（3 为非法/保留）、其余 = 载荷长度。
// 真实会话文件远小于这个上界；它只用来把「损坏文件」变成一次明确的抛错。
export const MAX_BLOCK_HEADERS = 1 << 20

export function firstFrame (buf) {
  if (buf.length < 6) throw new Error('truncated zstd frame: only ' + buf.length + ' bytes')
  if (buf.readUInt32LE(0) !== MAGIC) throw new Error('not a zstd frame (magic mismatch)')
  const desc = buf[4]
  const fcsFlag = desc >> 6, singleSeg = (desc >> 5) & 1, checksum = (desc >> 2) & 1, dictFlag = desc & 3
  let p = 5; if (!singleSeg) p += 1; p += [0, 1, 2, 4][dictFlag]
  p += fcsFlag === 0 ? (singleSeg ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8
  let blocks = 0
  for (;;) {
    if (p + 3 > buf.length) throw new Error('truncated zstd block header at ' + p)
    if (blocks++ >= MAX_BLOCK_HEADERS) {
      throw new Error('zstd frame has more than ' + MAX_BLOCK_HEADERS + ' block headers — refusing to scan further')
    }
    const v = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)
    if (((v >> 1) & 3) === 3) throw new Error('reserved zstd block type at ' + p)
    p += 3 + (((v >> 1) & 3) === 1 ? 1 : v >> 3)
    if (p > buf.length) throw new Error('zstd block payload runs past end of file')
    if (v & 1) break
  }
  if (checksum) {
    if (p + 4 > buf.length) throw new Error('truncated zstd checksum')
    p += 4
  }
  return zstdDecompressSync(buf.subarray(0, p)).toString('utf8')
}

function run () {
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
      // 损坏文件直接跳过并说明原因，不再可能挂住整个脚本。
      let text
      try { text = firstFrame(fs.readFileSync(file)) } catch (e) {
        console.log('--- ' + sd.name.slice(0, 20) + '  SKIPPED: ' + e.message)
        continue
      }
      shown++
      if (shown > 3) break
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
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
