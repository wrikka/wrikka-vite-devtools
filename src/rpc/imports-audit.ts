import { posix } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { CODE_EXT, scanSource, type SourceFile } from './scan'

const RESOLVE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.astro', '.json']

/** Relative specifiers only: aliases and packages cannot be resolved from source alone. */
export function relativeImports(text: string): string[] {
  const out = new Set<string>()
  const patterns = [
    /\bfrom\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*['"]([^'"\n]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const spec = m[1]!.split('?')[0]!
      if (spec.startsWith('.')) out.add(spec)
    }
  }
  return [...out]
}

/** Named exports a file offers; default exports are skipped because importers may rename them. */
export function exportedIdentifiers(text: string): string[] {
  const names = new Set<string>()
  for (const m of text.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]!)
  }
  for (const m of text.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    if (/\bfrom\s*['"]/.test(text.slice(m.index! + m[0].length, m.index! + m[0].length + 40))) continue
    for (const part of m[1]!.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  return [...names]
}

export function resolveRelative(fromRel: string, spec: string, known: Set<string>): string | undefined {
  const base = posix.normalize(posix.join(posix.dirname(fromRel), spec))
  if (known.has(base)) return base
  for (const ext of RESOLVE_EXT) if (known.has(base + ext)) return base + ext
  for (const ext of RESOLVE_EXT) if (known.has(`${base}/index${ext}`)) return `${base}/index${ext}`
  return undefined
}

export const auditImports = defineRpcFunction({
  name: 'audit-imports',
  type: 'query',
  agent: {
    description:
      'Build the relative import graph: importers per file, unresolved relative specifiers, and exported identifiers no other file mentions (candidates for dead exports)',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    root: z.string(),
    scanned: z.number(),
    truncated: z.boolean(),
    edges: z.number(),
    files: z.array(z.object({ file: z.string(), importers: z.array(z.string()), imports: z.array(z.string()) })),
    unused: z.array(z.object({ file: z.string(), name: z.string() })),
    unresolved: z.array(z.object({ file: z.string(), specifier: z.string() })),
  }),
  handler: async ({ dir } = {}) => {
    const scan = await scanSource({ dir, exts: CODE_EXT })
    const known = new Set(scan.files.map((f) => f.rel))
    const importers = new Map<string, Set<string>>()
    const imports = new Map<string, string[]>()
    const unresolved: { file: string; specifier: string }[] = []
    let edges = 0

    for (const file of scan.files) {
      const specs = relativeImports(file.text)
      const resolved: string[] = []
      for (const spec of specs) {
        const target = resolveRelative(file.rel, spec, known)
        if (!target) {
          if (unresolved.length < 50) unresolved.push({ file: file.rel, specifier: spec })
          continue
        }
        if (target === file.rel) continue
        resolved.push(target)
        edges++
        const set = importers.get(target) ?? new Set<string>()
        set.add(file.rel)
        importers.set(target, set)
      }
      imports.set(file.rel, resolved)
    }

    const unused: { file: string; name: string }[] = []
    const texts = new Map(scan.files.map((f) => [f.rel, f.text]))
    for (const file of scan.files) {
      for (const name of exportedIdentifiers(file.text)) {
        const word = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`)
        let used = false
        for (const [rel, text] of texts) {
          if (rel === file.rel) continue
          if (word.test(text)) {
            used = true
            break
          }
        }
        if (!used && unused.length < 200) unused.push({ file: file.rel, name })
      }
    }

    const files = scan.files
      .map((f) => ({
        file: f.rel,
        importers: [...(importers.get(f.rel) ?? [])].slice(0, 8),
        imports: (imports.get(f.rel) ?? []).slice(0, 8),
      }))
      .sort((a, b) => a.importers.length - b.importers.length || a.file.localeCompare(b.file))
      .slice(0, 200)

    return { root: scan.dir, scanned: scan.files.length, truncated: scan.truncated, edges, files, unused, unresolved }
  },
})

export type { SourceFile }
