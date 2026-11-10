// MV3 service worker: context-menu entries for quick setup/hub access.

import { isLocalHost } from './shared'

const MENU_COPY = 'wrikka-copy-snippet'
const MENU_HUB = 'wrikka-open-hub'

try {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.contextMenus.remove(MENU_COPY)
      chrome.contextMenus.remove(MENU_HUB)
    } catch {
      /* first install — nothing to remove */
    }
    chrome.contextMenus.create({
      id: MENU_COPY,
      title: 'Copy Wrikka setup snippet',
      contexts: ['all'],
    })
    chrome.contextMenus.create({
      id: MENU_HUB,
      title: 'Open Wrikka devtools hub',
      contexts: ['all'],
    })
  })

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    try {
      if (info.menuItemId === MENU_COPY && tab?.id != null) {
        // The content script owns page clipboard access; ignore pages without it.
        void chrome.tabs.sendMessage(tab.id, { type: 'wrikka:copy-snippet' }).catch(() => undefined)
      } else if (info.menuItemId === MENU_HUB && tab?.url && isLocalHost(tab.url)) {
        const origin = new URL(tab.url).origin
        void chrome.tabs.create({ url: `${origin}/__devtools/` })
      }
    } catch {
      /* service worker must stay alive — swallow */
    }
  })
} catch {
  /* contextMenus unavailable (e.g. missing permission) — stay a no-op */
}


