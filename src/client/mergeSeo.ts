import type { RouteRow } from '../rpc/routes'
import type { SeoRow } from '../rpc/seo'

/**
 * Audited served html keyed by the route it belongs to.
 * Trailing slashes are ignored on both sides; routes with params have no fetchable url, so they never match.
 */
export function mergeSeo(routes: RouteRow[], rows: SeoRow[]): Map<string, SeoRow> {
  const byPath = new Map<string, SeoRow>()
  for (const r of rows) byPath.set(normalize(r.path), r)
  const out = new Map<string, SeoRow>()
  for (const route of routes) {
    if (route.params.length > 0) continue
    const hit = byPath.get(normalize(route.path))
    if (hit) out.set(route.path, hit)
  }
  return out
}

function normalize(path: string): string {
  return path.replace(/\/$/, '') || '/'
}
