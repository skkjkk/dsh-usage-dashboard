// Inspect one stored session log: event type histogram + sample shapes for
// chunk/step/message events relevant to activeMs (generation intervals).
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { resolve } from 'node:path'

const file = resolve(process.argv[2])
let raw = readFileSync(file)
const text = zstdDecompressSync(raw).toString('utf8')
const lines = text.split('\n').filter(Boolean)
const types = new Map()
const samples = {}
for (const line of lines) {
  let o
  try { o = JSON.parse(line) } catch (e) { console.log('unparse line len', line.length, line.slice(0, 120)); continue }
  // packed chunk rows may contain multiple events
  const evs = Array.isArray(o.events) ? o.events : [o]
  for (const ev of evs) {
    const t = ev.type || '?'
    types.set(t, (types.get(t) || 0) + 1)
    if (!samples[t]) samples[t] = JSON.stringify(ev).slice(0, 400)
  }
}
console.log('total lines', lines.length)
console.log('---- type histogram ----')
for (const [t, n] of [...types].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(7), t)
console.log('---- samples ----')
for (const t of ['assistant/chunk','step/start','step/end','assistant/message','user/message']) {
  if (samples[t]) console.log('\n==', t, '==\n', samples[t])
}
// chunk.type sub-histogram
let sub = new Map()
for (const line of lines) {
  let o; try { o = JSON.parse(line) } catch { continue }
  const evs = Array.isArray(o.events) ? o.events : [o]
  for (const ev of evs) {
    if (ev.type === 'assistant/chunk') {
      const ct = ev.data && ev.data.chunk && ev.data.chunk.type
      sub.set(ct, (sub.get(ct) || 0) + 1)
    }
  }
}
console.log('\n---- assistant/chunk chunk.type histogram ----')
for (const [t, n] of [...sub].sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(7), t)
// show one full assistant/chunk text-delta and one finish with its keys
for (const line of lines) {
  let o; try { o = JSON.parse(line) } catch { continue }
  const evs = Array.isArray(o.events) ? o.events : [o]
  for (const ev of evs) {
    if (ev.type === 'assistant/chunk' && ev.data && ev.data.chunk && ev.data.chunk.type === 'text-delta') {
      console.log('\n== full text-delta keys ==\n', JSON.stringify(Object.keys(ev.data)), '\nchunk keys:', JSON.stringify(Object.keys(ev.data.chunk)))
      console.log(JSON.stringify(ev).slice(0, 500))
      break
    }
  }
}
