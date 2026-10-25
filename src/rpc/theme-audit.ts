import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { projectRoot } from './context'
import { CODE_EXT, relFromRoot, scanSource, type SourceFile } from './scan'

const COLOR_UTILITY =
  /^(bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|placeholder|caret|accent|shadow)-(.+)$/

/** Tailwind's stock palettes — any of these means the utility skips the theme. */
const PALETTE =
  /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|lightblue|warmgray|truegray|coolgray|bluegray)$/

const ALLOWED = new Set(['white', 'black', 'transparent', 'current', 'inherit'])

/**
 * An `[…]` value is only a color violation when it really carries a color:
 * `text-[13px]` and `border-[length:3px]` are sizes, `text-[#fff]` is a hardcode.
 */
export function arbitraryIsColor(value: string): boolean {
  const inner = value.slice(1, -1).trim()
  const typed = /^(color|length|size|percentage|number)\s*:\s*(.*)$/i.exec(inner)
  if (typed) return typed[1]!.toLowerCase() === 'color'
  if (/^#|^(rgb|hsl|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i.test(inner)) return true
  return !/^-?\d*\.?\d+([a-z%]+)?$/i.test(inner)
}

/** Values that look like colors but are size, weight, or placement utilities. */
const NON_COLOR = new Set([
  'sm', 'xs', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
  'left', 'center', 'right', 'justify', 'start', 'end', 'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip',
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'inset', 'radius', 'opacity', 'blend', 'offset',
  't', 'b', 'l', 'r', 'x', 'y', 's', 'e', 'tl', 'tr', 'bl', 'br',
  'none', 'auto', 'full', 'screen', 'min', 'max', 'fit',
])

export type UtilityKind = 'token' | 'allowed' | 'palette' | 'arbitrary' | 'unknown'

export interface UtilityRow {
  name: string
  count: number
  files: string[]
  kind: UtilityKind
  dark: boolean
}

export interface ThemeAuditReport {
  root: string
  hasTheme: boolean
  tokens: string[]
  scanned: number
  truncated: boolean
  utilities: UtilityRow[]
  violations: UtilityRow[]
}

/** Body of the `{...}` starting at `openIndex`, quote- and comment-aware. */
export function objectBody(src: string, openIndex: number): string {
  let depth = 0
  let quote = ''
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i]!
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? src.length : nl
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 1
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(openIndex + 1, i)
    }
  }
  return src.slice(openIndex + 1)
}

/** Split an object literal on its top-level commas. */
export function splitTopLevel(body: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  let quote = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      out.push(body.slice(start, i))
      start = i + 1
    }
  }
  out.push(body.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/** `{ surface: { DEFAULT, raised } }` → `['surface', 'surface-raised']`. */
export function flattenObjectKeys(body: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of splitTopLevel(body)) {
    const m = /^(['"]?)([A-Za-z0-9_$-]+)\1\s*:\s*([\s\S]*)$/.exec(entry)
    if (!m) continue
    const key = m[2]!.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    const name = key === 'default' ? prefix : prefix ? `${prefix}-${key}` : key
    if (!name) continue
    const value = m[3]!.trim()
    if (value.startsWith('{')) out.push(...flattenObjectKeys(objectBody(value, 0), name))
    else out.push(name)
  }
  return [...new Set(out.filter(Boolean))]
}

/** Class-looking tokens inside string literals; CSS declarations are ignored. */
export function classNameTokens(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/['"`]([^'"`\n]{1,600})['"`]/g)) {
    const raw = m[1]!
    if (!/[a-z]-/.test(raw)) continue
    for (const word of raw.split(/\s+/)) {
      if (!word || word.length > 80) continue
      if (/[;{}()]/.test(word) || word.endsWith(':')) continue
      const base = word.slice(word.lastIndexOf(':') + 1).replace(/^!?-?/, '')
      if (!COLOR_UTILITY.test(base)) continue
      out.add(word)
    }
  }
  return [...out]
}

export function classifyColorUtility(
  utility: string,
  tokens: Set<string>,
): { kind: UtilityKind; dark: boolean } | undefined {
  const dark = /(^|:)dark:/.test(utility)
  const base = utility.slice(utility.lastIndexOf(':') + 1).replace(/^!?-?/, '')
  const m = COLOR_UTILITY.exec(base)
  if (!m) return undefined
  const value = m[2]!.replace(/\/\d{1,3}$/, '')
  if (!value) return undefined
  if (value.startsWith('[')) return arbitraryIsColor(value) ? { kind: 'arbitrary', dark } : undefined
  if (/^(linear|radial|conic|gradient)(-|$)/.test(value)) return undefined
  if (value.includes('(')) return { kind: 'arbitrary', dark }
  if (ALLOWED.has(value)) return { kind: 'allowed', dark }
  if (NON_COLOR.has(value) || /^\d+(\.\d+)?%?$/.test(value)) return undefined
  if (PALETTE.test(value) || PALETTE.test(value.replace(/-\d{2,3}$/, ''))) return { kind: 'palette', dark }
  if (tokens.has(value)) return { kind: 'token', dark }
  return { kind: 'unknown', dark }
}

/** Theme tokens declared as `themeColors`/`colors` objects or `--color-*` CSS custom props. */
export function themeTokens(files: SourceFile[]): string[] {
  const tokens = new Set<string>()
  for (const f of files) {
    for (const m of f.text.matchAll(/--color-([a-zA-Z0-9-]+)\s*:/g)) tokens.add(m[1]!.toLowerCase())
    for (const m of f.text.matchAll(/\b(?:themeColors|colors)\b\s*(?::[^={}]*)?=\s*\{/g)) {
      const open = f.text.indexOf('{', m.index + m[0].length - 1)
      if (open >= 0) for (const t of flattenObjectKeys(objectBody(f.text, open))) tokens.add(t)
    }
    const colorsAt = f.text.search(/\bcolors\s*:\s*\{/)
    if (colorsAt >= 0) {
      const open = f.text.indexOf('{', colorsAt)
      for (const t of flattenObjectKeys(objectBody(f.text, open))) tokens.add(t)
    }
  }
  return [...tokens].sort()
}

/** `theme: { colors: themeColors }` almost always points at a palette in another module. */
const PALETTE_SYMBOLS = new Set(['themeColors', 'colors'])
const IMPORT = /import\s+(?:type\s+)?(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s+from\s+['"]([^'"]+)['"]/g
const MAX_PALETTE_FILES = 8
const MAX_PALETTE_BYTES = 512 * 1024

async function resolveModule(base: string): Promise<string | undefined> {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts')]
  for (const path of candidates) {
    if (!CODE_EXT.has(path.slice(path.lastIndexOf('.')))) continue
    try {
      if ((await stat(path)).isFile()) return path
    } catch {
      /* try the next candidate */
    }
  }
  return undefined
}

/**
 * Reads the modules a scanned file imports its palette from, so a palette kept in a
 * shared package still counts as declared. Relative specifiers only, source files
 * only, at most `MAX_PALETTE_FILES` hops — never `node_modules`.
 */
export async function paletteModules(files: SourceFile[]): Promise<SourceFile[]> {
  const root = projectRoot()
  const seen = new Set(files.map((f) => f.full))
  const extra: SourceFile[] = []
  const queue = [...files]
  while (queue.length > 0 && extra.length < MAX_PALETTE_FILES) {
    const file = queue.shift()!
    for (const m of file.text.matchAll(IMPORT)) {
      const named = m[1]
      const bound = named
        ? named.split(',').some((s) => PALETTE_SYMBOLS.has(s.trim().split(/\s+as\s+/)[0]!.trim()))
        : PALETTE_SYMBOLS.has(m[2] ?? '')
      if (!bound) continue
      const spec = m[3]!
      if (!spec.startsWith('.')) continue
      const path = await resolveModule(resolve(dirname(file.full), spec))
      if (!path || seen.has(path) || path.includes('/node_modules/')) continue
      try {
        if ((await stat(path)).size > MAX_PALETTE_BYTES) continue
        const next: SourceFile = { rel: relFromRoot(root, path), full: path, text: await readFile(path, 'utf8') }
        seen.add(path)
        extra.push(next)
        queue.push(next)
      } catch {
        /* unreadable palette module — keep auditing with what the scan has */
      }
    }
  }
  return extra
}

export const auditTheme = defineRpcFunction({
  name: 'audit-theme',
  type: 'query',
  agent: {
    description:
      'Audit the project against its UnoCSS theme: declared tokens, color utilities actually used, and violations (stock palette hardcodes, arbitrary hex values, dark: variants that the token layer should replace)',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    root: z.string(),
    hasTheme: z.boolean(),
    tokens: z.array(z.string()),
    scanned: z.number(),
    truncated: z.boolean(),
    utilities: z.array(
      z.object({
        name: z.string(),
        count: z.number(),
        files: z.array(z.string()),
        kind: z.enum(['token', 'allowed', 'palette', 'arbitrary', 'unknown']),
        dark: z.boolean(),
      }),
    ),
    violations: z.array(
      z.object({
        name: z.string(),
        count: z.number(),
        files: z.array(z.string()),
        kind: z.enum(['token', 'allowed', 'palette', 'arbitrary', 'unknown']),
        dark: z.boolean(),
      }),
    ),
  }),
  handler: async ({ dir } = {}) => {
    const scan = await scanSource({ dir })
    const palette = await paletteModules(scan.files)
    const tokens = themeTokens([...scan.files, ...palette])
    const known = new Set(tokens)
    const agg = new Map<string, { count: number; files: Set<string>; kind: UtilityKind; dark: boolean }>()

    for (const file of scan.files) {
      for (const name of classNameTokens(file.text)) {
        const hit = classifyColorUtility(name, known)
        if (!hit) continue
        const row = agg.get(name) ?? { count: 0, files: new Set<string>(), kind: hit.kind, dark: hit.dark }
        row.count++
        row.files.add(file.rel)
        agg.set(name, row)
      }
    }

    const rows: UtilityRow[] = [...agg.entries()]
      .map(([name, r]) => ({
        name,
        count: r.count,
        files: [...r.files].slice(0, 5),
        kind: r.kind,
        dark: r.dark,
      }))
      .sort((a, b) => b.count - a.count)

    return {
      root: scan.dir,
      hasTheme: tokens.length > 0,
      tokens,
      scanned: scan.files.length,
      truncated: scan.truncated,
      utilities: rows.slice(0, 120),
      violations: rows
        .filter((r) => r.dark || r.kind === 'palette' || r.kind === 'arbitrary' || r.kind === 'unknown')
        .slice(0, 60),
    }
  },
})
