import type { Tone } from '../ui/bits'

export function statusTone(status: number): Tone {
  if (status === 0) return 'bad'
  if (status >= 500) return 'bad'
  if (status >= 400) return 'warn'
  return 'ok'
}

/** Path + query for display; the full URL stays in the tooltip. */
export function shortUrl(url: string): string {
  try {
    const parsed = new URL(url, location.origin)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}
