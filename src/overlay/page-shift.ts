/**
 * The chat sidebar pushes the whole page right, Lovable-style. The shift is a
 * transform on <html> so fixed-position descendants (navs, modals, the pins)
 * travel with the page; the chat panel counters it with a negative `left` and
 * stays pinned to the viewport's left edge. Everything lives in inline styles
 * on the root element, so closing restores the page exactly as it was.
 */
export const CHAT_WIDTH_PX = 400

const TRANSITION = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)'
const RESTORE_MS = 320

interface Saved {
  transform: string
  transition: string
}

let saved: Saved | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let active = false

const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

export function chatShiftActive(): boolean {
  return active
}

/** Idempotent — re-calling while open (or mid-close) just re-asserts the shift. */
export function applyChatShift(): void {
  clearTimeout(timer)
  const html = document.documentElement
  if (!saved) saved = { transform: html.style.transform, transition: html.style.transition }
  html.style.transition = reducedMotion() ? 'none' : TRANSITION
  // Reflow so the transition is armed before the transform value changes.
  void html.offsetHeight
  html.style.transform = `translateX(${CHAT_WIDTH_PX}px)`
  active = true
}

export function clearChatShift(): void {
  clearTimeout(timer)
  if (!saved) {
    active = false
    return
  }
  const html = document.documentElement
  active = false
  html.style.transform = saved.transform
  // Keep our transition until the slide home finishes, then hand the inline
  // values back exactly as they were found.
  timer = setTimeout(() => {
    if (!saved) return
    html.style.transition = saved.transition
    saved = null
  }, reducedMotion() ? 0 : RESTORE_MS)
}
