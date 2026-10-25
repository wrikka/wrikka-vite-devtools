import type { Plugin } from 'vite'
import { hookHtmlResponse } from './html-stream'

/**
 * The hub injects its client through Vite's `transformIndexHtml`, which only
 * runs for file-backed `index.html`. SSR frameworks (TanStack Start, Nuxt,
 * Svelte server pages) render the document in JS and stream it, so the tag is
 * never injected and the overlay never mounts. This middleware hooks the
 * response stream and inserts the hub client before the first `</body>`,
 * keeping streaming intact.
 */
export function createSsrInjectPlugin(base = '/__devtools/'): Plugin {
  const embedSrc = `${base.endsWith('/') ? base : `${base}/`}embedded.js`
  return {
    name: 'wrikka-vite-devtools:ssr-inject',
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
