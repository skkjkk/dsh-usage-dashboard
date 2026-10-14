// 包标识：必须与 package.json 的 name 一致——构建期由 scripts/regenerate.cjs 断言，
// 改名后不同步即构建失败（此前是构建脚本里的字符串拼接，源码中不可见）。
export const PLUGIN_ID = '@skkjkk/dsh-usage-dashboard'
export const STYLE_TAG_ID = PLUGIN_ID + '/dashboard.module.css'
