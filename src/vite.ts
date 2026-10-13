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

export type UseDevfraPluginKey =
  | 'use-devfra'
  | 'inspect'
  | 'data-inspector'
  | 'og'
  | 'a11y'
  | 'git'
  | 'assets'
  | 'terminals'
  | 'code-server'

const DEFAULT_PLUGINS: UseDevfraPluginKey[] = [
  'use-devfra',
  'inspect',
  'og',
  'a11y',
  'git',
  'assets',
  'terminals',
]

const ALL_PLUGINS: UseDevfraPluginKey[] = [
  ...DEFAULT_PLUGINS,
  'data-inspector',
  'code-server',
]

type Factory = (options: UseDevfraOptions) => ReturnType<typeof createInspectDevframe> | Promise<ReturnType<typeof createInspectDevframe>>

const factories: Record<UseDevfraPluginKey, Factory> = {
  'use-devfra': (options) =>
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

export interface UseDevfraOptions {
  /** Mount base, default `/__devframes/` — frames live at `<base><id>/`. */
  base?: string
  /** Plugin set to mount. Defaults to every add-on except code-server; `'all'` includes it. */
  plugins?: UseDevfraPluginKey[] | 'all'
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

export function useDevfra(options: UseDevfraOptions = {}): Plugin[] {
  const keys = options.plugins === 'all' ? ALL_PLUGINS : (options.plugins ?? DEFAULT_PLUGINS)
  const unknown = keys.filter((k) => !ALL_PLUGINS.includes(k))
  if (unknown.length > 0) throw new Error(`[use-devfra] unknown plugin key(s): ${unknown.join(', ')}`)
  const devframes = keys.map((k) => {
    if (k === 'data-inspector') {
      // its devframe id is `devframes:plugin:data-inspector` — colons are not
      // hub-mountable (DF8004); re-key the definition to a URL-safe id.
      const def = createDataInspectorDevframe()
      return { ...def, id: 'data-inspector' }
    }
    return factories[k](options)
  })
  return [
    viteDevframeHub({
      base: options.base,
      devframes,
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

export default useDevfra
