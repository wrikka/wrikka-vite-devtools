import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { CODE_EXT, scanSource } from './scan'

const LOCALE_DIR = /(^|\/)(locales?|i18n|lang|langs|messages|translations)\//i

/** `{ a: { b: 'x' } }` → `{ 'a.b': 'x' }`; arrays are leaves. */
export function flattenJson(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (value == null) return out
  if (typeof value === 'string') {
    out[prefix] = value
    return out
  }
  if (typeof value !== 'object') return out
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) flattenJson(child, name, out)
    else out[name] = typeof child === 'string' ? child : String(child)
  }
  return out
}

/** Literal keys passed to `t('…')` / `$t('…')` / `i18n.t('…')`. */
export function tCallKeys(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:\b|\$)t\s*\(\s*['"`]([^'"`$\n]{1,120})['"`]/g)) out.add(m[1]!)
  for (const m of text.matchAll(/\bi18n\.t\s*\(\s*['"`]([^'"`$\n]{1,120})['"`]/g)) out.add(m[1]!)
  return [...out]
}

/** Text nodes in JSX with no interpolation — likely copy that never reached a catalog. */
export function hardcodedCopy(text: string, file: string): { file: string; text: string }[] {
  if (!/\.(tsx|jsx|vue|svelte|astro|html)$/.test(file)) return []
  const out: { file: string; text: string }[] = []
  for (const m of text.matchAll(/>([^<>{}\n]{12,120})</g)) {
    const copy = m[1]!.trim()
    if (!/[A-Za-z]{3}/.test(copy)) continue
    if (/^[\d\s.,:%/()+-]+$/.test(copy)) continue
    if (/^https?:\/\//.test(copy)) continue
    out.push({ file, text: copy })
    if (out.length >= 3) break
  }
  return out
}

export const auditI18n = defineRpcFunction({
  name: 'audit-i18n',
  type: 'query',
  agent: {
    description:
      'Audit i18n: locale catalogs under locales/i18n/lang/messages, per-locale key coverage, keys referenced by `t()` calls but missing from a catalog, unused catalog keys, and JSX text that bypasses translation',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    root: z.string(),
    detected: z.boolean(),
    used: z.array(z.string()),
    locales: z.array(
      z.object({
        locale: z.string(),
        file: z.string(),
        keys: z.number(),
        missing: z.array(z.string()),
        coverage: z.number(),
      }),
    ),
    unused: z.array(z.object({ locale: z.string(), key: z.string() })),
    hardcoded: z.array(z.object({ file: z.string(), text: z.string() })),
  }),
  handler: async ({ dir } = {}) => {
    const scan = await scanSource({ dir, exts: new Set([...CODE_EXT, '.json']) })
    const catalogs = scan.files.filter((f) => f.rel.endsWith('.json') && LOCALE_DIR.test(f.rel))

    const messages = new Map<string, Record<string, string>>()
    for (const file of catalogs) {
      try {
        messages.set(file.rel, flattenJson(JSON.parse(file.text)))
      } catch {
        /* invalid JSON — the catalog simply does not count */
      }
    }

    const used = new Set<string>()
    const hardcoded: { file: string; text: string }[] = []
    for (const file of scan.files) {
      if (file.rel.endsWith('.json')) continue
      for (const key of tCallKeys(file.text)) used.add(key)
      if (hardcoded.length < 40) hardcoded.push(...hardcodedCopy(file.text, file.rel))
    }
    const usedKeys = [...used].sort()

    const locales = [...messages.entries()].map(([file, keys]) => {
      const locale = file.replace(/\.json$/, '').split('/').pop() ?? file
      const names = Object.keys(keys)
      const missing = usedKeys.filter((key) => !(key in keys)).slice(0, 50)
      const hit = usedKeys.filter((key) => key in keys).length
      return {
        locale,
        file,
        keys: names.length,
        missing,
        coverage: usedKeys.length ? Math.round((hit / usedKeys.length) * 100) : 100,
      }
    })

    const biggest = [...messages.entries()].sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)[0]
    const unused = biggest
      ? Object.keys(biggest[1])
          .filter((key) => !used.has(key))
          .slice(0, 100)
          .map((key) => ({ locale: biggest[0].replace(/\.json$/, '').split('/').pop() ?? biggest[0], key }))
      : []

    return {
      root: scan.dir,
      detected: messages.size > 0,
      used: usedKeys.slice(0, 200),
      locales: locales.sort((a, b) => b.keys - a.keys),
      unused,
      hardcoded: hardcoded.slice(0, 40),
    }
  },
})
