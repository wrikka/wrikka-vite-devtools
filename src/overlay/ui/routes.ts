/** Route suggestion plumbing shared by the composer: hit shape + fallbacks. */

export interface RouteHit {
  path: string
  kind?: string
}

/** Same-origin paths already linked from the page, when the project has no route scanner. */
export function fallbackRoutes(route: string): RouteHit[] {
  const paths = new Set<string>([route])
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    try {
      const url = new URL(a.href)
      if (url.origin !== location.origin || /(^|\/)__/.test(url.pathname)) continue
      paths.add(url.pathname)
    } catch {
      /* ignore malformed hrefs */
    }
  }
  return [...paths].slice(0, 12).map((path) => ({ path }))
}

/** The current route always leads; scanner hits follow, deduped. */
export function mergeRoute(route: string, hits: RouteHit[]): RouteHit[] {
  const seen = new Set<string>()
  return [{ path: route }, ...hits].filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)))
}
