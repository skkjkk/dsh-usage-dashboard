// 生成 dsh-usage-dashboard 正式插件包：从 src/ 适配为 lib/
// - src/host.js        → lib/index.js      （ESM host bundle）
// - src/client.js      → lib/client.js     （UMD client bundle）
// - src/core/rollup.js → lib/core/rollup.js（纯聚合引擎，host 内部引用）
// - pricing CSV        → src/core/pricing.js + lib/core/pricing.js（计费表）
// 用法：node scripts/regenerate.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'lib')
fs.mkdirSync(path.join(outDir, 'core'), { recursive: true })

// 从现有 package.json 读取 name，兼容旧脚本直接运行（fallback 到硬编码值）
let existingPkg = {}
try { existingPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) } catch {}
const PACKAGE_ID = existingPkg.name || '@skkjkk/dsh-usage-dashboard'

// ---------- pricing: CSV → src/core/pricing.js + lib/core/pricing.js ----------
// 计费标准 = pricing/vibe-usage-model-pricing.csv（缺失时抛出错误，非回退本地文件）。
// 列：模型,厂商,输入($/M),输出($/M),缓存读取($/M) → [输入, 输出, 缓存] ¥/M tokens（$×7）。
function parsePricingCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  const prices = {}
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').trim())
    if (parts.length < 5 || !parts[0]) continue
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : 0 }
    const r6 = (n) => Math.round(n * 1e6) / 1e6
    prices[parts[0]] = [r6(num(parts[2]) * 7), r6(num(parts[3]) * 7), r6(num(parts[4]) * 7)]
  }
  return prices
}
function pricingSource() {
  const local = path.join(root, 'pricing', 'vibe-usage-model-pricing.csv')
  let text = null
  try { text = fs.readFileSync(local, 'utf8'); console.log('pricing csv:', local) } catch { /* next */ }
  if (!text) throw new Error('pricing CSV not found (expected pricing/vibe-usage-model-pricing.csv)')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  const prices = parsePricingCsv(text)
  const vendors = {}
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').trim())
    if (parts.length >= 2 && parts[0] && parts[1]) vendors[parts[0]] = parts[1]
  }
  const body = Object.keys(prices).sort()
    .map((k) => JSON.stringify(k) + ':[' + prices[k].join(',') + ']').join(',\n  ')
  const vbody = Object.keys(vendors).sort()
    .map((k) => JSON.stringify(k) + ':' + JSON.stringify(vendors[k])).join(',\n  ')
  const src = '// 定价与厂商表：由 scripts/regenerate.cjs 从 pricing/vibe-usage-model-pricing.csv 生成（USD × 7 → ¥/M tokens）。\n' +
    '// 请勿手改；更新定价请改 CSV 后运行 npm run build。\n' +
    'export const PRICES = {\n  ' + body + '\n}\n\n' +
    '// 模型 → 厂商（系列分组用）\n' +
    'export const VENDORS = {\n  ' + vbody + '\n}\n'
  fs.writeFileSync(path.join(root, 'src', 'core', 'pricing.js'), src)
  fs.writeFileSync(path.join(outDir, 'core', 'pricing.js'), src)
  console.log('pricing models:', Object.keys(prices).length, ' vendors:', Object.keys(vendors).length)
  return src
}
pricingSource()

// ---------- core ----------
// 幂等迁移：若 rollup.js 仍是内联 PRICES 字面量（旧版），替换为对 ./pricing.js 的 import
{
  const f = path.join(root, 'src', 'core', 'rollup.js')
  const before = fs.readFileSync(f, 'utf8')
  const after = before.replace(/^export const PRICES = .*$/m, "import { PRICES } from './pricing.js'")
  if (after !== before) {
    fs.writeFileSync(f, after)
    console.log('rollup.js: inline PRICES → import ./pricing.js')
  }
}
const coreSrc = fs.readFileSync(path.join(root, 'src', 'core', 'rollup.js'), 'utf8')
fs.writeFileSync(path.join(outDir, 'core', 'rollup.js'), coreSrc)
console.log('core lib/core/rollup.js:', coreSrc.length, 'bytes')

// ---------- host ----------
const hostSrc = fs.readFileSync(path.join(root, 'src', 'host.js'), 'utf8')
const marker = 'export function apply(ctx, config) {'
const start = hostSrc.indexOf(marker)
if (start < 0) throw new Error('host marker not found: ' + marker)
const bodyStart = start + marker.length

// Lexical brace matcher: skip strings, templates, comments and regex literals.
// This keeps host extraction stable when a regex pattern contains braces.
function regexCanStart(src, pos) {
  let i = pos - 1
  while (i >= 0 && /\s/.test(src[i])) i--
  if (i < 0) return true
  const prev = src[i]
  if ('([{,;:=!?&|+-*%^~<>'.includes(prev)) return true
  if (prev === ')') {
    // A regex can be the body of `if (x) /.../`, while `fn() / x` is division.
    let depth = 1
    let j = i - 1
    while (j >= 0 && depth > 0) {
      if (src[j] === ')') depth++
      else if (src[j] === '(') depth--
      j--
    }
    while (j >= 0 && /\s/.test(src[j])) j--
    const end = j + 1
    while (j >= 0 && /[A-Za-z0-9_$]/.test(src[j])) j--
    const word = src.slice(j + 1, end)
    if (/^(?:if|while|for|with|switch|catch)$/.test(word)) return true
  }
  const end = i + 1
  while (i >= 0 && /[A-Za-z0-9_$]/.test(src[i])) i--
  const word = src.slice(i + 1, end)
  return /^(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|do)$/.test(word)
}

// From export function apply(ctx, config) {, find the matching closing brace.
function findMatchingClosingBrace(src, start) {
  let pos = start
  let depth = 1 // 已经消耗了调用标记里的 opening `{`
  let inSingle = false
  let inDouble = false
  let inTemplate = false
  let inRegex = false
  let inRegexClass = false
  let inLineComment = false
  let inBlockComment = false

  while (pos < src.length) {
    const ch = src[pos]
    if (inBlockComment) {
      if (ch === '*' && pos + 1 < src.length && src[pos + 1] === '/') {
        inBlockComment = false
        pos += 2
        continue
      }
      pos++
      continue
    }
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      pos++
      continue
    }
    if (inTemplate) {
      if (ch === '\\' && pos + 1 < src.length) { pos += 2; continue }
      if (ch === '`') inTemplate = false
      pos++
      continue
    }
    if (inRegex) {
      if (ch === '\\' && pos + 1 < src.length) { pos += 2; continue }
      if (inRegexClass) {
        if (ch === ']') inRegexClass = false
        pos++
        continue
      }
      if (ch === '[') { inRegexClass = true; pos++; continue }
      if (ch === '/') {
        inRegex = false
        pos++
        while (pos < src.length && /[A-Za-z]/.test(src[pos])) pos++
        continue
      }
      pos++
      continue
    }
    if (inSingle) {
      if (ch === '\\' && pos + 1 < src.length) { pos += 2; continue }
      if (ch === '\'') inSingle = false
      pos++
      continue
    }
    if (inDouble) {
      if (ch === '\\' && pos + 1 < src.length) { pos += 2; continue }
      if (ch === '"') inDouble = false
      pos++
      continue
    }
    // 状态转换：进入注释、正则或字符串
    if (ch === '/' && pos + 1 < src.length) {
      if (src[pos + 1] === '*') { inBlockComment = true; pos += 2; continue }
      if (src[pos + 1] === '/') { inLineComment = true; pos += 2; continue }
      if (regexCanStart(src, pos)) { inRegex = true; pos++; continue }
    }
    if (ch === '`') { inTemplate = true; pos++; continue }
    if (ch === '\'') { inSingle = true; pos++; continue }
    if (ch === '"') { inDouble = true; pos++; continue }
    // 普通大括号计数
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return pos
    }
    pos++
  }
  return -1
}

// Keep the extractor's tricky lexical cases executable as a build-time check.
for (const sample of [
  'export function apply() { if (true) /\\{/.test("x"); return 1 }',
  'export function apply() { const x = /\\{\\/\\//; /* } */ return x }'
]) {
  const open = sample.indexOf('{', sample.indexOf('apply'))
  const close = findMatchingClosingBrace(sample, open + 1)
  if (close !== sample.lastIndexOf('}')) throw new Error('host brace matcher regression')
}

const closePos = findMatchingClosingBrace(hostSrc, bodyStart)
if (closePos < 0) throw new Error('matching closing brace not found for host apply function')
let body = hostSrc.slice(bodyStart, closePos)
// 只清理尾部空白行（v0.2 host 直接以 export function apply 定义，
// 函数体内嵌套的闭合括号必须原样保留）
body = body.replace(/\n\s*\n\s*$/, '\n')
// 从 src/host.js 提取 core 导入，保持宿主包与源码一致（新增导出时无需改模板）
const importMatch = hostSrc.match(/^import\s*\{([^}]*)\}\s*from\s*['"]\.\/core\/rollup\.js['"]/m)
const coreImports = importMatch ? importMatch[1].trim() : 'foldSession, foldAppend, emptyRollup, queryUsage, queryDetail, queryCalendar, sessionTitle'

const hostOut = `// dsh-usage-dashboard — host half (adapted from the src/host.js glue layer).
// Registers three JSON GET routes under /dash-api/* serving usage aggregation
// over the local session store. Aggregation itself lives in ./core/rollup.js.

import { ${coreImports} } from './core/rollup.js'

function parseQueryArgs(url) {
  const u = new URL(url, 'http://dsh.local')
  const args = {}
  for (const [k, v] of u.searchParams) {
    if (k === 'models' || k === 'projects') {
      args[k] = v ? v.split(',').filter(Boolean) : null
    } else if (v === '') {
      args[k] = null
    } else if (k === 'range' || k === 'gran') {
      args[k] = v
    } else {
      const n = Number(v)
      args[k] = Number.isFinite(n) && String(n) === v ? n : v
    }
  }
  return args
}

function registerJsonRoute(ctx, pathname, fn) {
  ctx.effect(() => ctx.get('webServer').register({
    kind: 'exact',
    path: pathname,
    handler: async (req, res) => {
      try {
        const data = await fn(parseQueryArgs(req.url))
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(data))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'internal_error' }))
      }
    }
  }), 'usage-dashboard: ' + pathname)
}

export function apply(ctx, config) {
  // 与 cordis-host-runner 动态插件沙盒同构的桥：handle(method, fn) → GET /dash-api/<method>
  const harness = { handle: (method, fn) => registerJsonRoute(ctx, '/dash-api/' + method, fn) }
${body}
}

export const inject = ["webServer", "sessionQuery", "sessionPersistence", "workspaceRegistry", "timer", "sessions"]
`

fs.writeFileSync(path.join(outDir, 'index.js'), hostOut)
console.log('host lib/index.js:', hostOut.length, 'bytes')

// ---------- client ----------
const clientSrc = fs.readFileSync(path.join(root, 'src', 'client.js'), 'utf8')
let c = clientSrc
  // ctx.interval → 标准 setInterval（bundle client 无 interval；正则匹配任意延迟与
  // 任意 load 调用形态，此前写死 60000 导致 30000 轮询时代换静默失效）
  .replace(/ctx\.interval\(\(\) => load\([^)]*\), (\d+)\)/g, (m, delay) => 'setInterval(() => load(true), ' + delay + ')')
  .replace('return () => { off() }', 'return () => { clearInterval(off) }')
  // styles.insert(CSS) 是原型遗留：dsh 没有 styles 服务，改为向 document.head 注入 <style> 标签
  .replace(
    "ctx.effect(() => styles.insert(CSS))",
    `ctx.effect(() => {
        const tagId = ${JSON.stringify(PACKAGE_ID + '/dashboard.module.css')};
        if (typeof document !== 'undefined') {
          const old = document.querySelectorAll('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
          for (var _i = 0; _i < old.length; _i++) old[_i].remove();
          const tag = document.createElement('style');
          tag.dataset.plugin = ${JSON.stringify(PACKAGE_ID)};
          tag.dataset.pluginCss = tagId;
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove() };
        }
      })`
  )
  // 函数体 return { inject, apply } → module.exports 赋值（嵌入 UMD factory）
  .replace(/return \{\n(\s*)inject:/, 'module.exports = {\n$1inject:')
// 保险：若上面替换失败则兜底
if (!c.includes('module.exports = {')) {
  c = c.replace('return {', 'module.exports = {', 1)
}
if (c.includes('ctx.interval(') || c.includes('styles.insert(')) {
  throw new Error('client transform left host-only API references in lib/client.js')
}
if (!c.includes('clearInterval(off)')) {
  throw new Error('client transform did not produce interval cleanup')
}
if (!c.includes('module.exports = {')) {
  throw new Error('client transform did not produce module.exports')
}

const clientOut = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PACKAGE_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    // host 桥垫片：host.call(method, args) → GET /dash-api/<method>?<query>
    const host = {
      call: (method, args) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(args || {})) {
          if (v === null || v === undefined || v === "") continue;
          if (Array.isArray(v)) { if (v.length) q.set(k, v.join(",")); }
          else q.set(k, String(v));
        }
        const qs = q.toString();
        return fetch("/dash-api/" + method + (qs ? "?" + qs : "")).then((r) => r.json());
      }
    };
${c}
    return module.exports;
  }
});
`

fs.writeFileSync(path.join(outDir, 'client.js'), clientOut)
console.log('client lib/client.js:', clientOut.length, 'bytes')

const existingPkgPath = path.join(root, 'package.json')

// ---------- package.json ----------
// 只更新构建所需的字段，保留现有 version、description、repository、private、publishConfig 及任何额外 metadata
// 合并模式：保留 existingPkg 全部字段，只覆盖/补齐构建必需的键
const pkg = {
  ...existingPkg,
  // 确保关键构建字段始终正确
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './package.json': './package.json',
    // 三个额外入口：usage、detail、calendar（在现有基础上补齐）
    './usage': './lib/index.js',
    './detail': './lib/index.js',
    './calendar': './lib/index.js'
  },
  scripts: {
    ...existingPkg.scripts,
    build: 'node scripts/regenerate.cjs',
    bench: 'node scripts/bench.js',
    prepublishOnly: 'npm run build'
  },
  dsh: {
    bundle: {
      ...existingPkg.dsh?.bundle,
      patch: './cordis.patch.yml'
    },
    client: {
      ...existingPkg.dsh?.client,
      // 仅在缺失时补全 inject/platform（避免重复）
      inject: (() => {
        const existing = existingPkg.dsh?.client?.inject || []
        const toAdd = ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-ui-settings']
        return [...new Set([...existing, ...toAdd])]
      })(),
      platform: existingPkg.dsh?.client?.platform || 'web'
    }
  },
  peerDependencies: {
    ...existingPkg.peerDependencies,
    '@deepseek-ai/dsh-client-connection': existingPkg.peerDependencies?.['@deepseek-ai/dsh-client-connection'] || '^0.1.0-rc.6',
    '@deepseek-ai/dsh-client-runtime': existingPkg.peerDependencies?.['@deepseek-ai/dsh-client-runtime'] || '^0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-settings': existingPkg.peerDependencies?.['@deepseek-ai/dsh-client-ui-settings'] || '^0.1.0-rc.6',
    react: existingPkg.peerDependencies?.react || '^18.2.0'
  },
  files: [
    ...new Set([
      ...(existingPkg.files || []).filter(f => f !== 'pricing'),
      'lib',
      'cordis.patch.yml'
    ])
  ]
}
// 保留现有版本描述等元数据，不重置版本
if (pkg.version !== undefined) pkg.version = existingPkg.version || pkg.version
if (pkg.description !== undefined) pkg.description = existingPkg.description || pkg.description
if (pkg.name === undefined) pkg.name = existingPkg.name || PACKAGE_ID
fs.writeFileSync(existingPkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('package.json written (v' + (pkg.version || 'unknown') + ')')

// 语法冒烟：host 与 core 实际执行 `node --check`，完成后删除临时文件
const { execFileSync } = require('child_process')
const checks = [
  [path.join(outDir, 'index.js'), '.mjs'],
  [path.join(outDir, 'core', 'rollup.js'), '.mjs'],
  [path.join(outDir, 'client.js'), '.js']
]
for (const [src, ext] of checks) {
  const tmp = path.join(os.tmpdir(), '.tmp-check-' + process.pid + '-' + path.basename(src).replace(/[^\w.-]/g, '_') + ext)
  fs.writeFileSync(tmp, fs.readFileSync(src))
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' })
    console.log('syntax ok:', tmp)
  } catch (e) {
    console.log('syntax check failed:', tmp, String((e && e.message) || e))
    throw e
  } finally {
    try { fs.unlinkSync(tmp) } catch {}
  }
}
