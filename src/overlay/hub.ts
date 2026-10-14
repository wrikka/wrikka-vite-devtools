const DEFAULT_HUB_BASE = '/__devframes/'
const PAGE_SCRIPT_MARKER = '__page-script/'

/**
 * The overlay is served at `<hubBase><devframeId>/__page-script/index.mjs`, so the hub
 * mount is one path segment above that directory. Other locations fall back to the default.
 */
export function hubUrl(moduleUrl: string): string {
  const path = new URL(moduleUrl).pathname
  const at = path.indexOf(PAGE_SCRIPT_MARKER)
  if (at < 0) return DEFAULT_HUB_BASE
  return path.slice(0, at).replace(/[^/]+\/$/, '') || DEFAULT_HUB_BASE
}

/**
 * The hub injects the page-script into its own document and into dock frames, where the
 * pill would duplicate the panel it is meant to link to.
 */
export function isHubDocument(moduleUrl: string, pathname: string): boolean {
  const hub = hubUrl(moduleUrl)
  return hub !== '/' && pathname.startsWith(hub)
}
