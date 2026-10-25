import type { DevframeHubContext } from '@devframes/hub/node'
import { createA11yDevframe } from '@devframes/plugin-a11y'
import { createAssetsDevframe } from '@devframes/plugin-assets'
import { createDataInspectorDevframe } from '@devframes/plugin-data-inspector'
import { createGitDevframe } from '@devframes/plugin-git'
import { createInspectDevframe } from '@devframes/plugin-inspect'
import { createOgDevframe } from '@devframes/plugin-og'
import { createTerminalsDevframe } from '@devframes/plugin-terminals'
import { createDevframeDefinition, type DevframeOptions } from './devframe'

export type UseWrikkaViteDevtoolsPluginKey =
  | 'wrikka-vite-devtools'
  | 'inspect'
  | 'data-inspector'
  | 'og'
  | 'a11y'
  | 'git'
  | 'assets'
  | 'terminals'
  | 'code-server'
  /** Dock-only key: iframe of the `@unocss/vite` inspector, no devframe. */
  | 'unocss'
  /** Dock-only key: this package's own client at `#/home` — the hub's landing panel. */
  | 'home'
  /** Dock-only key: this package's own client at `#/components`. */
  | 'components'
  /** Dock-only key: this package's own client at `#/routes` (routes + SEO audit). */
  | 'routes'
  /** Dock-only key: this package's own client at `#/solid` (solid-devtools owner tree). */
  | 'solid'
  /** Theme & tokens: theme.ts palette vs utilities actually used in source. */
  | 'theme'
  /** Network: fetch/XHR captured by the page overlay. */
  | 'network'
  /** Runs & queue: every agent run with duration, status, cancel. */
  | 'runs'
  /** MCP playground: list and call the hub's own MCP tools. */
  | 'mcp-playground'
  /** Performance: web vitals + slow resources from the overlay. */
  | 'performance'
  /** Console & logs: page console merged with agent streams. */
  | 'console'
  /** Bundle: largest client modules from the Vite module graph. */
  | 'bundle'
  /** Env & config: `import.meta.env` references vs `.env` files, redacted. */
  | 'env'
  /** Visual diff: saved captures compared against the live page. */
  | 'visual-diff'
  /** Tests: locate the spec for a source file and run it. */
  | 'tests'
  /** State snapshots: signals/storage samples captured by the overlay. */
  | 'state'
  /** Import graph: importers and unused exports per file. */
  | 'imports'
  /** i18n: missing keys, hardcoded copy, per-locale coverage. */
  | 'i18n'
  /** Security headers: CSP/HSTS/COOP on served HTML. */
  | 'security'

type DockOnlyKey =
  | 'home'
  | 'unocss'
  | 'components'
  | 'routes'
  | 'solid'
  | 'theme'
  | 'network'
  | 'runs'
  | 'mcp-playground'
  | 'performance'
  | 'console'
  | 'bundle'
  | 'env'
  | 'visual-diff'
  | 'tests'
  | 'state'
  | 'imports'
  | 'i18n'
  | 'security'

/** Where `@unocss/vite` serves its inspector UI — the `unocss` dock frames this. */
const UNOCSS_INSPECTOR_BASE = '/__unocss/'

/** Devframe whose client SPA the `components`/`routes` docks frame. */
const FRAME_ID = 'wrikka-vite-devtools'

/** Keys that register a dock but mount no devframe of their own. */
const DOCK_ONLY = new Set<UseWrikkaViteDevtoolsPluginKey>([
  'home',
  'unocss',
  'components',
  'routes',
  'solid',
  'theme',
  'network',
  'runs',
  'mcp-playground',
  'performance',
  'console',
  'bundle',
  'env',
  'visual-diff',
  'tests',
  'state',
  'imports',
  'i18n',
  'security',
])

const DEFAULT_PLUGINS: UseWrikkaViteDevtoolsPluginKey[] = [
  'wrikka-vite-devtools',
  'inspect',
  'og',
  'a11y',
  'git',
  'assets',
  'terminals',
  'home',
  'components',
  'routes',
  'solid',
  'theme',
  'network',
  'runs',
  'mcp-playground',
  'performance',
  'console',
  'bundle',
  'env',
  'visual-diff',
  'tests',
  'state',
  'imports',
  'i18n',
  'security',
]

const ALL_PLUGINS: UseWrikkaViteDevtoolsPluginKey[] = [
  ...DEFAULT_PLUGINS,
  'data-inspector',
  'code-server',
  'unocss',
]

/** Resolve the requested plugin set, rejecting keys this build cannot mount. */
export function resolvePluginKeys(
  plugins?: UseWrikkaViteDevtoolsPluginKey[] | 'all',
): UseWrikkaViteDevtoolsPluginKey[] {
  const keys = plugins === 'all' ? ALL_PLUGINS : (plugins ?? DEFAULT_PLUGINS)
  const unknown = keys.filter((k) => !ALL_PLUGINS.includes(k))
  if (unknown.length > 0) throw new Error(`[wrikka-vite-devtools] unknown plugin key(s): ${unknown.join(', ')}`)
  return keys
}

type Factory = (options: DevframeOptions) => ReturnType<typeof createInspectDevframe> | Promise<ReturnType<typeof createInspectDevframe>>

type DevframeKey = Exclude<UseWrikkaViteDevtoolsPluginKey, DockOnlyKey>

const factories: Record<DevframeKey, Factory> = {
  'wrikka-vite-devtools': createDevframeDefinition,
  inspect: () => createInspectDevframe(),
  'data-inspector': () => {
    // its devframe id is `devframes:plugin:data-inspector` — colons are not
    // hub-mountable (DF8004); re-key the definition to a URL-safe id.
    const def = createDataInspectorDevframe()
    return { ...def, id: 'data-inspector' }
  },
  og: () => createOgDevframe(),
  a11y: () => createA11yDevframe(),
  git: () => createGitDevframe(),
  assets: () => createAssetsDevframe(),
  terminals: () => createTerminalsDevframe(),
  // optional peer — install @devframes/plugin-code-server to enable
  'code-server': () => import('@devframes/plugin-code-server').then((m) => m.default()),
}

/** Build the devframe entries for `keys`; dock-only keys are skipped here. */
export function createDevframes(
  keys: UseWrikkaViteDevtoolsPluginKey[],
  options: DevframeOptions,
): ReturnType<Factory>[] {
  return keys
    .filter((k): k is DevframeKey => !DOCK_ONLY.has(k))
    .map((k) => factories[k](options))
}

/**
 * UnoCSS ships no devframe: `@unocss/vite` mounts its inspector as a standalone
 * app, and its devframe export registers with Vite's own devtools API, not the
 * devframes hub. Frame the already-served inspector so it appears in the dock.
 */
export function registerUnocssDock(ctx: DevframeHubContext) {
  ctx.docks.register({
    id: 'unocss',
    title: 'UnoCSS',
    icon: 'ph:palette-duotone',
    type: 'iframe',
    url: UNOCSS_INSPECTOR_BASE,
    category: 'framework',
    addressBar: { back: true, reload: true, openExternal: true },
  })
}

/**
 * Every dock-only key is a page of this package's own client SPA, so they frame
 * the already-mounted devframe with a hash route instead of shipping a second
 * build. No-op when the devframe itself is not mounted (its RPCs live there) or
 * when none of those keys is selected.
 */
export function registerPanelDocks(ctx: DevframeHubContext, keys: UseWrikkaViteDevtoolsPluginKey[]): void {
  const base = ctx.frames.find((f) => f.id === FRAME_ID)?.base
  if (!base) return
  const panels: {
    key: DockOnlyKey
    id: string
    title: string
    icon: string
    category: string
  }[] = [
    { key: 'home', id: 'home', title: 'Home', icon: 'ph:house-duotone', category: 'project' },
    { key: 'components', id: 'components', title: 'Components', icon: 'ph:lego-duotone', category: 'project' },
    { key: 'routes', id: 'routes', title: 'Routes & SEO', icon: 'ph:tree-structure-duotone', category: 'project' },
    { key: 'solid', id: 'solid', title: 'Solid', icon: 'ph:atom-duotone', category: 'framework' },
    { key: 'theme', id: 'theme', title: 'Theme & Tokens', icon: 'ph:swatches-duotone', category: 'source' },
    { key: 'network', id: 'network', title: 'Network', icon: 'ph:globe-hemisphere-west-duotone', category: 'runtime' },
    { key: 'runs', id: 'runs', title: 'Runs & Queue', icon: 'ph:queue-duotone', category: 'agent' },
    {
      key: 'mcp-playground',
      id: 'mcp-playground',
      title: 'MCP Playground',
      icon: 'ph:plugs-connected-duotone',
      category: 'agent',
    },
    { key: 'performance', id: 'performance', title: 'Performance', icon: 'ph:gauge-duotone', category: 'runtime' },
    { key: 'console', id: 'console', title: 'Console & Logs', icon: 'ph:terminal-window-duotone', category: 'runtime' },
    { key: 'bundle', id: 'bundle', title: 'Bundle', icon: 'ph:package-duotone', category: 'build' },
    { key: 'env', id: 'env', title: 'Env & Config', icon: 'ph:key-duotone', category: 'build' },
    { key: 'visual-diff', id: 'visual-diff', title: 'Visual Diff', icon: 'ph:columns-duotone', category: 'quality' },
    { key: 'tests', id: 'tests', title: 'Tests', icon: 'ph:flask-duotone', category: 'quality' },
    { key: 'state', id: 'state', title: 'State Snapshots', icon: 'ph:database-duotone', category: 'runtime' },
    { key: 'imports', id: 'imports', title: 'Import Graph', icon: 'ph:graph-duotone', category: 'build' },
    { key: 'i18n', id: 'i18n', title: 'i18n', icon: 'ph:translate-duotone', category: 'source' },
    { key: 'security', id: 'security', title: 'Security Headers', icon: 'ph:shield-check-duotone', category: 'quality' },
  ]
  for (const p of panels) {
    if (!keys.includes(p.key)) continue
    ctx.docks.register({
      id: p.id,
      title: p.title,
      icon: p.icon,
      type: 'iframe',
      url: `${base}#/${p.id}`,
      category: p.category,
      addressBar: { back: true, reload: true, openExternal: true },
    })
  }
}

/** The hub `configure` hook: mount every dock-only add-on the set selected. */
export function createDockRegistrar(keys: UseWrikkaViteDevtoolsPluginKey[]) {
  return (ctx: DevframeHubContext): void => {
    if (keys.includes('unocss')) registerUnocssDock(ctx)
    registerPanelDocks(ctx, keys)
  }
}
