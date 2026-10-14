// dsh-usage-dashboard — npm 包内容自检（发布前验证「别人安装后能正常使用」）。
//
// Usage: node scripts/verify-pack.mjs [<extracted-package-dir>]
//   缺省校验本仓库根目录（即将要发布的内容）；也可传入 npm pack 后的解包目录。
//   * lib/index.js 可被 ESM import（导出 apply/inject，无顶层副作用）
//   * lib/core/rollup.js 可被 import（priceFor/foldSession/queryUsage 可用）
//   * lib/client.js 语法合法（UMD，浏览器环境才执行）
//   * 必需文件齐全（cordis.patch.yml、package.json files 字段）
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { Script } from 'node:vm'

const dir = resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)))
const ok = (msg) => console.log('  ✔ ' + msg)
const fail = (msg) => { console.error('  ✘ ' + msg); process.exitCode = 1 }

// 1) 必需文件（pricing CSV 为构建期源文件，运行时只用生成的 lib/core/pricing.js，不随包发布）
for (const f of ['package.json', 'lib/index.js', 'lib/client.js', 'lib/core/rollup.js', 'lib/core/pricing.js', 'lib/core/csv.js', 'lib/core/query-params.js', 'lib/core/session-files.js', 'cordis.patch.yml']) {
  if (existsSync(join(dir, f))) ok('contains ' + f)
  else fail('MISSING ' + f)
}

// 1b) lib/ 内所有相对 import 必须能解析：宿主的纯逻辑模块与引擎的 ./errors.js 都是靠
// import 进包的，缺一个文件在用户机器上就是 import 失败（构建脚本现在也会硬失败）。
try {
  let checked = 0
  const walk = (p) => {
    for (const e of readdirSync(p)) {
      const fp = join(p, e)
      if (statSync(fp).isDirectory()) { walk(fp); continue }
      if (!e.endsWith('.js')) continue
      const code = readFileSync(fp, 'utf8')
      for (const m of code.matchAll(/\bfrom\s*['"](\.\.?\/[\w./-]+)['"]/g)) {
        checked += 1
        if (!existsSync(join(fp, '..', m[1]))) fail('dangling import in ' + fp.replace(dir, '') + ' → ' + m[1])
      }
    }
  }
  walk(join(dir, 'lib'))
  ok('lib/ relative imports resolve (' + checked + ' checked)')
} catch (e) {
  fail('lib/ import scan failed: ' + e.message)
}

// 2) host bundle 可加载
try {
  const mod = await import(pathToFileURL(join(dir, 'lib/index.js')).href)
  const keys = Object.keys(mod).sort().join(',')
  if (typeof mod.apply === 'function' && Array.isArray(mod.inject)) ok('host bundle loads (exports: ' + keys + ', inject: ' + JSON.stringify(mod.inject) + ')')
  else fail('host bundle missing apply/inject')
} catch (e) {
  fail('host bundle failed to load: ' + e.message)
}

// 3) core 引擎可加载 + 定价生效
try {
  const mod = await import(pathToFileURL(join(dir, 'lib/core/rollup.js')).href)
  if (typeof mod.foldSession === 'function' && typeof mod.queryUsage === 'function') ok('core engine loads')
  const p = mod.priceFor('deepseek-v4-flash')
  if (p && p.p && p.p.length === 3) ok('pricing from CSV active (deepseek-v4-flash ¥' + p.p.join('/') + '/M)')
  else fail('priceFor failed')
} catch (e) {
  fail('core engine failed to load: ' + e.message)
}

// 4) client bundle 语法与 slot 注册契约校验（DSH client-modules 规范）
try {
  const clientCode = readFileSync(join(dir, 'lib/client.js'), 'utf8')
  // 只编译不执行（旧实现用 new Function，语义上等同 eval 且错误信息无文件名）。
  new Script(clientCode, { filename: 'lib/client.js' })
  ok('client bundle syntax valid')

  const hasSlotsService = /['"]slots['"]/.test(clientCode) && /ctx\.get\(\s*['"]slots['"]\s*\)/.test(clientCode)
  if (!hasSlotsService) fail('lib/client.js does not resolve the "slots" service')
  else ok('client resolves the slots service')

  const KNOWN_SLOTS = new Set([
    'conversation.view',
    'settings.plugin.item',
    'settings.plugins.tab',
    'settings.section',
    'settings.general.item',
    'conversation.session.header.actions',
    'conversation.session.header.utilities',
    'conversation.input.dock',
    'conversation.composer.dock',
    'sidebar.footer.action',
    'shell.overlay'
  ])

  // Real API shape: slots.inject('<slot>', () => slots.register({ name: '<slot>', ... }, render))
  const injected = [...clientCode.matchAll(/slots\.inject\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  const registered = new Set(
    [...clientCode.matchAll(/register\(\s*\{[^}]*?name:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  )

  if (injected.length === 0) fail('lib/client.js never calls slots.inject(...)')
  else ok('client calls slots.inject for: ' + injected.join(', '))

  for (const slot of injected) {
    if (!KNOWN_SLOTS.has(slot)) fail('client injects unknown slot: ' + slot)
    else if (!registered.has(slot)) fail('client injects ' + slot + ' but never registers it')
    else ok('client slot contract satisfied for ' + slot)
  }
} catch (e) {
  fail('client bundle error: ' + e.message)
}

// 5) package.json files 字段覆盖全部必要产物
try {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  for (const f of (pkg.files || [])) {
    if (existsSync(join(dir, f))) ok('package.files includes ' + f)
    else fail('package.files entry missing on disk: ' + f)
  }
} catch (e) {
  fail('package.json unreadable: ' + e.message)
}

// 6) 无个人数据残留
// Keep the built-in checks generic. Release environments may add a trusted
// project-specific pattern without removing the credential checks below.
const personalPatterns = [
  /gho_[A-Za-z0-9_]+/,
  /ghp_[A-Za-z0-9_]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}/i
]
const customPersonalPattern = process.env.DASH_PERSONAL_SCAN_PATTERN
if (customPersonalPattern) {
  try {
    personalPatterns.push(new RegExp(customPersonalPattern))
  } catch (e) {
    console.error('warning: invalid DASH_PERSONAL_SCAN_PATTERN; using default checks')
  }
}
const hasPersonalData = (text) => personalPatterns.some((pattern) => pattern.test(text))
// 缺省校验仓库根目录时必须跳过这些目录：node_modules 里几乎必然存在邮箱/令牌形态的字符串，
// 会把发布门禁变成永久红灯。
const SKIP_DIRS = new Set(['node_modules', '.git', '.audit', '.study', 'picture'])
const scan = (p) => {
  for (const e of readdirSync(p)) {
    if (SKIP_DIRS.has(e)) continue
    const fp = join(p, e)
    if (statSync(fp).isDirectory()) { scan(fp); continue }
    if (/\.(js|cjs|mjs|json|yml|md|txt|csv)$/.test(e)) {
      try {
        const s = readFileSync(fp, 'utf8')
        if (hasPersonalData(s)) fail('possible personal data in ' + fp.replace(dir, ''))
      } catch { /* binary */ }
    }
  }
}
scan(dir)
console.log(process.exitCode ? '\npack verification FAILED ✘' : '\npack verification passed ✔')
