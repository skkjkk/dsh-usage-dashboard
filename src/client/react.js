// React 由宿主 client runtime 提供（bundle 内 require('react')）。集中一次导入，
// 其余模块 `import { React, h }`，源码因此是合法 ESM，不再依赖隐式全局（审计 F16）。
import * as React from 'react'

export { React }
export const h = React.createElement
