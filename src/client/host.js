// host 桥：host.call(method, args) → GET /dash-api/<method>?<query>
export const host = {
  call: (method, args) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(args || {})) {
      if (v === null || v === undefined || v === '') continue
      // 列表参数用 JSON 编码，不能用 join(",")：projects 的值是项目 id（即 cwd），
      // Windows 路径可以含逗号，逗号拼接会把「一个含逗号的项目」静默拆成两个不存在的
      // 项目，筛选结果直接变空且没有任何提示（审计 F14）。服务端 parseListParam 先按
      // JSON 解析、失败再退回逗号，旧链接保持可用。
      if (Array.isArray(v)) { if (v.length) q.set(k, JSON.stringify(v)) }
      else q.set(k, String(v))
    }
    const qs = q.toString()
    return fetch('/dash-api/' + method + (qs ? '?' + qs : '')).then((r) => r.json())
  }
}
