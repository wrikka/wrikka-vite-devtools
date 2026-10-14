const KEY = 'wrikka-vite-devtools:page'

/**
 * The pill and the hub panel share the dev-server origin, but the hub drops the
 * pill's `?page=` before it reaches the dock iframe, so the link is passed
 * through storage instead.
 */
export function stashPage(url: string): void {
  try {
    localStorage.setItem(KEY, url)
  } catch {
    // storage can be blocked in embedded contexts; the url field stays manual
  }
}

export function readStashedPage(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
