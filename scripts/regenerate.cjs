// 生成 dsh-usage-dashboard 正式插件包：从 src/ 适配为 lib/
// - src/host.js        → lib/index.js      （ESM host bundle）
// - src/client.js      → lib/client.js     （UMD client bundle）
// - src/core/rollup.js → lib/core/rollup.js（纯聚合引擎，host 内部引用）
// 用法：node scripts/regenerate.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'lib')
fs.mkdirSync(path.join(outDir, 'core'), { recursive: true })

const PACKAGE_ID = '@skkjkk/dsh-usage-dashboard'

// ---------- core ----------
const coreSrc = fs.readFileSync(path.join(root, 'src', 'core', 'rollup.js'), 'utf8')
fs.writeFileSync(path.join(outDir, 'core', 'rollup.js'), coreSrc)
console.log('core lib/core/rollup.js:', coreSrc.length, 'bytes')

// ---------- host ----------
const hostSrc = fs.readFileSync(path.join(root, 'src', 'host.js'), 'utf8')
const marker = 'export function apply(ctx, config) {'
const start = hostSrc.indexOf(marker)
if (start < 0) throw new Error('host marker not found: ' + marker)
const bodyStart = start + marker.length
// body = everything up to the apply function's own closing brace
// (lastIndexOf('}') — the file's final top-level closing brace)
let body = hostSrc.slice(bodyStart, hostSrc.lastIndexOf('}'))
// 只清理尾部空白行（v0.2 host 直接以 export function apply 定义，
// 函数体内嵌套的闭合括号必须原样保留）
body = body.replace(/\n\s*\n\s*$/, '\n')

const hostOut = `// dsh-usage-dashboard — host half (adapted from the src/host.js glue layer).
// Registers three JSON GET routes under /dash-api/* serving usage aggregation
// over the local session store. Aggregation itself lives in ./core/rollup.js.

import { foldSession, queryUsage, queryDetail, queryCalendar, sessionTitle } from './core/rollup.js'

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
        res.end(JSON.stringify({ error: String((e && e.message) || e) }))
      }
    }
  }), 'usage-dashboard: ' + pathname)
}

export function apply(ctx, config) {
  // 与 cordis-host-runner 动态插件沙盒同构的桥：handle(method, fn) → GET /dash-api/<method>
  const harness = { handle: (method, fn) => registerJsonRoute(ctx, '/dash-api/' + method, fn) }
${body}
}

export const inject = ["webServer", "sessionQuery", "sessionPersistence", "workspaceRegistry", "timer"]
`

fs.writeFileSync(path.join(outDir, 'index.js'), hostOut)
console.log('host lib/index.js:', hostOut.length, 'bytes')

// ---------- client ----------
const clientSrc = fs.readFileSync(path.join(root, 'src', 'client.js'), 'utf8')
let c = clientSrc
  // ctx.interval → 标准 setInterval（bundle client 无 interval）
  .replace('ctx.interval(() => load(), 60000)', 'setInterval(() => load(), 60000)')
  .replace('const off = ctx.interval(() => load(), 60000)', 'const off = setInterval(() => load(), 60000)')
  .replace('return () => { off() }', 'return () => { clearInterval(off) }')
  // styles.insert(CSS) 是原型遗留：dsh 没有 styles 服务，改为向 document.head 注入 <style> 标签
  .replace(
    "ctx.effect(() => styles.insert(CSS))",
    `ctx.effect(() => {
        const tagId = ${JSON.stringify(PACKAGE_ID + '/dashboard.module.css')};
        if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
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

// ---------- package.json ----------
const pkg = {
  name: PACKAGE_ID,
  description: 'DSH usage statistics dashboard: token / cost / duration / session aggregation with trend, heatmap and calendar views (settings.section "数据看板").',
  version: '0.2.0',
  type: 'module',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './package.json': './package.json'
  },
  scripts: {
    build: 'node scripts/regenerate.cjs',
    bench: 'node scripts/bench.js'
  },
  dsh: {
    bundle: {
      patch: './cordis.patch.yml'
    },
    client: {
      inject: [
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-ui-settings'
      ],
      platform: 'web'
    }
  },
  peerDependencies: {
    '@deepseek-ai/dsh-client-connection': '^0.1.0-rc.6',
    '@deepseek-ai/dsh-client-runtime': '^0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-settings': '^0.1.0-rc.6',
    react: '^18.2.0'
  },
  files: ['lib'],
  license: 'Apache-2.0'
}
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
console.log('package.json written (v0.2.0)')

// 语法冒烟：host 与 core 用 node --check（ESM 需 .mjs 或 --input-type），检查文件放系统临时目录
const checks = [
  [path.join(outDir, 'index.js'), '.mjs'],
  [path.join(outDir, 'core', 'rollup.js'), '.mjs'],
  [path.join(outDir, 'client.js'), '.js']
]
for (const [src, ext] of checks) {
  const tmp = path.join(os.tmpdir(), '.tmp-check-' + process.pid + '-' + path.basename(src).replace(/[^\w.-]/g, '_') + ext)
  fs.writeFileSync(tmp, fs.readFileSync(src))
  console.log('check file written:', tmp)
}
