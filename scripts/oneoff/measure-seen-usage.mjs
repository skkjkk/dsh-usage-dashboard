#!/usr/bin/env node
// F5（审计 F11）度量脚本：`_seenUsage` 去重签名的真实体量。
//
// 背景：`_seenUsage` 是无界增长的完整签名串集合（消息身份 + 时间 + 路由 + 六元 token），
// 随磁盘 rollup 缓存整体落盘。审计 F11 建议「按时间窗淘汰」或「定长哈希」，两条都因
// 会破坏重放去重（漏计/少计成本）被拒绝。本脚本的作用是把这个决定变成**可复现的数字**：
// 拿真实会话库的缓存文件统计「签名条目数 / 字节数 / 相对 evts 明细的占比」，
// 这样「无界增长是否真的构成内存问题」不再靠猜。
//
// 用法：
//   node scripts/oneoff/measure-seen-usage.mjs [cacheDir]
// 默认 cacheDir = ~/.dsh/usage-dashboard-cache
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const cacheDir = process.argv[2] || join(homedir(), '.dsh', 'usage-dashboard-cache')
const bytes = (v) => Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v), 'utf8')
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

let files = 0
let unusable = 0
let sigEntries = 0
let sigBytes = 0
let evtsBytes = 0
let evtsEntries = 0
let fileBytes = 0
const perFile = []

let names = []
try {
  names = readdirSync(cacheDir).filter((n) => n.endsWith('.json'))
} catch (e) {
  console.error('cache dir not readable: ' + cacheDir)
  process.exit(1)
}

for (const name of names) {
  let raw = null
  try {
    raw = JSON.parse(readFileSync(join(cacheDir, name), 'utf8'))
  } catch (e) {
    unusable += 1
    continue
  }
  if (!raw || !raw.rollup) { unusable += 1; continue }
  files += 1
  const sigs = Array.isArray(raw.rollup.seenUsage) ? raw.rollup.seenUsage : []
  const sigB = bytes(sigs)
  // 对比基准：同一份 rollup 里的逐事件明细（evts，序列化格式里是 buckets[i][1][6]）——
  // 真正的存储大头。签名理应与事件数同阶且远小于 evts。
  let evtsB = 0
  let evtsN = 0
  for (const entry of raw.rollup.buckets || []) {
    const evts = entry && Array.isArray(entry[1]) ? entry[1][6] : null
    if (Array.isArray(evts)) { evtsB += bytes(evts); evtsN += evts.length }
  }
  sigEntries += sigs.length
  sigBytes += sigB
  evtsBytes += evtsB
  evtsEntries += evtsN
  fileBytes += bytes(raw)
  perFile.push({ name, sigs: sigs.length, sigBytes: sigB, evtsBytes: evtsB })
}

perFile.sort((a, b) => b.sigBytes - a.sigBytes)
const avg = (n) => (files ? n / files : 0)
console.log('cache dir : ' + cacheDir)
console.log('files     : ' + files + ' usable, ' + unusable + ' unreadable/legacy')
console.log('signatures: ' + sigEntries + ' entries, ' + kb(sigBytes) + ' (' + (sigEntries ? (sigBytes / sigEntries).toFixed(1) : '0') + ' B/entry)')
console.log('evts      : ' + evtsEntries + ' events, ' + kb(evtsBytes) + '  → seenUsage 占 evts 的 ' + (evtsBytes ? (sigBytes / evtsBytes * 100).toFixed(1) : 'n/a') + '%')
console.log('caches    : ' + kb(fileBytes) + ' total JSON, ' + kb(avg(fileBytes)) + '/session')
console.log('per-session: ' + avg(sigEntries).toFixed(1) + ' signatures, ' + kb(avg(sigBytes)) + ' (max ' + (perFile[0] ? perFile[0].sigs + ' sigs / ' + kb(perFile[0].sigBytes) : 'n/a') + ')')
console.log('top 5 by seenUsage bytes:')
for (const p of perFile.slice(0, 5)) {
  console.log('  ' + p.name + '  ' + p.sigs + ' sigs  ' + kb(p.sigBytes) + '  (evts ' + kb(p.evtsBytes) + ')')
}
// 粗略外推：按本机平均每会话签名数，给 10k 会话量级一个数量级判断
if (files) {
  console.log('extrapolation: 10k sessions ≈ ' + kb(avg(sigBytes) * 10000) + ' of signatures (in-memory strings)')
}
