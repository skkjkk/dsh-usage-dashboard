// 磁盘缓存文件权限收紧（剩余任务 F3）的可单测半边。
//
// 真实的权限变化（0644 → 0600）由 scripts/smoke-host.mjs 在 POSIX 上用 stat 端到端
// 断言；这里钉住「调用本身」——在 Windows 上 chmod 基本是 no-op、smoke 的模式断言
// 会被跳过，如果只靠 smoke，把 chmod 整段删掉也不会有任何用例失败。
import test from 'node:test'
import assert from 'node:assert/strict'

import { tightenJsonFileModes } from '../src/core/cache-perms.js'

const fakeFsp = (failOn = []) => {
  const calls = []
  return {
    calls,
    async chmod(file, mode) {
      calls.push([file, mode])
      if (failOn.includes(file)) throw new Error('EPERM: not POSIX')
    }
  }
}

test('tightenJsonFileModes: 每个 .json 都按 0600 chmod，且返回收紧计数', async () => {
  const fsp = fakeFsp()
  const files = ['/c/a.json', '/c/b.json']
  assert.equal(await tightenJsonFileModes(fsp, files), 2)
  assert.deepEqual(fsp.calls, [['/c/a.json', 0o600], ['/c/b.json', 0o600]])
  // 显式指定 mode 时按传入值调用（默认值语义可覆盖）
  const fsp2 = fakeFsp()
  await tightenJsonFileModes(fsp2, ['/c/a.json'], 0o400)
  assert.deepEqual(fsp2.calls, [['/c/a.json', 0o400]])
})

test('tightenJsonFileModes: 非 .json 与非字符串项被跳过（不误改目录里的其它文件）', async () => {
  const fsp = fakeFsp()
  const n = await tightenJsonFileModes(fsp, ['/c/notes.txt', '/c/.a.tmp', null, undefined, 42, '/c/ok.json'])
  assert.equal(n, 1, '只有 /c/ok.json 该被 chmod')
  assert.deepEqual(fsp.calls, [['/c/ok.json', 0o600]])
})

test('tightenJsonFileModes: 单个文件失败不影响其余文件，也不抛出', async () => {
  const fsp = fakeFsp(['/c/bad.json'])
  const n = await tightenJsonFileModes(fsp, ['/c/bad.json', '/c/good.json'])
  assert.equal(n, 1, '失败的不计数，成功的照常收紧')
  assert.deepEqual(fsp.calls.map((c) => c[0]), ['/c/bad.json', '/c/good.json'])
})

test('tightenJsonFileModes: 非数组输入安全返回 0', async () => {
  const fsp = fakeFsp()
  assert.equal(await tightenJsonFileModes(fsp, null), 0)
  assert.equal(await tightenJsonFileModes(fsp, undefined), 0)
  assert.equal(fsp.calls.length, 0)
})
