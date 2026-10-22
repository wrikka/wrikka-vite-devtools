import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'

const MAX_FILE_SIZE = 512 * 1024
/** Route dirs this plugin knows about, tried in order; first existing wins. */
const ROUTE_DIRS = ['src/routes', 'app/routes', 'src/pages', 'routes', 'pages', 'app/pages']

const RouteSchema = z.object({
  file: z.string(),
  /** URL path — from `createFileRoute('/x')` when present, else derived from the filename. */
  path: z.string(),
  kind: z.enum(['layout', 'index', 'page', 'not-found']),
  hasLoader: z.boolean(),
  hasHead: z.boolean(),
  /** `ssr: false` in the route options, when written. */
  ssrOff: z.boolean(),
  params: z.array(z.string()),
  /** Literal `title:` found in the route options/head, `dynamic` when it is a template or call. */
  title: z.string().optional(),
  /** Literal `content:` of the description meta, when statically written. */
  description: z.string().optional(),
  metaNames: z.array(z.string()),
  /** `routeTree.gen.ts` exists, i.e. the project really uses the TanStack router plugin. */
  generated: z.boolean(),
})

const IGNORE = new Set(['node_modules', 'dist', '.git', '.output', 'coverage'])

export type RouteRow = z.infer<typeof RouteSchema>
export interface RoutesReport {
  routes: RouteRow[]
  detected: 'tanstack-router' | 'file-based' | 'none'
  root: string
}

/** `src/routes/posts.$postId.tsx` → `/posts/$postId`; `__root` layouts keep their parent path. */
export function pathFromFile(rel: string, dir: string): string {
  const tail = rel.slice(dir.length).replace(/\.tsx?$/, '')
  /** Dots are TanStack's path separator, so `posts.$postId.index` is three segments. */
  const segments = tail
    .split(/[/.]/)
    .filter((s) => s && !s.startsWith('-'))
    .map((s) => s.replace(/(index|layout|not-found)$/, '').replace(/__/g, ''))
    .filter(Boolean)
  const path = `/${segments.join('/')}`
  return tail.endsWith('index') || segments.length === 0 ? (path === '/' ? '/' : path) : path
}

export function kindFromFile(file: string, text: string): z.infer<typeof RouteSchema>['kind'] {
  if (/not-found|__404/.test(file)) return 'not-found'
  if (/\/__[^/]+\.tsx?$/.test(file) || /\.layout\.tsx?$/.test(file) || /const\s+Route[\s\S]{0,200}?\bchildren:/.test(text))
    return 'layout'
  if (/index\.tsx?$/.test(file) || file.endsWith('/__root.tsx')) return 'index'
  return 'page'
}

/** Pull the interesting bits out of a route module without a full TS parse. */
export function parseRoute(file: string, text: string, dir: string, generated: boolean): z.infer<typeof RouteSchema> {
  const declared = /createFileRoute\(\s*['"`]([^'"`]+)['"`]/.exec(text)?.[1]
  const path = declared ?? pathFromFile(file, dir)
  const head = /head\s*:/.test(text)
  const titleRaw = /\btitle\s*:\s*(?:async\s*)?\(?[^)]*\)?\s*=>?\s*['"`]([^'"`]+)['"`]|title\s*:\s*['"`]([^'"`]+)['"`]/.exec(text)
  const descRaw = /name:\s*['"`]description['"`]\s*,\s*content:\s*(?:\([^)]*\)\s*=>\s*)?['"`]([^'"`]+)['"`]/.exec(text)
  const metaNames = [...text.matchAll(/name:\s*['"`]([^'"`]{1,40})['"`]/g)].map((m) => m[1]!)
  const params = [...path.matchAll(/\[?([a-zA-Z][\w]*)\]?/g)]
    .filter((m) => /[$[]/.test(path.slice(Math.max(0, (m.index ?? 0) - 1), (m.index ?? 0) + m[0].length + 1)))
    .map((m) => m[1]!)

  return {
    file,
    path,
    kind: kindFromFile(file, text),
    hasLoader: /\bloader\s*:/.test(text),
    hasHead: head,
    ssrOff: /ssr\s*:\s*false/.test(text),
    params: [...new Set(params)],
    title: titleRaw ? (titleRaw[1] ?? titleRaw[2] ?? 'dynamic') : head ? 'dynamic' : undefined,
    description: descRaw?.[1],
    metaNames: [...new Set(metaNames)],
    generated,
  }
}

async function findRoutesDir(root: string): Promise<{ dir: string; rel: string } | undefined> {
  for (const candidate of ROUTE_DIRS) {
    const at = resolve(root, candidate)
    try {
      const info = await stat(at)
      if (info.isDirectory()) return { dir: at, rel: candidate }
    } catch {
      /* try the next candidate */
    }
  }
  return undefined
}

export const listRoutes = defineRpcFunction({
  name: 'list-routes',
  type: 'query',
  agent: {
    description:
      'Inventory of file-based routes (TanStack Router conventions): url path, source file, loader/head/ssr flags, params and the statically declared title/description',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    routes: z.array(RouteSchema),
    /** `none` when no route folder was found — the panel shows that instead of an empty table. */
    detected: z.enum(['tanstack-router', 'file-based', 'none']),
    root: z.string(),
  }),
  handler: async ({ dir } = {}) => {
    const root = resolve(process.cwd())
    const found = dir ? { dir: resolve(root, dir), rel: dir } : await findRoutesDir(root)
    if (!found) return { routes: [], detected: 'none' as const, root: dir ?? ROUTE_DIRS[0]! }

    const generated = await hasRouteTree(root)
    const routesDir: string = found.dir
    const routesRel: string = found.rel
    const routes: z.infer<typeof RouteSchema>[] = []
    async function walk(at: string): Promise<void> {
      for (const d of await readdir(at, { withFileTypes: true })) {
        const full = join(at, d.name)
        if (d.isDirectory()) {
          if (!IGNORE.has(d.name) && !d.name.startsWith('.')) await walk(full)
        } else if (/\.tsx?$/.test(d.name) && !d.name.startsWith('-') && d.name !== 'routeTree.gen.ts') {
          const info = await stat(full)
          if (info.size > MAX_FILE_SIZE) continue
          const text = await readFile(full, 'utf8')
          if (!/createFileRoute|createRoute|<Route|defineRoute/.test(text)) continue
          const file = relative(root, full).split(sep).join('/')
          routes.push(parseRoute(file, text, routesRel, generated))
        }
      }
    }
    try {
      await walk(found.dir)
    } catch {
      /* folder vanished mid-walk — return what we have */
    }
    routes.sort((a, b) => a.path.localeCompare(b.path))
    return { routes, detected: generated ? 'tanstack-router' : 'file-based', root: found.rel }
  },
})

/** Look for a generated route tree anywhere shallow in the project. */
async function hasRouteTree(root: string): Promise<boolean> {
  for (const at of ['src', 'app', '.']) {
    try {
      const names = await readdir(resolve(root, at))
      if (names.some((n) => /routeTree\.gen\.ts$/.test(n))) return true
    } catch {
      /* unreadable dir — keep looking */
    }
  }
  return false
}
