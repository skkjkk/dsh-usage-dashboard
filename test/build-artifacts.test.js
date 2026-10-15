// 构建产物契约（剩余任务 D2）：lib/ 是 src/ 的完整、可解析的副本。
//
// 背景：宿主 bundle 只抽取 `export function apply()` 的函数体，模块作用域被整体丢弃；
// 而引擎/纯函数模块是靠 import 进入 bundle 的。旧构建只复制 src/core/rollup.js，
// 于是 `rm -rf lib && npm run build` 会产出 import 悬空的 lib/core/rollup.js
// （./errors.js 只因为历史上被提交过才存在），CI 的 drift 检查也发现不了。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcCore = join(root, 'src', 'core')
const libCore = join(root, 'lib', 'core')
const jsFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.js')).sort()

test('lib/core 与 src/core 文件清单一致且逐字节相同', () => {
  const src = jsFiles(srcCore)
  const lib = jsFiles(libCore)
  assert.deepEqual(lib, src, 'lib/core 必须是 src/core 的完整副本（构建期的 readdirSync 清单）')
  for (const f of src) {
    assert.equal(
      readFileSync(join(libCore, f), 'utf8'),
      readFileSync(join(srcCore, f), 'utf8'),
      'lib/core/' + f + ' 与 src/core/' + f + ' 必须逐字节一致（改 src 后要跑 npm run build）'
    )
  }
})

test('构建脚本从目录枚举核心模块（写死文件名曾漏掉 errors.js）', () => {
  const build = readFileSync(join(root, 'scripts', 'regenerate.cjs'), 'utf8')
  assert.match(build, /readdirSync\(coreDir\)/, '核心模块清单必须来自目录枚举，而不是硬编码')
  // 复制后的相对 import 必须在构建期解析检查（否则用户机器上 import 直接抛）
  assert.match(build, /that file was not written to lib\/core\//)
})

test('lib 里所有相对 import 都能解析', () => {
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (!e.endsWith('.js')) continue
      const code = readFileSync(p, 'utf8')
      for (const m of code.matchAll(/\bfrom\s*['"](\.\.?\/[\w./-]+)['"]/g)) {
        const target = join(p, '..', m[1])
        assert.ok(existsSync(target), relative(root, p) + ' imports ' + m[1] + ' which is missing')
      }
    }
  }
  walk(join(root, 'lib'))
})

test('宿主模板不再自带已下沉的纯函数实现（避免模板与 core 漂移）', () => {
  const libIndex = readFileSync(join(root, 'lib', 'index.js'), 'utf8')
  for (const name of ['parseListParam', 'parseQueryArgs', 'isLoopbackAddress']) {
    assert.ok(
      !new RegExp('function\\s+' + name + '\\b').test(libIndex),
      name + ' 必须来自 lib/core/query-params.js，而不是宿主模板里的副本'
    )
    assert.match(libIndex, new RegExp("from\\s*'\\./core/query-params\\.js'"), '宿主必须 import query-params.js')
  }
  // 宿主主体里的 CSV/文件名/缓存权限逻辑同样只能来自 core
  assert.ok(!/function\s+csvCell\b/.test(libIndex))
  assert.ok(!/function\s+buildCsv\b/.test(libIndex))
  assert.ok(!/function\s+pickLogFile\b/.test(libIndex))
  assert.ok(!/function\s+tightenJsonFileModes\b/.test(libIndex))
  assert.match(libIndex, /from\s*'\.\/core\/csv\.js'/)
  assert.match(libIndex, /from\s*'\.\/core\/session-files\.js'/)
  assert.match(libIndex, /from\s*'\.\/core\/cache-perms\.js'/)
})
