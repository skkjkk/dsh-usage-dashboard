// 通用 React hook。

import { React } from './react.js'

// 轮询暂停判定（纯函数，可单测）。看板每 30s 打三条请求（usage / calendar /
// records），服务端有 SWR 所以单次成本极低；但**标签页隐藏时**这些请求没有任何
// 用处（没人看），纯浪费。隐藏时暂停轮询、重新可见时立刻补一次刷新，
// 既保住「在看的时候卡片是新鲜的」，也不在后台空转（审计 F14 的次项）。
// 入参是 document 之类的对象，缺失时返回 false（不暂停），便于 SSR/测试。
export function isPollingPaused(doc) {
  return !!(doc && doc.visibilityState === 'hidden')
}

export function useTween(target, dur) {
  const [v, setV] = React.useState(0)
  const cur = React.useRef(0)
  React.useEffect(() => {
    const from = cur.current
    const to = Number(target) || 0
    if (to === 0) { cur.current = 0; setV(0); return }
    if (from === to) { setV(to); return }
    const t0 = performance.now()
    let raf = 0
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      const val = from + (to - from) * e
      cur.current = val
      setV(val)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [target, dur])
  return v
}
