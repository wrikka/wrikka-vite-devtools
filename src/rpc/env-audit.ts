import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { projectRoot } from './context'
import { scanSource } from './scan'

/** Vite's own `import.meta.env` members; never report these as user variables. */
const BUILTIN = new Set(['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL', 'MODE'])

/** Env files are read by name only — values never leave the server. */
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local', '.env.example']

export function envRefs(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(m[1]!)
  for (const m of text.matchAll(/\bimport\.meta\.env\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g)) out.add(m[1]!)
  for (const m of text.matchAll(/\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(m[1]!)
  for (const m of text.matchAll(/\bprocess\.env\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g)) out.add(m[1]!)
  return [...out].filter((n) => !BUILTIN.has(n))
}

export function parseEnvKeys(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^export\s+/, '')
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(trimmed)
    if (m) out.push(m[1]!)
  }
  return [...new Set(out)]
}

export function isSecretName(name: string): boolean {
  return /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|AUTH|DSN|CONN|SALT|COOKIE)/i.test(name)
}

async function readEnvFiles(root: string): Promise<{ file: string; keys: string[] }[]> {
  const found: { file: string; keys: string[] }[] = []
  let names: string[]
  try {
    names = await readdir(root)
  } catch {
    return found
  }
  for (const name of ENV_FILES) {
    if (!names.includes(name)) continue
    try {
      const full = join(root, name)
      const info = await stat(full)
      if (!info.isFile() || info.size > 256 * 1024) continue
      found.push({ file: name, keys: parseEnvKeys(await readFile(full, 'utf8')) })
    } catch {
      /* unreadable env file — skip it */
    }
  }
  return found
}

export const auditEnv = defineRpcFunction({
  name: 'audit-env',
  type: 'query',
  agent: {
    description:
      'Compare environment variables referenced in source (`import.meta.env.X`, `process.env.X`) with the keys defined in `.env*` files. Returns names and defining files only — never values',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    root: z.string(),
    scanned: z.number(),
    envFiles: z.array(z.object({ file: z.string(), keys: z.array(z.string()) })),
    refs: z.array(
      z.object({
        name: z.string(),
        files: z.array(z.string()),
        definedIn: z.array(z.string()),
        publicVar: z.boolean(),
        secret: z.boolean(),
        status: z.enum(['ok', 'missing']),
      }),
    ),
    unused: z.array(z.object({ name: z.string(), definedIn: z.array(z.string()) })),
    totals: z.object({ refs: z.number(), defined: z.number(), missing: z.number(), unused: z.number() }),
  }),
  handler: async ({ dir } = {}) => {
    const root = projectRoot()
    const scan = await scanSource({ dir })
    const envFiles = await readEnvFiles(root)
    const defined = new Map<string, string[]>()
    for (const f of envFiles) for (const key of f.keys) defined.set(key, [...(defined.get(key) ?? []), f.file])

    const refFiles = new Map<string, Set<string>>()
    for (const file of scan.files) {
      for (const name of envRefs(file.text)) {
        const set = refFiles.get(name) ?? new Set<string>()
        set.add(file.rel)
        refFiles.set(name, set)
      }
    }

    const refs = [...refFiles.entries()]
      .map(([name, files]) => ({
        name,
        files: [...files].slice(0, 5),
        definedIn: defined.get(name) ?? [],
        publicVar: name.startsWith('VITE_'),
        secret: isSecretName(name),
        status: defined.has(name) ? ('ok' as const) : ('missing' as const),
      }))
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'missing' ? -1 : 1))

    const unused = [...defined.entries()]
      .filter(([name]) => !refFiles.has(name))
      .map(([name, definedIn]) => ({ name, definedIn }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      root: scan.dir,
      scanned: scan.files.length,
      envFiles: envFiles.map((f) => ({ file: f.file, keys: f.keys })),
      refs,
      unused,
      totals: {
        refs: refs.length,
        defined: defined.size,
        missing: refs.filter((r) => r.status === 'missing').length,
        unused: unused.length,
      },
    }
  },
})
