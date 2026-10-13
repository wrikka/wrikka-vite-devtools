import { describe, type ElementInfo } from './frameworks'

export interface PickHandle {
  stop(): void
}

/**
 * Hover-and-click element picker. The highlight lives in `hostRoot` (a shadow
 * root with pointer-events:none), so `document.elementFromPoint` still sees the app.
 */
export function startPick(opts: {
  hostRoot: ShadowRoot
  onPick: (target: HTMLElement, info: ElementInfo) => void
  onCancel: () => void
}): PickHandle {
  const box = document.createElement('div')
  box.className = 'pick'
  const tip = document.createElement('div')
  tip.className = 'pick-tip'
  opts.hostRoot.append(box, tip)

  let target: Element | null = null

  function place(el: Element): void {
    const r = el.getBoundingClientRect()
    box.style.left = `${r.left + window.scrollX}px`
    box.style.top = `${r.top + window.scrollY}px`
    box.style.width = `${r.width}px`
    box.style.height = `${r.height}px`
    tip.style.left = `${Math.min(r.left + window.scrollX, window.innerWidth - 220)}px`
    tip.style.top = `${Math.max(r.top + window.scrollY - 24, 4)}px`
    tip.textContent = `${el.tagName.toLowerCase()} — click to select, Esc to cancel`
  }

  function onMove(e: MouseEvent): void {
    const under = document.elementFromPoint(e.clientX, e.clientY)
    if (under && under.tagName !== 'HTML') {
      target = under
      place(under)
      tip.style.display = ''
      box.style.display = ''
    }
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const under = (target ?? document.elementFromPoint(e.clientX, e.clientY)) as HTMLElement | null
    stop()
    if (under && under.tagName !== 'HTML') opts.onPick(under, describe(under))
    else opts.onCancel()
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      stop()
      opts.onCancel()
    }
  }

  function stop(): void {
    window.removeEventListener('mousemove', onMove, true)
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('keydown', onKey, true)
    box.remove()
    tip.remove()
  }

  window.addEventListener('mousemove', onMove, true)
  window.addEventListener('click', onClick, true)
  window.addEventListener('keydown', onKey, true)
  return { stop }
}
