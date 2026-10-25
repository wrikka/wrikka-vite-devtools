import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { assertCan } from './access'

const MAX_CAPTURE_BYTES = 10 * 1024 * 1024
/** Filenames come from the client — never let them escape the captures dir. */
const SAFE_NAME = /^[A-Za-z0-9._-]+\.png$/

export interface CaptureRpcDeps {
  storageDir: string
}

function slugPage(page: string): string {
  return page
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'page'
}

export function createCaptureRpc(deps: CaptureRpcDeps) {
  const dir = join(deps.storageDir, 'captures')

  const saveCapture = defineRpcFunction({
    name: 'save-capture',
    type: 'action',
    jsonSerializable: true,
    args: [z.object({ dataUrl: z.string().startsWith('data:image/png;base64,'), page: z.string().max(500) })],
    returns: z.object({ path: z.string(), bytes: z.number() }),
    agent: { description: 'internal: store a base64 PNG sent by the comment overlay; returns its file path' },
    handler: async ({ dataUrl, page }) => {
      assertCan('capture:write')
      const buffer = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64')
      if (buffer.byteLength > MAX_CAPTURE_BYTES) throw new Error('capture too large (max 10 MiB)')
      await mkdir(dir, { recursive: true })
      const file = join(dir, `${Date.now()}-${slugPage(page)}.png`)
      await writeFile(file, buffer)
      return { path: file, bytes: buffer.byteLength }
    },
  })

  const listCaptures = defineRpcFunction({
    name: 'list-captures',
    type: 'query',
    jsonSerializable: true,
    args: [],
    agent: { description: 'List saved page-capture PNG files (newest first) with their absolute paths' },
    returns: z.object({ files: z.array(z.object({ name: z.string(), path: z.string() })) }),
    handler: async () => {
      let names: string[] = []
      try {
        names = (await readdir(dir)).filter((n) => n.endsWith('.png'))
      } catch {
        names = []
      }
      names.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      return { files: names.slice(0, 50).map((name) => ({ name, path: join(dir, name) })) }
    },
  })

  const readCapture = defineRpcFunction({
    name: 'read-capture',
    type: 'query',
    jsonSerializable: true,
    args: [z.object({ name: z.string().min(5).max(120) })],
    agent: {
      description:
        'Read a saved capture PNG by filename from list-captures and return it as a data URL (used by the visual-diff panel)',
    },
    returns: z.object({ name: z.string(), dataUrl: z.string(), bytes: z.number() }),
    handler: async ({ name }) => {
      if (!SAFE_NAME.test(name)) throw new Error('invalid capture name')
      const file = join(dir, name)
      const buffer = await readFile(file)
      if (buffer.byteLength > MAX_CAPTURE_BYTES) throw new Error('capture too large (max 10 MiB)')
      return {
        name,
        dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
        bytes: buffer.byteLength,
      }
    },
  })

  return { saveCapture, listCaptures, readCapture }
}
