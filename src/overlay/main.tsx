import 'virtual:uno.css'
import './overlay.css'
import { render } from 'solid-js/web'
import { hubUrl, isHubDocument } from './hub'
import { mountShadowHost } from './host'
import App from './ui/App'
import { connectPanelApi } from '../ui/connect'
import { startCollectors } from './collectors'

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
  if (isMutedEmbed()) return
  await boot()
}

// Canvas previews load host routes in an iframe; the overlay must stay out of
// them or every preview would report into the Console/Network panels. The query
// flag covers the first load, the frame attribute survives in-app navigations.
function isMutedEmbed(): boolean {
  if (new URLSearchParams(location.search).get('__wrikka-overlay') === 'off') return true
  return window.frameElement?.hasAttribute('data-wrikka-preview') === true
}

await mountOverlay()

async function boot(): Promise<void> {
  const api = await connectPanelApi()
  startCollectors(api)
  const root = mountShadowHost()
  render(() => <App api={api} hub={hubUrl(import.meta.url)} />, root)
}
