// End-to-end check of the new loader against the REAL session store:
//   run 1: walk → load every normal session → fold → serve (cache is cold)
//   run 2: fresh apply() → cache adoption → same totals, near-zero decoding
// Read-only against the store; writes only the plugin's own cache directory.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { zstdDecompressSync } from 'node:zlib'
import { apply } from '../lib/index.js'

const STORE = process.argv[2] || path.join(os.homedir(), '.dsh', 'sessions')
const MAGIC = 0xfd2fb528

// --- tolerant multi-frame zstd JSONL reader (stands in for DSH's
//     requireStoredLog, which performs the same decode + format migration) ---
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
      if (((v >> 1) & 3) === 3) return { frames }
      p += 3 + (((v >> 1) & 3) === 1 ? 1 : v >> 3)
      if (v & 1) break
    }
    if (checksum) p += 4
    frames.push([off, p])
    off = p
  }
  return { frames }
}

function readStoredLog (dir) {
  const files = fs.readdirSync(dir)
  const file = files.find((f) => /^session\.v\d+\.jsonl\.zstd$/.test(f)) ||
    files.find((f) => /^session\.v\d+\.jsonl$/.test(f)) ||
    files.find((f) => f === 'session.jsonl.zstd') ||
    files.find((f) => f === 'session.jsonl')
  if (!file) throw new Error('no log file')
  const buf = fs.readFileSync(path.join(dir, file))
  const { frames } = scanFrames(buf)
  if (!frames.length) throw new Error('no frames')
  let header = null
  const events = []
  for (const [a, b] of frames) {
    const text = zstdDecompressSync(buf.subarray(a, b)).toString('utf8')
    for (let i = 0; i < text.length; i++) {
      const nl = text.indexOf('\n', i)
      const line = nl < 0 ? text.slice(i) : text.slice(i, nl)
      i = nl < 0 ? text.length : nl
      if (!line) continue
      try {
        const parsed = JSON.parse(line)
        if (!header && parsed.type === 'session') header = parsed
        else events.push(parsed)
      } catch (e) { /* tolerant skip */ }
    }
  }
  if (!header) throw new Error('no header')
  return { meta: header, events }
}

function makeCtx () {
  const routes = new Map()
  const ctx = {
    get(name) {
      if (name === 'webServer') return { register(d) { routes.set(d.path, d.handler) } }
      if (name === 'sessionPersistence') {
        return {
          root: STORE,
          async requireStoredLog(id) {
            const dir = findSessionDir(id)
            if (!dir) throw new Error('not found: ' + id)
            return readStoredLog(dir)
          }
        }
      }
      if (name === 'sessionQuery') {
        return { async listSessions() { throw new Error('fallback must not be used when the walk works') } }
      }
      return null
    },
    on() {},
    effect(fn) { return fn() || (() => {}) }
  }
  return { ctx, routes }
}

function findSessionDir(id) {
  for (const proj of fs.readdirSync(STORE, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue
    const dir = path.join(STORE, proj.name, id)
    if (fs.existsSync(dir)) return dir
  }
  return null
}

async function request(routes, url) {
  const handler = routes.get(url.split('?')[0])
  let status = 0
  let body = ''
  await handler({ url }, {
    writeHead(c) { status = c },
    end(v) { body = String(v || '') }
  })
  if (status !== 200) throw new Error('route failed ' + status + ': ' + body.slice(0, 200))
  return JSON.parse(body)
}

async function runOnce(label) {
  const { ctx, routes } = makeCtx()
  apply(ctx, { debugCache: true })
  const t0 = Date.now()
  const usage = await request(routes, '/dash-api/usage?range=custom&from=0&to=' + Date.now())
  const elapsed = Date.now() - t0
  const t = usage.totals
  console.log(`[${label}] first complete response: ${elapsed} ms`)
  console.log(`  sessions=${t.sessions} totalTokens=${(t.totalTokens / 1e8).toFixed(2)}亿 activeMs=${(t.activeMs / 60000).toFixed(0)}min cost=¥${t.cost.toFixed(0)}`)
  // second request should be a cache hit (ms)
  const t1 = Date.now()
  await request(routes, '/dash-api/usage?range=custom&from=0&to=' + Date.now())
  console.log(`[${label}] second request (SWR hit): ${Date.now() - t1} ms`)
  return { sessions: t.sessions, tokens: t.totalTokens, cost: t.cost }
}

const run1 = await runOnce('run1 cold (walk + load + fold + cache write)')
const cacheDir = path.join(path.dirname(STORE), 'usage-dashboard-cache')
let cacheFiles = 0
try { cacheFiles = fs.readdirSync(cacheDir).length } catch (e) {}
console.log(`cache entries written: ${cacheFiles}`)
const run2 = await runOnce('run2 warm (cache adoption)')
if (run1.sessions !== run2.sessions || Math.abs(run1.tokens - run2.tokens) > 1) {
  throw new Error(`run mismatch: ${JSON.stringify(run1)} vs ${JSON.stringify(run2)}`)
}
console.log('e2e check passed ✔')
