// 设置页导航图标补丁：DSH 设置壳给未知 section 用齿轮图标，这里把本 section
// 换成网格字形，dispose 时还原。

export function installDashboardNavIcon() {
  if (typeof document === 'undefined' || !document.body || typeof MutationObserver === 'undefined') return () => {}
  const patched = []
  const ns = 'http://www.w3.org/2000/svg'
  const patch = () => {
    for (const button of document.querySelectorAll('button')) {
      if ((button.textContent || '').trim() !== '数据看板') continue
      const old = button.querySelector('svg')
      if (!old || old.getAttribute('data-dd-dashboard-icon') === 'true') continue
      const svg = document.createElementNS(ns, 'svg')
      for (const [name, value] of [['width', '16'], ['height', '16'], ['viewBox', '0 0 16 16'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.4'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['data-dd-dashboard-icon', 'true']]) svg.setAttribute(name, value)
      for (const [x, y] of [[2.5, 2.5], [9, 2.5], [9, 9], [2.5, 9]]) {
        const rect = document.createElementNS(ns, 'rect')
        rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y)); rect.setAttribute('width', '4.5'); rect.setAttribute('height', '4.5'); rect.setAttribute('rx', '0.6')
        svg.appendChild(rect)
      }
      const className = old.getAttribute('class')
      if (className) svg.setAttribute('class', className)
      old.replaceWith(svg)
      patched.push({ button, old, svg })
    }
  }
  patch()
  // The observer fires for every DOM mutation while ANY chat streams.
  // Coalesce bursts into one scan per frame so patch() can never run
  // dozens of times per paint.
  let queued = 0
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = requestAnimationFrame(() => { queued = 0; patch() })
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    if (queued) cancelAnimationFrame(queued)
    for (const item of patched) if (item.svg.isConnected && item.button.contains(item.svg)) item.svg.replaceWith(item.old)
  }
}
