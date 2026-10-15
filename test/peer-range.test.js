// 遗留兼容性核验 G1：peerDependencies 的 semver 预发布语义。
//
// 背景：`peerDependencies` 此前写的是 `>=0.1.0-rc.6 <0.3.0`。按 semver 规则，
// **带 prerelease 的版本只有在范围内存在「同一 [major,minor,patch] 元组且自身带
// prerelease」的比较符时才可能满足**（Range.test → testSet 的 includePrerelease 分支，
// 见 node_modules/semver/classes/range.js 与 @npmcli/arborist/lib/dep-valid.js:53
// `semver.satisfies(child.version, requested.fetchSpec, true)` —— 第三个参数是
// **loose**，并不会打开 includePrerelease）。于是那条范围实际上只匹配 0.1.x/0.2.x 的
// **稳定版**：连 npm 上当时的 `latest`（0.1.7-rc.2）与桌面端正在跑的 0.2.0-rc.1 都不匹配，
// 与 COMPAT.md 声称的支持面不一致。
//
// 结论（本文件钉住）：范围改为「已核验最老版本起、到 0.2.x 稳定版为止的稳定带」
// 并**显式列出**两条仍然分发的预发布线（0.1.7-rc.x = npm latest、0.2.0-rc.x = 桌面）。
// 其余历史预发布（0.1.5-rc.x / 0.1.6-alpha.x / 0.1.7-alpha.x）与**未来任意 0.2.x 预发布**
// 在严格 semver 下无法被任何范围表达（见下面第二条用例），只能靠 bundle 装配兜住。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import semver from 'semver'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const PEER_PACKAGES = [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-modules',
  '@deepseek-ai/dsh-client-ui-settings'
]

// COMPAT.md 时间线里 DSH 实际发布过的版本（npm dist-tags + 本机桌面 app.asar 实测）
const PUBLISHED = [
  '0.1.3-alpha.2',
  '0.1.5-alpha.1', '0.1.5-alpha.2', '0.1.5-rc.1', '0.1.5-rc.2', '0.1.5-rc.3',
  '0.1.6-alpha.1', '0.1.6-alpha.2',
  '0.1.7-alpha.1', '0.1.7-alpha.2', '0.1.7-rc.1', '0.1.7-rc.2',
  '0.2.0-rc.1', '0.2.0-rc.2'
]

test('G1: 三个 DSH peer 包声明同一范围，且 §COMPAT 的矩阵与 semver 实际一致', () => {
  const ranges = PEER_PACKAGES.map((name) => {
    const range = pkg.peerDependencies[name]
    assert.equal(typeof range, 'string', name + ' 必须有 peer 范围')
    return range
  })
  for (const range of ranges) assert.equal(range, ranges[0], '三个 peer 包必须声明同一范围（否则支持面说法无法只写一次）')
  const range = ranges[0]

  // ① 稳定带：0.1.3 起的所有稳定版（含未来 0.2.x 补丁）都匹配——这是安装面最重要的一半
  for (const v of ['0.1.3', '0.1.4', '0.1.5', '0.1.6', '0.1.7', '0.2.0', '0.2.1', '0.2.5', '0.2.99']) {
    assert.equal(semver.satisfies(v, range), true, v + ' 必须匹配 ' + range)
  }
  // ② 已核验的最老版本（COMPAT 的覆盖下限）必须在范围内，否则声明比实测支持面还窄
  assert.equal(semver.satisfies('0.1.3-alpha.2', range), true)
  // ③ 仍然分发的两条预发布线：npm latest 0.1.7-rc.x 与桌面端 0.2.0-rc.x
  for (const v of ['0.1.7-rc.1', '0.1.7-rc.2', '0.2.0-rc.1', '0.2.0-rc.2']) {
    assert.equal(semver.satisfies(v, range), true, v + ' 必须匹配（否则 npm latest / 当前桌面端会报 peer 不满足）')
  }
  // ④ 明确排除：范围外的稳定版 / 下一个 minor / 更老的版本
  for (const v of ['0.0.9', '0.1.2', '0.3.0', '0.3.0-rc.1', '0.4.0', '1.0.0']) {
    assert.equal(semver.satisfies(v, range), false, v + ' 不应匹配 ' + range)
  }
  // ⑤ 已知不匹配的历史预发布（严格 semver 无法表达，见文件头注释）：显式钉住，
  //    这样「谁把范围改宽了」或「COMPAT 措辞漂移」都会在这里失败。
  for (const v of ['0.1.5-rc.1', '0.1.5-rc.2', '0.1.5-rc.3', '0.1.6-alpha.1', '0.1.7-alpha.1']) {
    assert.equal(semver.satisfies(v, range), false, v + ' 在严格 semver 下不在范围内（历史预发布，已停止分发）')
  }
  // ⑥ 三个包的声明里都不应再出现旧范围（回归护栏）
  for (const r of ranges) assert.ok(r.indexOf('>=0.1.0-rc.6') === -1, '旧范围 >=0.1.0-rc.6 已被取代')
})

test('G1: 「任意 0.2.x 预发布」在严格 semver 下不可表达（只能靠 includePrerelease）', () => {
  // 这是 G1 原始验收条件里 `0.2.1-rc.1` 一项无法满足的原因，不是范围写法的问题：
  // 预发布版本要求范围内存在同元组且带 prerelease 的比较符，而「未来补丁号的预发布」
  // 不可能预先枚举。这里对一批候选写法做反证。
  const future = '0.2.1-rc.1'
  const candidates = [
    pkg.peerDependencies['@deepseek-ai/dsh-client-modules'],
    '>=0.1.0-rc.6 <0.3.0', // 旧声明
    '^0.1.0-rc.6 || ^0.2.0-rc.1', // 文档里建议过的显式列举
    '>=0.2.0-rc.1 <0.3.0-0',
    '0.1.x || 0.2.x',
    '*',
    '>=0 <0.3.0',
    '>=0.0.0-0'
  ]
  for (const range of candidates) {
    assert.equal(semver.satisfies(future, range), false,
      future + ' 竟被 ' + range + ' 匹配——那么上面的「不可表达」结论需要重新审查')
  }
  // 只有打开 includePrerelease 才匹配，而 peerDependencies 无法表达该选项
  assert.equal(semver.satisfies(future, pkg.peerDependencies['@deepseek-ai/dsh-client-modules'], { includePrerelease: true }), true)
  // npm 自己的 peer 校验走的是 loose 模式（第三参 true），不等于 includePrerelease：
  // 这一点决定了「不匹配 prerelease」在实际安装时确实会发生，而不是被 loose 救回来。
  assert.equal(semver.satisfies('0.2.0-rc.1', '>=0.1.0-rc.6 <0.3.0', true), false, 'loose 模式不会打开 includePrerelease')
})

test('G1: dsh.client.inject 同时保留新旧两个 client runtime 包名', () => {
  // 预发布不匹配的残留风险由装配侧兜底：0.1.x 桌面端只有 dsh-client-runtime，
  // 0.2.x 换成 dsh-client-modules；inject 引用不存在的包会被静默跳过，所以两个都声明。
  const inject = pkg.dsh?.client?.inject || []
  assert.ok(inject.includes('@deepseek-ai/dsh-client-runtime'), '旧 DSH 需要 runtime 名字')
  assert.ok(inject.includes('@deepseek-ai/dsh-client-modules'), '新 DSH 需要 modules 名字')
})
