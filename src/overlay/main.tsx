import 'virtual:uno.css'
import './overlay.css'
import { render } from 'solid-js/web'
import { connectDevframe } from 'devframe/client'
import { mountShadowHost } from './host'
import App from './ui/App'
import type { OverlayApi } from './api'

declare global {
  interface Window {
    __DEVFRA_OVERLAY__?: boolean
  }
}

// The hub dock executor calls the module's `default`; direct injection relies on
// the self-call below. Both paths are guarded so the toolbar mounts exactly once.
export default async function mountOverlay(): Promise<void> {
  if (window.__DEVFRA_OVERLAY__) return
  window.__DEVFRA_OVERLAY__ = true
  await boot()
}

await mountOverlay()

async function boot(): Promise<void> {
  const scope = (await connectDevframe()).scope('use-devfra')
  const rpc = scope.rpc as unknown as {
    call(id: string, args?: unknown): Promise<any>
    streaming: { subscribe<T>(channel: string, id: string): AsyncIterable<T> }
  }
  const api: OverlayApi = {
    call: (id, args) => rpc.call(id, args),
    subscribe: (channel, id) => rpc.streaming.subscribe<string>(channel, id),
  }

  const root = mountShadowHost()
  render(() => <App api={api} root={root} />, root)
}
