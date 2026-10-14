// 客户端入口。宿主 client runtime 通过 window.__ModuleLoader__ 加载本 bundle，
// 读取 exports.inject / exports.apply；构建产物是单个自包含文件（scripts/regenerate.cjs
// 用 esbuild 打包，不再做正则改写）。
import { injectStyles } from './css.js'
import { Dashboard } from './dashboard.js'
import { installDashboardNavIcon } from './nav-icon.js'
import { h } from './react.js'

// 只依赖 slots：客户端不使用 timer 服务（轮询用 setInterval），
// 声明它会让缺少 timer 插件的宿主整块不挂载看板（审计 F17）。
export const inject = ['slots']

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  ctx.effect(() => injectStyles(), 'usage-dashboard: styles')
  ctx.effect(() => installDashboardNavIcon(), 'usage-dashboard: settings icon')
  // 注意：`register({` 必须同行——super-injector 注入前预检按
  // register\(\{[\s\S]*?name:['"]slot 匹配合法 slot 名，换行会被误判为坏骨架。
  slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'dashboard', order: 30, label: () => '数据看板' },
    () => h(Dashboard, null)
  ))
}
