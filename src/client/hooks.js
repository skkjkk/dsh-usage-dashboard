// 通用 React hook。

import { React } from './react.js'

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
