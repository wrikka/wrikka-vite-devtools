import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { projectRoot } from './context'

export const CODE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.vue',
  '.svelte',
  '.astro',
])

export const WEB_EXT = new Set([...CODE_EXT, '.html', '.css', '.scss'])

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.output',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'dev-dist',
  '.cache',
  '.turbo',
  '.vercel',
  '.idea',
  '.vscode',
  'vendor',
  'target',
])

export interface SourceFile {
  /** Project-relative path, posix separators. */
  rel: string
  full: string
  text: string
}

export interface SourceScan {
  root: string
  /** Directory the walk started from, project-relative. */
  dir: string
  files: SourceFile[]
  truncated: boolean
}

export interface ScanOptions {
  /** Project-relative sub-directory; defaults to the project root. */
  dir?: string
  exts?: Set<string>
  maxFiles?: number
  maxFileSize?: number
}

/** Walk the served project once; every audit panel reads from this. */
export async function scanSource(options: ScanOptions = {}): Promise<SourceScan> {
  const root = projectRoot()
  const dir = options.dir ?? '.'
  const base = resolve(root, dir)
  const exts = options.exts ?? WEB_EXT
  const maxFiles = options.maxFiles ?? 3000
  const maxFileSize = options.maxFileSize ?? 512 * 1024
  const files: SourceFile[] = []
  let truncated = false

  async function walk(at: string, depth: number): Promise<void> {
    if (truncated || depth > 12) return
    let dirents
    try {
      dirents = await readdir(at, { withFileTypes: true })
    } catch {
      return
    }
    for (const d of dirents) {
      if (files.length >= maxFiles) {
        truncated = true
        return
      }
      if (d.isDirectory()) {
        if (!IGNORED_DIRS.has(d.name) && !d.name.startsWith('.')) await walk(join(at, d.name), depth + 1)
        continue
      }
      if (!d.isFile()) continue
      const dot = d.name.lastIndexOf('.')
      const ext = dot === -1 ? '' : d.name.slice(dot).toLowerCase()
      if (!exts.has(ext)) continue
      const full = join(at, d.name)
      try {
        const info = await stat(full)
        if (info.size > maxFileSize) continue
        files.push({ rel: relative(root, full).split(sep).join('/'), full, text: await readFile(full, 'utf8') })
      } catch {
        /* unreadable file — skip it, keep walking */
      }
    }
  }

  await walk(base, 0)
  files.sort((a, b) => a.rel.localeCompare(b.rel))
  return { root, dir, files, truncated }
}

export function relFromRoot(root: string, full: string): string {
  return relative(root, full).split(sep).join('/')
}

/** Guard every path an RPC takes from the client. */
export function isInside(root: string, target: string): boolean {
  const r = resolve(root)
  const t = resolve(target)
  return t === r || t.startsWith(r.endsWith(sep) ? r : `${r}${sep}`)
}

export function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot)
}
