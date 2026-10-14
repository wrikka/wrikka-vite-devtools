import type { Comment } from '../protocol'

export function samePage(page: string): boolean {
  try {
    const a = new URL(page, location.href)
    return a.origin === location.origin && a.pathname === location.pathname && a.search === location.search
  } catch {
    return false
  }
}

export function findTarget(cssPath: string | undefined): Element | undefined {
  if (!cssPath) return undefined
  try {
    return document.querySelector(cssPath) ?? undefined
  } catch {
    return undefined
  }
}

/** Comments anchored to a real element on this page, oldest first. */
export function pagePins(items: Comment[]): Comment[] {
  return items
    .filter((c) => samePage(c.page) && c.selection.cssPath && c.selection.mode !== 'page')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
