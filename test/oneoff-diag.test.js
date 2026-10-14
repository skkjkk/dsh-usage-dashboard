// scripts/oneoff/diag-step-fields.mjs 的边界契约（剩余任务 E2 / 审计 F26）。
//
// 该脚本的 `firstFrame` 旧实现是 `for (;;)`：块头读数恒为 0 时 `v & 1` 永不成立，
// 而 p 一直 +3（越界后 `buf[p]` 是 undefined → 仍是 0）——截断/损坏的日志会让它
// **永远转下去**。现在它导出了带边界的实现，这里把「抛错而不是挂住」钉下来。
import test from 'node:test'
import assert from 'node:assert/strict'
import { zstdCompressSync } from 'node:zlib'

import { firstFrame, MAX_BLOCK_HEADERS } from '../scripts/oneoff/diag-step-fields.mjs'

test('firstFrame: 正常 zstd 帧解出原文（阳性对照，证明边界没把正常路径砍掉）', () => {
  const text = '{"type":"session","id":"x","cwd":"D:/demo"}\n{"type":"step/start","data":{}}\n'
  const frame = zstdCompressSync(Buffer.from(text, 'utf8'))
  assert.equal(firstFrame(frame), text)
})

test('firstFrame: 截断与损坏的帧必须抛错，且必须很快返回', { timeout: 5000 }, () => {
  assert.throws(() => firstFrame(Buffer.alloc(0)), /truncated zstd frame/)
  assert.throws(() => firstFrame(Buffer.from([0x28, 0xB5, 0x2F])), /truncated zstd frame/)
  assert.throws(() => firstFrame(Buffer.from('not a zstd frame at all', 'utf8')), /magic mismatch/)

  // magic 正确、其余全 0：旧实现正是在这种输入上死循环（块头 = 0 → 永不是 last block）
  const zeros = Buffer.alloc(64)
  zeros.writeUInt32LE(0xfd2fb528, 0)
  zeros[4] = 0x20 // singleSegment=1, no checksum, no dictionary
  assert.throws(() => firstFrame(zeros), /truncated zstd block header|payload runs past end/)

  // 块头声明的载荷远超文件尾
  const overrun = Buffer.alloc(16)
  overrun.writeUInt32LE(0xfd2fb528, 0)
  overrun[4] = 0x20
  overrun.writeUIntLE(2097151 << 3, 6, 3) // 最大 blockSize（21 位），last=0、type=0
  assert.throws(() => firstFrame(overrun), /payload runs past end|truncated zstd block header/)

  // 保留块类型（3）直接判死
  const reserved = Buffer.alloc(16)
  reserved.writeUInt32LE(0xfd2fb528, 0)
  reserved[4] = 0x20
  reserved.writeUIntLE(0x6, 6, 3) // blockType = 3
  assert.throws(() => firstFrame(reserved), /reserved zstd block type/)
})

test('firstFrame: 块头上界是有限值（防止「合法但超长」的帧无界扫描）', () => {
  assert.ok(Number.isInteger(MAX_BLOCK_HEADERS) && MAX_BLOCK_HEADERS > 0)
  assert.ok(MAX_BLOCK_HEADERS <= (1 << 22), '上界不该大到等于没有边界')
})
