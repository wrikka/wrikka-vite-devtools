import type { DevframeHubContext } from '@devframes/hub/node'
import type { Plugin } from 'vite'
import { viteDevframeHub } from '@devframes/vite/hub'
import { createA11yDevframe } from '@devframes/plugin-a11y'
import { createAssetsDevframe } from '@devframes/plugin-assets'
import { createDataInspectorDevframe } from '@devframes/plugin-data-inspector'
import { createGitDevframe } from '@devframes/plugin-git'
import { createInspectDevframe } from '@devframes/plugin-inspect'
import { createOgDevframe } from '@devframes/plugin-og'
import { createTerminalsDevframe } from '@devframes/plugin-terminals'
import { createDevframeDefinition, type DevframeOptions } from './devframe'
import { createSsrInjectPlugin } from './ssr-inject'

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

/** Where `@unocss/vite` serves its inspector UI — the `unocss` dock frames this. */
const UNOCSS_INSPECTOR_BASE = '/__unocss/'

const DEFAULT_PLUGINS: UseWrikkaViteDevtoolsPluginKey[] = [
  'wrikka-vite-devtools',
  'inspect',
  'og',
  'a11y',
  'git',
  'assets',
  'terminals',
]

const ALL_PLUGINS: UseWrikkaViteDevtoolsPluginKey[] = [
  ...DEFAULT_PLUGINS,
  'data-inspector',
  'code-server',
  'unocss',
]

type Factory = (options: UseWrikkaViteDevtoolsOptions) => ReturnType<typeof createInspectDevframe> | Promise<ReturnType<typeof createInspectDevframe>>

const factories: Record<Exclude<UseWrikkaViteDevtoolsPluginKey, 'unocss'>, Factory> = {
  'wrikka-vite-devtools': (options) =>
    createDevframeDefinition({
      skillsRoots: options.skillsRoots,
      agent: options.agent,
      overlay: options.overlay,
    }),
  inspect: () => createInspectDevframe(),
  'data-inspector': () => createDataInspectorDevframe(),
  og: () => createOgDevframe(),
  a11y: () => createA11yDevframe(),
  git: () => createGitDevframe(),
  assets: () => createAssetsDevframe(),
  terminals: () => createTerminalsDevframe(),
  // optional peer — install @devframes/plugin-code-server to enable
  'code-server': () => import('@devframes/plugin-code-server').then((m) => m.default()),
}

export interface UseWrikkaViteDevtoolsOptions {
  /** Mount base, default `/__devframes/` — frames live at `<base><id>/`. */
  base?: string
  /**
   * Plugin set to mount. Defaults to every add-on except `data-inspector`,
   * `code-server`, and `unocss`; `'all'` includes them (needs their optional
   * peers installed — `@devframes/plugin-code-server`, `unocss`).
   */
  plugins?: UseWrikkaViteDevtoolsPluginKey[] | 'all'
  /** Aggregate MCP endpoint at `<base>__mcp`. Default `'auto'`. */
  mcp?: boolean | 'auto'
  /** `false` disables the OTP gate (localhost single-user only). Default: hub gate. */
  auth?: boolean
  /** Bake the static hub into `vite build` output. Default off. */
  build?: boolean
  /** Silence the Vite DevTools recommendation notice. */
  quiet?: boolean
  /** Extra skill roots for the harness picker (default: devin/claude/qoder global + project dirs). */
  skillsRoots?: string[]
  /** Comment→agent runner: `'auto'` or a pinned driver, and autoRun (default true). */
  agent?: DevframeOptions['agent']
  /** `false` disables the in-app comment overlay dock. Default on. */
  overlay?: boolean
}

export function useWrikkaViteDevtools(options: UseWrikkaViteDevtoolsOptions = {}): Plugin[] {
  const keys = options.plugins === 'all' ? ALL_PLUGINS : (options.plugins ?? DEFAULT_PLUGINS)
  const unknown = keys.filter((k) => !ALL_PLUGINS.includes(k))
  if (unknown.length > 0) throw new Error(`[wrikka-vite-devtools] unknown plugin key(s): ${unknown.join(', ')}`)
  const devframeKeys = keys.filter(
    (k): k is Exclude<UseWrikkaViteDevtoolsPluginKey, 'unocss'> => k !== 'unocss',
  )
  const devframes = devframeKeys.map((k) => {
    if (k === 'data-inspector') {
      // its devframe id is `devframes:plugin:data-inspector` — colons are not
      // hub-mountable (DF8004); re-key the definition to a URL-safe id.
      const def = createDataInspectorDevframe()
      return { ...def, id: 'data-inspector' }
    }
    return factories[k](options)
  })
  return [
    // SSR frameworks stream their own document, so transformIndexHtml never
    // runs there — this injects the hub client (and dock) into streamed HTML.
    ...(options.overlay === false ? [] : [createSsrInjectPlugin(options.base)]),
    viteDevframeHub({
      base: options.base,
      devframes,
      ...(keys.includes('unocss') ? { configure: registerUnocssDock } : {}),
      // @devframes/service-{open,git,shiki} are wired by the plugins' own
      // service descriptors — installed as deps, built by the hub at the
      // ready barrier, no host wiring needed here.
      mcp: options.mcp,
      auth: options.auth,
      build: options.build,
      quiet: options.quiet,
    }) as Plugin,
  ]
}

/**
 * UnoCSS ships no devframe: `@unocss/vite` mounts its inspector as a standalone
 * app, and its devframe export registers with Vite's own devtools API, not the
 * devframes hub. Frame the already-served inspector so it appears in the dock.
 */
function registerUnocssDock(ctx: DevframeHubContext) {
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

export default useWrikkaViteDevtools
