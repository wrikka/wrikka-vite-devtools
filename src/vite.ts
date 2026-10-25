import type { Plugin } from 'vite'
import { createUi } from '@devframes/hub-ui'
import { viteDevframeHub } from '@devframes/vite/hub'
import { type DevframeOptions } from './devframe'
import { createDevframes, createDockRegistrar, resolvePluginKeys, type UseWrikkaViteDevtoolsPluginKey } from './add-ons'
import { createSsrInjectPlugin } from './ssr-inject'
import { projectContext } from './rpc/context'

export type { UseWrikkaViteDevtoolsPluginKey }

export interface UseWrikkaViteDevtoolsOptions {
  /** Mount base, default `/__devtools/` — frames live at `<base><id>/`. */
  base?: string
  /**
   * Plugin set to mount. Defaults to every add-on except `data-inspector`,
   * `code-server`, and `unocss`; `'all'` includes them (needs their optional
   * peers installed — `@devframes/plugin-code-server`, `unocss`).
   * `components` and `routes` are dock-only pages of this package's own client.
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
  /**
   * Session role: `operator` (default) mutates, `viewer` is read-only.
   * Defaults to `WRIKKA_DEVTOOLS_ROLE` when set.
   */
  role?: DevframeOptions['role']
  /**
   * Where the dock appears on a first visit: a left edge rail by default.
   * The visitor's own choice wins after that.
   */
  dock?: {
    mode?: 'float' | 'edge'
    position?: 'left' | 'right' | 'top' | 'bottom'
  }
}

/**
 * Publishes the served project to the RPC handlers before any scanner runs.
 * The library itself is imported from `dist/`, so `process.cwd()` alone would
 * point at the wrong tree when the hub is consumed from a workspace root.
 */
function projectContextPlugin(base: string): Plugin {
  return {
    name: 'wrikka-vite-devtools:project-context',
    enforce: 'pre',
    configResolved(config) {
      projectContext.root = config.root
    },
    configureServer(server) {
      projectContext.server = server
      projectContext.base = base
    },
  }
}

export function useWrikkaViteDevtools(options: UseWrikkaViteDevtoolsOptions = {}): Plugin[] {
  const keys = resolvePluginKeys(options.plugins)
  // Explicit default: the hub package's own default is still `/__devframes/`.
  const base = options.base ?? '/__devtools/'
  const dock = { mode: 'edge', position: 'left', ...options.dock } as const
  return [
    projectContextPlugin(base),
    // SSR frameworks stream their own document, so transformIndexHtml never
    // runs there — this injects the hub client (and dock) into streamed HTML.
    ...(options.overlay === false ? [] : [createSsrInjectPlugin(base)]),
    viteDevframeHub({
      base,
      devframes: createDevframes(keys, options),
      configure: createDockRegistrar(keys),
      ui: createUi({
        dockPreferences: { defaultMode: dock.mode, defaultPosition: dock.position },
      }),
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

export default useWrikkaViteDevtools
