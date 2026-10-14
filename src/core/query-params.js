// 查询参数解析与缓存键归一（纯函数：无 ctx、无 IO）。
//
// 这两件事以前藏在 scripts/regenerate.cjs 的宿主模板与 src/host.js 的 apply() 体内，
// 只能靠 smoke 端到端测（剩余任务 D2）。挪到引擎侧后，node:test 可以直接断言
// 「projects 的 JSON 编码」「loopback 判定」「缓存 key 必须带路由前缀」这些契约。

// 列表参数（models / projects）的线上编码：客户端垫片写 JSON 数组，服务端
// 先按 JSON 解析，失败再退回逗号拼接。projects 的值是项目 id（即 cwd），Windows 路径
// 可以含逗号——逗号拼接会把「一个含逗号的项目」静默拆成两个不存在的项目，筛选结果变空
// 且无任何提示（审计 F14）。逗号分支保留是为了让旧链接/书签继续可用。
export function parseListParam(v) {
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

export function parseQueryArgs(url) {
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
export function isLoopbackAddress(addr) {
  if (typeof addr !== 'string' || addr === '') return false
  let a = addr
  if (a.startsWith('::ffff:')) a = a.slice(7)
  if (a === '::1' || a === '0:0:0:0:0:0:0:1') return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a)
  return m !== null && Number(m[1]) === 127
}

// ---------- 请求参数归一（每个端点的字段集 == 查询真正读取的字段集） ----------
// 只归一 queryUsage/queryDetail/… 真正读取的字段：把整个 URL 参数铺进对象会让调用方
// 用 `?junk=1`、`?junk=2` 无限制造缓存条目，每条还要付一次全库遍历（审计 F8）。
// 字段顺序保持原样：缓存 key 是这些对象的 JSON 串。

export function normalizeUsageArgs(input) {
  const i = input || {}
  return {
    range: i.range || 'today',
    from: i.from != null ? i.from : null,
    to: i.to != null ? i.to : null,
    models: i.models != null ? i.models : null,
    projects: i.projects != null ? i.projects : null,
    now: typeof i.now === 'number' ? i.now : null
  }
}

export function normalizeDetailArgs(input) {
  const i = input || {}
  return {
    range: i.range || 'today',
    from: i.from != null ? i.from : null,
    to: i.to != null ? i.to : null,
    models: i.models != null ? i.models : null,
    projects: i.projects != null ? i.projects : null,
    offset: Math.max(0, Number(i.offset) || 0),
    limit: Math.min(200, Math.max(1, Number(i.limit) || 100))
  }
}

export function normalizeCalendarArgs(input) {
  const i = input || {}
  return {
    models: i.models != null ? i.models : null,
    projects: i.projects != null ? i.projects : null,
    now: typeof i.now === 'number' ? i.now : null
  }
}

export function normalizeExportArgs(input) {
  const i = input || {}
  return {
    range: i.range || '30d',
    from: i.from != null ? i.from : null,
    to: i.to != null ? i.to : null,
    models: i.models != null ? i.models : null,
    projects: i.projects != null ? i.projects : null
  }
}

// 缓存 key 必须带路由前缀。三个端点此前都用裸 JSON.stringify(normalized)，
// 构造同形参数即可让 usage / detail / calendar 互相命中并返回错误结构（审计 F6）。
export function cacheKey(route, normalized) {
  return route + '|' + JSON.stringify(normalized)
}
