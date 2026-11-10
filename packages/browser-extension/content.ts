// Content script: detects wrikka-vite-devtools on the current page, keeps the
// bottom-right badge in sync, and answers popup/background messages.
// Everything is wrapped so a failure can never break the host page.

import { detectStatus, SETUP_SNIPPET, type PageStatus } from './shared'
import { mountBadge } from './badge'

let status: PageStatus | null = null
let badge: ReturnType<typeof mountBadge> = null
let checking = false

async function refresh(force = false): Promise<PageStatus | null> {
  if (checking) return status
  checking = true
  try {
    status = await detectStatus(location.href, force)
    badge?.update(status)
    return status
  } catch {
    return status
  } finally {
    checking = false
  }
}

function boot() {
  try {
    badge = mountBadge(() => {
      try {
        window.dispatchEvent(new CustomEvent('wrikka:open-chat'))
      } catch {
        /* isolated world edge — ignore */
      }
    })
    void refresh(true)

    // SPA navigations don't reload the content script — re-detect on them.
    for (const ev of ['popstate', 'hashchange'] as const) {
      window.addEventListener(ev, () => void refresh())
    }
    for (const fn of ['pushState', 'replaceState'] as const) {
      const orig = history[fn] as (...args: unknown[]) => unknown
      history[fn] = function (this: History, ...args: unknown[]) {
        const r = orig.apply(this, args)
        void refresh()
        return r
      } as typeof history.pushState
    }
    setInterval(() => void refresh(), 4000)

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      try {
        if (msg?.type === 'wrikka:status') {
          void refresh().then((s) => sendResponse(s ?? status))
          return true
        }
        if (msg?.type === 'wrikka:recheck') {
          void refresh(true).then((s) => sendResponse(s ?? status))
          return true
        }
        if (msg?.type === 'wrikka:copy-snippet') {
          void navigator.clipboard
            .writeText(SETUP_SNIPPET)
            .catch(() => undefined)
            .finally(() => sendResponse({ ok: true }))
          return true
        }
      } catch {
        sendResponse(null)
      }
      return false
    })
  } catch {
    /* never break the host page */
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
