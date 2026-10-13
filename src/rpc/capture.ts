import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'

const MAX_CAPTURE_BYTES = 10 * 1024 * 1024

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

  return { saveCapture, listCaptures }
}
