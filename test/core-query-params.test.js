// 查询参数解析 + 缓存键归一（剩余任务 D2）。
// 这些纯函数以前藏在 src/host.js / scripts/regenerate.cjs 的宿主模板里，只能靠
// smoke 端到端测；现在直接断言契约（以及它们各自对应的 tripwire）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseListParam,
  parseQueryArgs,
  isLoopbackAddress,
  normalizeUsageArgs,
  normalizeDetailArgs,
  normalizeCalendarArgs,
  normalizeExportArgs,
  cacheKey
} from '../src/core/query-params.js'

test('parseListParam: JSON 数组优先，逗号列表兜底（旧书签仍可用）', () => {
  assert.deepEqual(parseListParam('["a","b"]'), ['a', 'b'])
  assert.deepEqual(parseListParam('["D:/x,y"]'), ['D:/x,y'], '含逗号的 cwd 保持单元素')
  assert.deepEqual(parseListParam('["a","",null,7]'), ['a'], '只保留非空字符串')
  assert.deepEqual(parseListParam('[]'), [])

  // 非 JSON 数组 → 退回逗号拼接（旧链接）
  assert.deepEqual(parseListParam('a,b'), ['a', 'b'])
  assert.deepEqual(parseListParam('D:/x,y'), ['D:/x', 'y'], '逗号格式下 cwd 一定会被拆开——这正是 F14 的问题')
  assert.deepEqual(parseListParam('a,,b'), ['a', 'b'], '空项被丢弃')
  assert.deepEqual(parseListParam('{"a":1}'), ['{"a":1}'], 'JSON 但不是数组 → 走逗号分支')

  assert.equal(parseListParam(''), null)
  assert.equal(parseListParam(null), null)
  assert.equal(parseListParam(undefined), null)
})

test('parseQueryArgs: 数字只在「原样往返」时转数字，空值归 null', () => {
  const args = parseQueryArgs('/dash-api/usage?range=7d&from=1791907200000&limit=20.5&k=1e3&models=%5B%22a%22%5D&projects=D%3A%2Fx%2Cy&empty=')
  assert.equal(args.range, '7d')
  assert.equal(args.gran, undefined)
  assert.equal(args.from, 1791907200000)
  assert.equal(args.limit, 20.5)
  assert.equal(args.k, '1e3', '写法与 Number 回显不一致的值保持字符串（String(Number(v)) !== v）')
  assert.deepEqual(args.models, ['a'])
  assert.deepEqual(args.projects, ['D:/x', 'y'])
  assert.equal(args.empty, null)

  // 原型污染键必须被丢弃
  const evil = parseQueryArgs('/dash-api/usage?__proto__=x&constructor=y&prototype=z&range=today')
  assert.equal(Object.prototype.hasOwnProperty.call(evil, '__proto__'), false)
  assert.equal(evil.constructor, Object, 'constructor 键不得被覆盖成字符串')
  assert.equal(evil.range, 'today')

  // 相对 URL（无 host）也要能解析
  assert.deepEqual(parseQueryArgs('/dash-api/calendar?now=123'), { now: 123 })
})

test('isLoopbackAddress: 只认 loopback（IPv4 / IPv6 / IPv4-mapped / 整个 127/8）', () => {
  for (const addr of ['127.0.0.1', '127.0.0.53', '127.255.255.255', '::1', '0:0:0:0:0:0:0:1', '::ffff:127.0.0.1']) {
    assert.equal(isLoopbackAddress(addr), true, addr + ' 应判为 loopback')
  }
  for (const addr of ['192.168.1.5', '10.0.0.1', '8.8.8.8', '::ffff:10.0.0.1', '::ffff:192.168.0.1', 'fe80::1', '', 'not-an-ip']) {
    assert.equal(isLoopbackAddress(addr), false, addr + ' 不应判为 loopback')
  }
  // 非字符串（socket 可能没有 remoteAddress）
  assert.equal(isLoopbackAddress(null), false)
  assert.equal(isLoopbackAddress(undefined), false)
  assert.equal(isLoopbackAddress(12345), false)
})

test('normalize*Args: 默认值、null 语义与钳制', () => {
  assert.deepEqual(normalizeUsageArgs(), {
    range: 'today', from: null, to: null, models: null, projects: null, now: null
  })
  assert.deepEqual(normalizeUsageArgs({ range: '', now: '123' }), {
    range: 'today', from: null, to: null, models: null, projects: null, now: null
  }, 'now 只接受数字')
  assert.deepEqual(normalizeUsageArgs({ now: 0 }).now, 0, '0 是合法数字')
  // 字段顺序即缓存 key 的 JSON 顺序，不能随手调换
  assert.equal(JSON.stringify(Object.keys(normalizeUsageArgs())), '["range","from","to","models","projects","now"]')

  const d = normalizeDetailArgs({ offset: -5, limit: 9999 })
  assert.equal(d.offset, 0)
  assert.equal(d.limit, 200, 'limit 上限 200')
  assert.equal(normalizeDetailArgs({ limit: -5 }).limit, 1, '负数钳到 1')
  assert.equal(normalizeDetailArgs({ limit: 0 }).limit, 100, '0 视为缺失 → 默认 100')
  assert.equal(normalizeDetailArgs({ offset: '30' }).offset, 30)
  assert.equal(normalizeDetailArgs({ limit: 'abc' }).limit, 100)
  assert.equal(JSON.stringify(Object.keys(d)), '["range","from","to","models","projects","offset","limit"]')

  assert.deepEqual(normalizeCalendarArgs({ models: ['m'] }), { models: ['m'], projects: null, now: null })
  assert.equal(normalizeExportArgs({}).range, '30d', '导出默认 30d，与其它端点不同')
  assert.equal(normalizeExportArgs({ range: '7d' }).range, '7d')
  assert.equal('offset' in normalizeExportArgs({ offset: 5 }), false, '导出不认 offset/limit')
})

test('cacheKey: 必须带路由前缀（F6），且只由归一后的参数决定', () => {
  const norm = { range: 'today', from: null, to: null, models: null, projects: null, now: null }
  assert.equal(cacheKey('usage', norm), 'usage|' + JSON.stringify(norm))
  // 同形参数在不同端点必须得到不同 key，否则互相命中并返回错误结构
  const keys = ['usage', 'detail', 'calendar', 'export'].map((r) => cacheKey(r, norm))
  assert.equal(new Set(keys).size, 4)
  // 稳定性：同一对象两次调用一致
  assert.equal(cacheKey('usage', norm), cacheKey('usage', norm))
  // 未知参数不参与（归一后就不存在）
  assert.equal(cacheKey('usage', normalizeUsageArgs({ junk: 1 })), cacheKey('usage', normalizeUsageArgs({ junk: 2 })))
  // 真实参数变化会改变 key
  assert.notEqual(cacheKey('usage', normalizeUsageArgs({ range: '7d' })), cacheKey('usage', normalizeUsageArgs({ range: '30d' })))
})
