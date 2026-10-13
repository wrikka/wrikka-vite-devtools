import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import pkg from '../package.json'

const MAX_ENTRIES = 200
const DEFAULT_LIMIT = 50

const DirEntrySchema = z.object({
  name: z.string(),
  kind: z.enum(['file', 'dir', 'other']),
  size: z.number().nullable(),
})

export const getMeta = defineRpcFunction({
  name: 'get-meta',
  type: 'static',
  args: [],
  agent: { description: 'Get tool name, version, platform and server working directory' },
  returns: z.object({
    tool: z.string(),
    version: z.string(),
    platform: z.string(),
    cwd: z.string(),
    generatedAt: z.string(),
  }),
  handler: async () => ({
    tool: pkg.name,
    version: pkg.version,
    platform: `${process.platform} ${process.arch}`,
    cwd: process.cwd(),
    generatedAt: new Date().toISOString(),
  }),
})

export const scanDir = defineRpcFunction({
  name: 'scan-dir',
  type: 'query',
  agent: { description: 'List entries in a directory (relative to server cwd), capped at 200' },
  args: [z.object({ path: z.string().optional(), limit: z.number().optional() })],
  returns: z.object({
    dir: z.string(),
    entries: z.array(DirEntrySchema),
    truncated: z.boolean(),
  }),
  handler: async ({ path = '.', limit = DEFAULT_LIMIT }) => {
    const dir = resolve(process.cwd(), path)
    const dirents = await readdir(dir, { withFileTypes: true })
    const capped = dirents.slice(0, Math.min(limit, MAX_ENTRIES))
    const entries = await Promise.all(
      capped.map(async (d) => {
        let size: number | null = null
        try {
          if (d.isFile()) size = (await stat(join(dir, d.name))).size
        } catch {
          size = null
        }
        const kind: 'dir' | 'file' | 'other' = d.isDirectory()
          ? 'dir'
          : d.isFile()
            ? 'file'
            : 'other'
        return { name: d.name, kind, size }
      }),
    )
    return { dir, entries, truncated: dirents.length > capped.length }
  },
})
