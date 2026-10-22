import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'

const MAX_FILES = 3000
const MAX_FILE_SIZE = 512 * 1024

const IGNORE = new Set(['node_modules', 'dist', 'build', '.git', '.output', 'coverage', '.next', '.nuxt', '.svelte-kit', 'dev-dist'])
const SRC = new Set(['.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue'])

const ComponentSchema = z.object({
  /** Repo-relative path, posix separators. */
  file: z.string(),
  name: z.string(),
  /** PascalCase exports of the file — a file can host several components. */
  exports: z.array(z.string()),
  loc: z.number(),
  /** Files (other than itself) that mention this component by name. */
  refs: z.number(),
  kind: z.enum(['component', 'page', 'layout', 'hook']),
})

export type ComponentRow = z.infer<typeof ComponentSchema>
export interface ComponentsReport {
  root: string
  components: ComponentRow[]
  truncated: boolean
}

/** `export (default )?(function|const|class) PascalCase` + `export { A, B }`. */
export function exportedNames(src: string): string[] {
  const names = new Set<string>()
  for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    names.add(m[1]!)
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1]!.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && /^[A-Z][A-Za-z0-9_]*$/.test(name)) names.add(name)
    }
  }
  return [...names]
}

export function kindOf(file: string, name: string): z.infer<typeof ComponentSchema>['kind'] {
  if (/^use[A-Z]/.test(name)) return 'hook'
  if (/(^|[/])(routes|pages)([/]|$)/.test(file)) return 'page'
  if (/(layout|wrapper|shell)/i.test(file)) return 'layout'
  return 'component'
}

export const listComponents = defineRpcFunction({
  name: 'list-components',
  type: 'query',
  agent: {
    description:
      'Inventory of React/Solid components in the project: file, exported names, lines of code, and how many other files reference them (refs=0 means unused)',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    root: z.string(),
    components: z.array(ComponentSchema),
    truncated: z.boolean(),
  }),
  handler: async ({ dir = 'src' } = {}) => {
    const root = resolve(process.cwd())
    const base = resolve(root, dir)
    const files: { rel: string; full: string; text: string }[] = []
    let truncated = false

    async function walk(at: string): Promise<void> {
      if (truncated) return
      const dirents = await readdir(at, { withFileTypes: true })
      for (const d of dirents) {
        if (files.length >= MAX_FILES) {
          truncated = true
          return
        }
        const full = join(at, d.name)
        if (d.isDirectory()) {
          if (!IGNORE.has(d.name) && !d.name.startsWith('.')) await walk(full)
        } else if (d.isFile() && SRC.has(extOf(d.name)) && !d.name.endsWith('.test.tsx') && !d.name.endsWith('.stories.tsx')) {
          const info = await stat(full)
          if (info.size > MAX_FILE_SIZE) continue
          files.push({ rel: relative(root, full).split(sep).join('/'), full, text: await readFile(full, 'utf8') })
        }
      }
    }

    try {
      await walk(base)
    } catch {
      /* missing src dir — report an empty inventory instead of throwing */
    }

    const components: z.infer<typeof ComponentSchema>[] = []
    for (const f of files) {
      const names = exportedNames(f.text).filter((n) => /^[A-Z]/.test(n) || /^use[A-Z]/.test(n))
      if (names.length === 0) continue
      const loc = f.text.split('\n').length
      for (const name of names) {
        const word = new RegExp(`\\b${name}\\b`)
        const refs = files.reduce((n, other) => (other.rel === f.rel ? n : word.test(other.text) ? n + 1 : n), 0)
        components.push({ file: f.rel, name, exports: names, loc, refs, kind: kindOf(f.rel, name) })
      }
    }
    components.sort((a, b) => a.refs - b.refs || b.loc - a.loc || a.name.localeCompare(b.name))
    return { root: dir, components, truncated }
  },
})

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot)
}
