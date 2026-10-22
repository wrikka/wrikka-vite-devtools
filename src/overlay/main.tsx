import 'virtual:uno.css'
import './overlay.css'
import { render } from 'solid-js/web'
import { hubUrl, isHubDocument } from './hub'
import { mountShadowHost } from './host'
import App from './ui/App'
import { connectPanelApi } from '../ui/connect'

declare global {
  interface Window {
    __WRIKKA_VITE_DEVTOOLS_OVERLAY__?: boolean
  }
}

// The hub dock executor calls the module's `default`; direct injection relies on
// the self-call below. Both paths are guarded so the toolbar mounts exactly once.
export default async function mountOverlay(): Promise<void> {
  if (window.__WRIKKA_VITE_DEVTOOLS_OVERLAY__) return
  window.__WRIKKA_VITE_DEVTOOLS_OVERLAY__ = true
  if (isHubDocument(import.meta.url, location.pathname)) return
  await boot()
}

await mountOverlay()

async function boot(): Promise<void> {
  const api = await connectPanelApi()
  const root = mountShadowHost()
  render(() => <App api={api} root={root} hub={hubUrl(import.meta.url)} />, root)
}
