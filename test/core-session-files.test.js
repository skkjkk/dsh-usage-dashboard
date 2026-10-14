// 会话日志文件名判定（剩余任务 D2/E1）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { pickLogFile } from '../src/core/session-files.js'

test('pickLogFile: 带版本号的日志优先于历史布局', () => {
  // 现行布局：session.v<N>.jsonl(.zstd)
  assert.equal(pickLogFile(['session.v3.jsonl.zstd', 'session.v2.jsonl']), 'session.v3.jsonl.zstd')
  assert.equal(pickLogFile(['session.v2.jsonl', 'session.v3.jsonl.zstd']), 'session.v3.jsonl.zstd', 'zstd 优先于明文')
  assert.equal(pickLogFile(['session.jsonl', 'session.v2.jsonl']), 'session.v2.jsonl', '带版本号优先于无版本号')
  assert.equal(pickLogFile(['session.jsonl.zstd', 'session.v2.jsonl']), 'session.v2.jsonl')
})

test('pickLogFile: 只认历史布局时回退到无版本号文件名', () => {
  assert.equal(pickLogFile(['session.jsonl.zstd']), 'session.jsonl.zstd')
  assert.equal(pickLogFile(['session.jsonl']), 'session.jsonl')
  assert.equal(pickLogFile(['session.jsonl.zstd', 'session.jsonl']), 'session.jsonl.zstd')
})

test('pickLogFile: 没有可读日志时返回 null（宿主据此跳过该会话）', () => {
  assert.equal(pickLogFile([]), null)
  assert.equal(pickLogFile(['notes.txt', 'session.jsonl.bak', 'session.v.jsonl']), null)
  assert.equal(pickLogFile(['Session.V2.JSONL.ZSTD']), null, '大小写敏感——避免误读非本系统命名')
})

test('pickLogFile: 同一档位多个候选时按目录项顺序取第一个（真实会话目录只会有一个）', () => {
  // 记录当前语义：readdir 顺序不定，因此这一档不做排序；DSH 的会话目录每个只落一个日志。
  assert.equal(pickLogFile(['session.v1.jsonl.zstd', 'session.v10.jsonl.zstd']), 'session.v1.jsonl.zstd')
  assert.equal(pickLogFile(['session.v10.jsonl.zstd', 'session.v1.jsonl.zstd']), 'session.v10.jsonl.zstd')
})
