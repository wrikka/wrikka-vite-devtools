import type { Plugin } from 'vite'
import type { ServerResponse } from 'node:http'

const CLOSE = Buffer.from('</body>')
/** Longest tag split across two stream chunks we must not lose. */
const HOLD = CLOSE.length - 1

/**
 * The hub injects its client through Vite's `transformIndexHtml`, which only
 * runs for file-backed `index.html`. SSR frameworks (TanStack Start, Nuxt,
 * Svelte server pages) render the document in JS and stream it, so the tag is
 * never injected and the overlay never mounts. This middleware hooks the
 * response stream and inserts the hub client before the first `</body>`,
 * keeping streaming intact.
 */
export function createSsrInjectPlugin(base = '/__devframes/'): Plugin {
  const embedSrc = `${base.endsWith('/') ? base : `${base}/`}embedded.js`
  return {
    name: 'use-devfra:ssr-inject',
    enforce: 'pre',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!(req.headers.accept ?? '').includes('text/html')) return next()
        hookHtmlResponse(res, `<script type="module" src="${embedSrc}"></script>`, embedSrc)
        next()
      })
    },
  }
}

export function hookHtmlResponse(res: ServerResponse, tag: string, embedSrc: string): void {
  const write = res.write.bind(res)
  const end = res.end.bind(res)
  const tagBuf = Buffer.from(tag, 'utf8')
  const needle = Buffer.from(embedSrc, 'utf8')
  let pending = Buffer.alloc(0)
  let injected = false
  /** Not streamed HTML — pass everything through untouched. */
  let passThrough = false

  const check = () => {
    if (injected || passThrough) return true
    const type = String(res.getHeader('content-type') ?? '')
    // A declared length would go stale once bytes are inserted.
    passThrough = !type.includes('text/html') || res.getHeader('content-length') !== undefined
    return passThrough
  }

  interface Args {
    chunk: string | Uint8Array | undefined
    enc: string | undefined
    cb: (() => void) | undefined
  }
  const split = (chunk: unknown, encoding: unknown, callback: unknown): Args => {
    if (typeof chunk === 'function') return { chunk: undefined, enc: undefined, cb: chunk as unknown as () => void }
    if (typeof encoding === 'function') return { chunk: chunk as Args['chunk'], enc: undefined, cb: encoding as unknown as () => void }
    return {
      chunk: chunk as Args['chunk'],
      enc: typeof encoding === 'string' ? encoding : undefined,
      cb: callback as Args['cb'],
    }
  }

  const toBuffer = (chunk: Args['chunk'], encoding: Args['enc']): Buffer | null => {
    if (chunk == null) return null
    if (typeof chunk === 'string') return Buffer.from(chunk, (encoding ?? 'utf8') as BufferEncoding)
    return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
  }

  function handle(a: Args, final: boolean): boolean {
    if (check()) {
      if (final) end(a.chunk as never, a.enc as never, a.cb as never)
      else return write(a.chunk as never, a.enc as never, a.cb as never)
      return true
    }
    const buf = toBuffer(a.chunk, a.enc)
    const combined = buf?.length ? (pending.length ? Buffer.concat([pending, buf]) : buf) : pending
    pending = Buffer.alloc(0)
    let out = combined
    if (!injected) {
      const at = combined.indexOf(CLOSE)
      if (at >= 0) {
        injected = true
        // The hub's own transform may already have covered an SPA document.
        if (!combined.subarray(0, at).includes(needle)) {
          out = Buffer.concat([combined.subarray(0, at), tagBuf, combined.subarray(at)])
        }
      } else if (!final) {
        const keep = Math.min(HOLD, combined.length)
        out = combined.subarray(0, combined.length - keep)
        pending = Buffer.from(combined.subarray(combined.length - keep))
      }
    }
    if (final) {
      if (out.length > 0) write(out)
      if (a.cb) end(a.cb)
      else end()
      return true
    }
    if (out.length > 0) return a.cb ? write(out, a.cb) : write(out)
    a.cb?.()
    return true
  }

  res.write = ((chunk: unknown, encoding?: unknown, callback?: unknown) =>
    handle(split(chunk, encoding, callback), false)) as typeof res.write
  res.end = ((chunk?: unknown, encoding?: unknown, callback?: unknown) => {
    handle(split(chunk, encoding, callback), true)
    return res
  }) as typeof res.end
}
