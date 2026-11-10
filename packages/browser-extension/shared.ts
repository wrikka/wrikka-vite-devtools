// Shared detection + copy used by the content script, popup and background.

export interface PageStatus {
  url: string
  local: boolean
  plugin: boolean
  checkedAt: number
}

export const SETUP_SNIPPET = `bun add -D wrikka-vite-devtools
// vite.config.ts — place BEFORE framework plugins
useWrikkaViteDevtools({ plugins: 'all', auth: false })`

const INDEX_PATH = '/__devtools/__index.json'
const FETCH_TIMEOUT_MS = 1500
const CACHE_MS = 10_000

export function isLocalHost(raw: string): boolean {
  try {
    const h = new URL(raw).hostname.toLowerCase()
    return (
      h === 'localhost' ||
      h.endsWith('.localhost') ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '[::1]' ||
      h === '0.0.0.0'
    )
  } catch {
    return false
  }
}

export function hubUrl(raw: string): string {
  try {
    return `${new URL(raw).origin}/__devtools/`
  } catch {
    return ''
  }
}

// The overlay sets window.__WRIKKA_VITE_DEVTOOLS_OVERLAY__ = true; the hub also
// serves /__devtools/__index.json. Either signal counts as "plugin detected".
export async function detectPlugin(raw: string, force = false): Promise<boolean> {
  const cached = pluginCache.get(raw)
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.plugin
  let plugin = false
  try {
    if (typeof window !== 'undefined' && new URL(raw).origin === window.location.origin) {
      plugin = (window as unknown as Record<string, unknown>).__WRIKKA_VITE_DEVTOOLS_OVERLAY__ === true
    }
  } catch {
    plugin = false
  }
  if (!plugin) {
    try {
      const res = await fetch(`${new URL(raw).origin}${INDEX_PATH}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        credentials: 'omit',
      })
      plugin = res.ok
    } catch {
      plugin = false
    }
  }
  pluginCache.set(raw, { at: Date.now(), plugin })
  return plugin
}

const pluginCache = new Map<string, { at: number; plugin: boolean }>()

export async function detectStatus(raw: string, force = false): Promise<PageStatus> {
  const local = isLocalHost(raw)
  // Only localhost dev servers can serve the plugin index.
  const plugin = local ? await detectPlugin(raw, force) : false
  return { url: raw, local, plugin, checkedAt: Date.now() }
}
