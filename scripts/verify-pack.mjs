// dsh-usage-dashboard — npm 包内容自检（发布前验证「别人安装后能正常使用」）。
//
// Usage: node scripts/verify-pack.mjs <extracted-package-dir>
//   * lib/index.js 可被 ESM import（导出 apply/inject，无顶层副作用）
//   * lib/core/rollup.js 可被 import（priceFor/foldSession/queryUsage 可用）
//   * lib/client.js 语法合法（UMD，浏览器环境才执行）
//   * 必需文件齐全（pricing CSV、cordis.patch.yml、package.json files 字段）
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node scripts/verify-pack.mjs <extracted-package-dir>')
  process.exit(2)
}
const ok = (msg) => console.log('  ✔ ' + msg)
const fail = (msg) => { console.error('  ✘ ' + msg); process.exitCode = 1 }

// 1) 必需文件（pricing CSV 为构建期源文件，运行时只用生成的 lib/core/pricing.js，不随包发布）
for (const f of ['package.json', 'lib/index.js', 'lib/client.js', 'lib/core/rollup.js', 'lib/core/pricing.js', 'cordis.patch.yml']) {
  if (existsSync(join(dir, f))) ok('contains ' + f)
  else fail('MISSING ' + f)
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

// 4) client bundle 语法
try {
  new Function(readFileSync(join(dir, 'lib/client.js'), 'utf8'))
  ok('client bundle syntax valid')
} catch (e) {
  fail('client bundle syntax error: ' + e.message)
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
const scan = (p) => {
  for (const e of readdirSync(p)) {
    const fp = join(p, e)
    if (statSync(fp).isDirectory()) { scan(fp); continue }
    if (/\.(js|cjs|mjs|json|yml|md|txt|csv)$/.test(e)) {
      try {
        const s = readFileSync(fp, 'utf8')
        if (/gho_|ghp_|1764495524|王凯彪/.test(s)) fail('possible personal data in ' + fp.replace(dir, ''))
      } catch { /* binary */ }
    }
  }
}
scan(dir)
console.log(process.exitCode ? '\npack verification FAILED ✘' : '\npack verification passed ✔')
