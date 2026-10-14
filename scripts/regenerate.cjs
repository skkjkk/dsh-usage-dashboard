// 生成 dsh-usage-dashboard 正式插件包：从 src/ 适配为 lib/
// - src/host.js         → lib/index.js      （ESM host bundle）
// - src/client/*.js     → lib/client.js     （esbuild 打包 + __ModuleLoader__ 外壳）
// - src/core/rollup.js  → lib/core/rollup.js（纯聚合引擎，host 内部引用）
// - pricing CSV         → src/core/pricing.js + lib/core/pricing.js（计费表）
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
// 计费标准 = pricing/vibe-usage-model-pricing-extended.csv（CNY 直接定价，无需 × 7）。
// 列：模型,厂商,输入(¥/M),输出(¥/M),缓存读取(¥/M)。
// multiplier 只用于旧版 USD CSV 回退：该文件的单价是 $/M，必须 × 7 才是 ¥/M。
// 少了这一步不会报任何错，只会把历史价格整体缩到 1/7，所以它由下面的自检钉住。
function parsePricingCsv(text, multiplier) {
  const scale = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  const prices = {}
  const emptyCache = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').trim())
    if (parts.length < 5 || !parts[0]) continue
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : 0 }
    const r6 = (n) => Math.round(n * 1e6) / 1e6
    // 缓存读取价留空会被静默写成 0，而该行仍算「已匹配」——费用低估且覆盖率仍显示 100%。
    // 这里只统计并提示：空列未必等于错（部分模型确实没有独立缓存价），需要人工核价。
    if (!parts[4]) emptyCache.push(parts[0])
    prices[parts[0]] = [
      r6(num(parts[2]) * scale), r6(num(parts[3]) * scale), r6(num(parts[4]) * scale)
    ]
  }
  return { prices, emptyCache }
}
// 自检：回退分支的 ×7 是纯算术，必须在构建期就能失败，而不是等用户看到 1/7 的费用。
{
  const sample = '模型,厂商,输入($/M),输出($/M),缓存读取($/M)\ngpt-5,OpenAI,1.25,10,0.125\n'
  const scaled = parsePricingCsv(sample, 7).prices['gpt-5']
  if (scaled[0] !== 8.75 || scaled[1] !== 70 || scaled[2] !== 0.875) {
    throw new Error('legacy USD pricing must be multiplied by 7, got ' + JSON.stringify(scaled))
  }
  const direct = parsePricingCsv(sample, 1).prices['gpt-5']
  if (direct[0] !== 1.25) throw new Error('CNY pricing must not be scaled, got ' + JSON.stringify(direct))
}
function pricingSource() {
  // 优先使用 CNY 格式的 extended CSV；若不存在则回退到旧版 USD CSV（× 7）
  const extended = path.join(root, 'pricing', 'vibe-usage-model-pricing-extended.csv')
  const original = path.join(root, 'pricing', 'vibe-usage-model-pricing.csv')
  let text = null
  let csvFile = null
  let multiplier = 1
  try { text = fs.readFileSync(extended, 'utf8'); csvFile = extended; console.log('pricing csv:', csvFile, '(CNY direct)') } catch { /* next */ }
  if (!text) {
    try {
      text = fs.readFileSync(original, 'utf8')
      csvFile = original
      multiplier = 7 // legacy CSV 的单价是 USD/M tokens
      console.log('pricing csv:', csvFile, '(USD × 7)')
    } catch {}
  }
  if (!text) throw new Error('pricing CSV not found (expected pricing/vibe-usage-model-pricing-extended.csv or pricing/vibe-usage-model-pricing.csv)')
  const { prices, emptyCache } = parsePricingCsv(text, multiplier)
  const vendors = {}
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').trim())
    if (parts.length >= 2 && parts[0] && parts[1]) vendors[parts[0]] = parts[1]
  }
  const body = Object.keys(prices).sort()
    .map((k) => JSON.stringify(k) + ':[' + prices[k].join(',') + ']').join(',\n  ')
  const vbody = Object.keys(vendors).sort()
    .map((k) => JSON.stringify(k) + ':' + JSON.stringify(vendors[k])).join(',\n  ')
  const src = '// 定价与厂商表：由 scripts/regenerate.cjs 从 pricing/vibe-usage-model-pricing-extended.csv 生成（CNY 直接定价）。\n' +
    '// 请勿手改；更新定价请改 CSV 后运行 npm run build。\n' +
    'export const PRICES = {\n  ' + body + '\n}\n\n' +
    '// 模型 → 厂商（系列分组用）\n' +
    'export const VENDORS = {\n  ' + vbody + '\n}\n'
  fs.writeFileSync(path.join(root, 'src', 'core', 'pricing.js'), src)
  fs.writeFileSync(path.join(outDir, 'core', 'pricing.js'), src)
  console.log('pricing models:', Object.keys(prices).length, ' vendors:', Object.keys(vendors).length)
  if (emptyCache.length) {
    // 不是构建失败：空列可能确实没有独立缓存价。但必须可见——这些行会生成 0，
    // 而该模型仍被标为「已匹配」，缓存读取按 ¥0 计费且覆盖率不下降（审计 F23）。
    console.log('pricing warning: ' + emptyCache.length + ' row(s) have no cache-read price → generated as 0: ' + emptyCache.join(', '))
  }
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

// ---- build guard: undeclared UPPER_SNAKE_CASE constants ----
// The host bundle is assembled by extracting ONLY the body of
// `export function apply(...)` from src/host.js, so a constant declared at
// module scope there is silently dropped while its usages survive. The result
// passes `node --check` but throws ReferenceError at DSH boot. UPPER_SNAKE_CASE
// is this project's convention for module constants, so an identifier used but
// never declared is treated as a dropped declaration. Comments are stripped
// first (string-aware) so prose cannot trigger false positives.
function stripComments(src) {
  let out = ''
  let i = 0
  let str = null
  while (i < src.length) {
    const ch = src[i]
    const two = src.slice(i, i + 2)
    if (str) {
      if (ch === '\\') { out += ch + (src[i + 1] || ''); i += 2; continue }
      if (ch === str) str = null
      out += ch; i += 1; continue
    }
    if (ch === '/' && two === '//') { while (i < src.length && src[i] !== '\n') i += 1; out += '\n'; continue }
    if (ch === '/' && two === '/*') {
      i += 2
      while (i < src.length && src.slice(i, i + 2) !== '*/') i += 1
      i = Math.min(src.length, i + 2); out += ' '; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; out += ch; i += 1; continue }
    out += ch; i += 1
  }
  return out
}

function assertNoUndeclaredConstants(src, label) {
  const code = stripComments(src)
  const declared = new Set()
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Z][A-Z0-9_]*)\b/g)) declared.add(m[1])
  const used = new Set()
  for (const m of code.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) used.add(m[1])
  // uppercase JS globals / static members that are not project constants
  const builtins = new Set(['JSON', 'URL', 'NaN', 'Infinity', 'EPSILON',
    'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'MAX_VALUE', 'MIN_VALUE',
    'POSITIVE_INFINITY', 'NEGATIVE_INFINITY', 'IS_GLOBAL', 'IS_NAN', 'IS_INTEGER'])
  const missing = [...used].filter((n) => !declared.has(n) && !builtins.has(n))
  if (missing.length) {
    throw new Error(label + ': used but never declared → ' + missing.join(', ') +
      '\n  module-scope declarations above `export function apply` are dropped by the host ' +
      'body extraction — move them inside apply() so they survive into lib/index.js')
  }
  return missing
}
assertNoUndeclaredConstants(hostSrc, 'src/host.js')

// ---- build guard: 模块作用域声明被构建丢弃 ----
// 比上面的 UPPER_SNAKE 检查更彻底：不看命名风格，只要「在 apply() 之前声明、又在
// apply() 体内被引用」，构建就会把它丢掉 → DSH boot 时 ReferenceError。旧守卫只覆盖
// 「全大写且 ≥3 字符」的 const/let，`const helper = ...` 这类 camelCase 声明会静默漏检
// ——而那正是它声称要防的失效模式（审计 F18）。
function assertNoDroppedModuleDeclarations(src, bodyStartPos, closePosPos, label) {
  let importEnd = 0
  for (const m of src.matchAll(/^import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm)) {
    importEnd = Math.max(importEnd, m.index + m[0].length)
  }
  const moduleScope = stripComments(src.slice(importEnd, bodyStartPos))
  const names = new Set()
  for (const m of moduleScope.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of moduleScope.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(':').pop().split('=')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n)
    }
  }
  const bodyCode = stripComments(src.slice(bodyStartPos, closePosPos))
  const dropped = [...names].filter((n) => new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b').test(bodyCode))
  if (dropped.length) {
    throw new Error(label + ': declared at module scope but used inside apply() → ' + dropped.join(', ') +
      '\n  the host body extraction drops everything above `export function apply`; move these inside apply()')
  }
  return dropped
}
assertNoDroppedModuleDeclarations(hostSrc, bodyStart, closePos, 'src/host.js')

let body = hostSrc.slice(bodyStart, closePos)
// 只清理尾部空白行（v0.2 host 直接以 export function apply 定义，
// 函数体内嵌套的闭合括号必须原样保留）
body = body.replace(/\n\s*\n\s*$/, '\n')
// 从 src/host.js 提取 core 导入，保持宿主包与源码一致（新增导出时无需改模板）。
// 旧的兜底是一个硬编码名字列表，已经漏过 pruneRollup：正则一旦失配就会静默生成
// 缺 import 的 lib/index.js（运行时 ReferenceError）。现在改成硬失败 + 交叉校验
// 导入名确实存在于引擎导出中（审计 F19）。
const importMatch = hostSrc.match(/^import\s*\{([^}]*)\}\s*from\s*['"]\.\/core\/rollup\.js['"]/m)
if (!importMatch) {
  throw new Error('src/host.js: cannot find the `import { ... } from \'./core/rollup.js\'` line — ' +
    'the host bundle would be generated without engine imports')
}
const coreImports = importMatch[1].trim()
const engineExports = new Set()
for (const m of coreSrc.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) engineExports.add(m[1])
for (const m of coreSrc.matchAll(/^export\s*\{([^}]*)\}/gm)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop().trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) engineExports.add(name)
  }
}
const missingEngineExports = coreImports.split(',').map((s) => s.trim()).filter(Boolean).filter((n) => !engineExports.has(n))
if (missingEngineExports.length) {
  throw new Error('src/host.js imports names that src/core/rollup.js does not export: ' + missingEngineExports.join(', '))
}

const hostOut = `// dsh-usage-dashboard — host half (adapted from the src/host.js glue layer).
// Registers four JSON GET routes under /dash-api/* (usage / detail / calendar /
// export), loopback-only by default, serving usage aggregation over the local
// session store. Aggregation itself lives in ./core/rollup.js.

import { ${coreImports} } from './core/rollup.js'

// 列表参数（models / projects）的线上编码：客户端垫片写 JSON 数组，服务端
// 先按 JSON 解析，失败再退回逗号拼接。projects 的值是项目 id（即 cwd），Windows 路径
// 可以含逗号——逗号拼接会把「一个含逗号的项目」静默拆成两个不存在的项目，筛选结果变空
// 且无任何提示（审计 F14）。逗号分支保留是为了让旧链接/书签继续可用。
function parseListParam(v) {
  if (!v) return null
  // 只有形如 JSON 数组的值才尝试 JSON.parse：逗号列表必然解析失败或不是数组，
  // 都落回 split。避免为每个普通值付一次异常开销。
  if (v.charAt(0) === '[') {
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === 'string' && x !== '')
      }
    } catch (e) { /* 不是 JSON → 按逗号拼接的旧格式处理 */ }
  }
  return v.split(',').filter(Boolean)
}

function parseQueryArgs(url) {
  const u = new URL(url, 'http://dsh.local')
  const args = {}
  for (const [k, v] of u.searchParams) {
    // never let a query key shadow prototype members onto the args object
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    if (k === 'models' || k === 'projects') {
      args[k] = parseListParam(v)
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

// 只认 loopback 调用方（含 IPv4 / IPv6 / IPv4-mapped-IPv6 与整个 127.0.0.0/8）。
// 插件把自己的 HTTP 端点注册到宿主 webserver，却无法假设宿主的绑定配置：宿主一旦以
// 0.0.0.0 启动，同网段任意主机即可无凭据读到全库用量、项目 cwd 与 token（审计 F1）。
// dsh-mobile 网关会先做设备会话鉴权，但插件不应把安全押在它身上；该网关从
// 127.0.0.1 反代，因此本机手机访问不受影响。
function isLoopbackAddress(addr) {
  if (typeof addr !== 'string' || addr === '') return false
  let a = addr
  if (a.startsWith('::ffff:')) a = a.slice(7)
  if (a === '::1' || a === '0:0:0:0:0:0:0:1') return true
  const m = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/.exec(a)
  return m !== null && Number(m[1]) === 127
}

function registerJsonRoute(ctx, pathname, fn, allowNonLoopback) {
  ctx.effect(() => ctx.get('webServer').register({
    kind: 'exact',
    path: pathname,
    handler: async (req, res) => {
      if (allowNonLoopback !== true && !isLoopbackAddress(req.socket && req.socket.remoteAddress)) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'forbidden', hint: 'this endpoint only serves loopback callers' }))
        return
      }
      try {
        const data = await fn(parseQueryArgs(req.url))
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(data))
      } catch (e) {
        // 参数越界是调用方错误，不是服务端故障（审计 F29）：custom 窗口宽到超过
        // bucketSeries 的桶上限时引擎抛 RangeError，旧实现一律回 500，把可由 URL
        // 触发的输入问题报成内部错误。RangeError 的 message 由本仓库常量拼成、
        // 不含任何调用方输入，可以安全回显；其余异常仍是 500 且不回显细节。
        const badRequest = e instanceof RangeError
        res.writeHead(badRequest ? 400 : 500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(badRequest
          ? { error: 'bad_request', message: String((e && e.message) || 'invalid request') }
          : { error: 'internal_error' }))
      }
    }
  }), 'usage-dashboard: ' + pathname)
}

export function apply(ctx, config) {
  // 逃生阀：确实需要非 loopback 直连（且自担风险）时用插件配置 allowNonLoopback: true。
  const allowNonLoopback = !!(config && config.allowNonLoopback === true)
  // 与 cordis-host-runner 动态插件沙盒同构的桥：handle(method, fn) → GET /dash-api/<method>
  const harness = { handle: (method, fn) => registerJsonRoute(ctx, '/dash-api/' + method, fn, allowNonLoopback) }
${body}
}

export const inject = ["webServer", "sessionQuery", "sessionPersistence", "workspaceRegistry", "timer", "sessions"]
`

fs.writeFileSync(path.join(outDir, 'index.js'), hostOut)
assertNoUndeclaredConstants(hostOut, 'lib/index.js')
console.log('host lib/index.js:', hostOut.length, 'bytes')

// ---------- client ----------
// src/client/ 是**真正的 ESM 模块树**（合法 JS、显式 import、可 node --check、可单测），
// 这里用 esbuild 打包成一个自包含文件，再套上 DSH client runtime 要求的
// window.__ModuleLoader__.load({ id, factory }) 外壳。
// 旧实现把 src/client.js（一个「函数体片段」）用正则改写成 lib/client.js：
// 源码不是合法 JS、隐式依赖 React/host/styles 全局、替换位置一旦漂移就静默改错
// （审计 F16/F19）。现在构建只做打包，不再改写任何源码。
const esbuild = require('esbuild')
const clientDir = path.join(root, 'src', 'client')
const clientEntry = path.join(clientDir, 'index.js')

// plugin.js 的 PLUGIN_ID 必须与 package.json 的 name 一致：它决定 CSS <style> 标签的
// data-plugin-css 与 loader id。漂移会让样式清理失配，且此前完全不可见。
{
  const pluginSrc = fs.readFileSync(path.join(clientDir, 'plugin.js'), 'utf8')
  const m = /export const PLUGIN_ID = '([^']+)'/.exec(pluginSrc)
  if (!m) throw new Error('client plugin.js: PLUGIN_ID not found')
  if (m[1] !== PACKAGE_ID) {
    throw new Error('client plugin.js PLUGIN_ID (' + m[1] + ') != package.json name (' + PACKAGE_ID + ')')
  }
}

const bundle = esbuild.buildSync({
  entryPoints: [clientEntry],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  // react 由宿主 client runtime 提供：打包器保留 require('react')，由 loader 解析。
  external: ['react'],
  legalComments: 'inline',
  logLevel: 'silent'
})
const bundled = bundle.outputFiles[0].text
if (!bundled.includes("require(\"react\")") && !bundled.includes("require('react')")) {
  throw new Error('client bundle does not require("react") — the host runtime must provide it')
}

const clientOut = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PACKAGE_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundled}
    if (!Object.prototype.hasOwnProperty.call(module.exports, Symbol.toStringTag)) {
      Object.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
    }
    return module.exports;
  }
});
`

fs.writeFileSync(path.join(outDir, 'client.js'), clientOut)
console.log('client lib/client.js:', clientOut.length, 'bytes (esbuild bundle of src/client/)')

const existingPkgPath = path.join(root, 'package.json')

// ---------- package.json ----------
// 只更新构建所需的字段，保留现有 version、description、repository、private、publishConfig 及任何额外 metadata
// 合并模式：保留 existingPkg 全部字段，只覆盖/补齐构建必需的键
const pkg = {
  ...existingPkg,
  // 确保关键构建字段始终正确
  main: 'lib/index.js',
  // 只有三个真实入口。旧版把 ./usage / ./detail / ./calendar 也指向 lib/index.js，
  // 但那些能力是 HTTP 路由（/dash-api/*），不是模块导出——消费者 import 它们
  // 只会拿到 host bundle（审计 F31）。
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './package.json': './package.json'
  },
  scripts: {
    ...existingPkg.scripts,
    build: 'node scripts/regenerate.cjs',
    bench: 'node scripts/bench.js',
    'verify-pack': 'node scripts/verify-pack.mjs',
    // 发版前置门禁：bench（引擎正确性）+ smoke（host 契约）+ verify-pack（打包产物）不过不许发布
    prepublishOnly: 'npm run test && node scripts/verify-pack.mjs'
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
        // dsh-client-runtime 在 0.2.0 桌面 bundle 中已退役（被 dsh-client-modules 取代）；
        // 两个名字都保留：inject 引用图中不存在的包会被浏览器侧静默跳过（arriveGraphRow
        // 对 graphRows.get(name) === undefined 直接 continue），旧版 DSH 仍能命中 runtime。
        const toAdd = ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-modules', '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-ui-settings']
        return [...new Set([...existing, ...toAdd])]
      })(),
      platform: existingPkg.dsh?.client?.platform || 'web'
    }
  },
  peerDependencies: {
    ...existingPkg.peerDependencies,
    '@deepseek-ai/dsh-client-connection': existingPkg.peerDependencies?.['@deepseek-ai/dsh-client-connection'] || '>=0.1.0-rc.6 <0.3.0',
    '@deepseek-ai/dsh-client-modules': existingPkg.peerDependencies?.['@deepseek-ai/dsh-client-modules'] || '>=0.1.0-rc.6 <0.3.0',
    '@deepseek-ai/dsh-client-ui-settings': existingPkg.peerDependencies?.['@deepseek-ai/dsh-client-ui-settings'] || '>=0.1.0-rc.6 <0.3.0',
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
