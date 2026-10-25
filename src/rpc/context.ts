import type { ViteDevServer } from 'vite'

/**
 * The Vite project the hub is mounted into. The plugin fills this in
 * `configResolved` / `configureServer`; RPC handlers read it when they run,
 * so scanners see the served project rather than the library's own cwd.
 */
export interface ProjectContext {
  root?: string
  server?: ViteDevServer
  /** Hub mount base (`/__devtools/`), so server-side proxies can reach the hub routes. */
  base?: string
}

export const projectContext: ProjectContext = {}

export function projectRoot(): string {
  return projectContext.root ?? process.cwd()
}

/**
 * `http://<bound-host>:<port><path>` for the running dev server. The host must
 * come from `server.httpServer.address()`: a Vite server started without a
 * host binds `::1` only, and a hardcoded `127.0.0.1` then fails to connect.
 */
export function devServerOrigin(path = '/'): string | undefined {
  const server = projectContext.server
  if (!server) return undefined
  const address = server.httpServer?.address()
  if (typeof address === 'object' && address) {
    const ipv6 = address.address.includes(':')
    const wildcard = address.address === '::' || address.address === '0.0.0.0'
    const host = wildcard ? 'localhost' : ipv6 ? `[${address.address}]` : address.address
    return `http://${host}:${address.port}${path}`
  }
  return `http://localhost:${server.config.server.port ?? 5173}${path}`
}
