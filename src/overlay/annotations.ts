import { el } from './dom'
import type { Comment } from './api'

interface Pin {
  comment: Comment
  target: Element
  node: HTMLElement
}

export interface AnnotationsHandle {
  refresh(items: Comment[]): void
  toggle(): boolean
}

function samePage(page: string): boolean {
  try {
    const a = new URL(page, location.href)
    return a.origin === location.origin && a.pathname === location.pathname && a.search === location.search
  } catch {
    return false
  }
}

function findTarget(cssPath: string | undefined): Element | undefined {
  if (!cssPath) return undefined
  try {
    return document.querySelector(cssPath) ?? undefined
  } catch {
    return undefined
  }
}

/** Anchored numbered pins for comments on this page; click a pin for its bubble. */
export function openAnnotations(root: ShadowRoot): AnnotationsHandle {
  const layer = el('div', { class: 'pin-layer' })
  root.append(layer)
  let pins: Pin[] = []
  let bubble: HTMLElement | undefined
  let visible = true
  let frame = 0

  addEventListener('scroll', reposition, { capture: true, passive: true })
  addEventListener('resize', reposition)

  function refresh(items: Comment[]): void {
    const onPage = items
      .filter((c) => samePage(c.page) && c.selection.cssPath && c.selection.mode !== 'page')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const sig = onPage.map((c) => `${c.id}:${c.status}:${c.body.length}`).join('|')
    if (sig === pins.map((p) => `${p.comment.id}:${p.comment.status}:${p.comment.body.length}`).join('|')) {
      reposition()
      return
    }
    // keep any open bubble alive across status-driven rebuilds
    pins = onPage.flatMap((c, i) => {
      const target = findTarget(c.selection.cssPath)
      if (!target) return []
      const node = el('button', { class: 'pin', title: c.body, 'aria-label': `comment ${i + 1}` }, [String(i + 1)])
      node.addEventListener('click', () => showBubble(c, target))
      layer.append(node)
      return [{ comment: c, target, node }]
    })
    layer.replaceChildren(...pins.map((p) => p.node))
    reposition()
  }

  function reposition(): void {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      for (const p of pins) {
        const r = p.target.getBoundingClientRect()
        const hidden = !visible || (r.width === 0 && r.height === 0)
        p.node.hidden = hidden
        p.node.style.left = `${Math.min(Math.max(r.left + 6, 6), innerWidth - 26)}px`
        p.node.style.top = `${Math.min(Math.max(r.top + 6, 6), innerHeight - 26)}px`
      }
      if (bubble && bubbleTarget) placeBubble(bubble, bubbleTarget)
    })
  }

  let bubbleTarget: Element | undefined

  function showBubble(c: Comment, target: Element): void {
    if (bubbleTarget === target && bubble) {
      bubble.remove()
      bubble = undefined
      bubbleTarget = undefined
      return
    }
    bubbleTarget = target
    bubble?.remove()
    const close = el('button', { class: 'close' }, ['✕'])
    close.addEventListener('click', () => {
      bubble?.remove()
      bubble = undefined
      bubbleTarget = undefined
    })
    bubble = el('div', { class: 'bubble', role: 'status' }, [
      close,
      el('span', { class: `status ${c.status}` }, [c.status]),
      el('div', {}, [c.body]),
      el('div', { class: 'hint' }, [`${c.selection.mode} @ ${c.selection.cssPath}`]),
      c.resultSummary ? el('div', { class: 'hint' }, [`result: ${c.resultSummary}`]) : '',
    ])
    root.append(bubble)
    placeBubble(bubble, target)
  }

  function placeBubble(node: HTMLElement, target: Element): void {
    const r = target.getBoundingClientRect()
    const h = node.offsetHeight || 120
    const w = node.offsetWidth || 280
    const top = r.bottom + h + 16 <= innerHeight ? r.bottom + 8 : Math.max(8, r.top - h - 8)
    node.style.left = `${Math.min(Math.max(r.left, 8), innerWidth - w - 8)}px`
    node.style.top = `${Math.max(8, Math.min(top, innerHeight - h - 8))}px`
  }

  function toggle(): boolean {
    visible = !visible
    if (!visible) {
      bubble?.remove()
      bubble = undefined
      bubbleTarget = undefined
    }
    reposition()
    return visible
  }

  return { refresh, toggle }
}
