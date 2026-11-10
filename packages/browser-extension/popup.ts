// Popup: shows detection status for the active tab and offers quick actions.

import { detectStatus, SETUP_SNIPPET, hubUrl, type PageStatus } from './shared'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const dot = $('dot')
const urlEl = $('url')
const localEl = $('local')
const pluginEl = $('plugin')
const hubBtn = $('hub') as HTMLButtonElement
const statusEl = $('status')

function render(s: PageStatus | null) {
  dot.className = `dot ${s?.plugin ? 'ok' : s?.local ? 'warn' : ''}`
  urlEl.textContent = s?.url ?? ''
  localEl.textContent = s ? (s.local ? 'yes' : 'no') : '—'
  pluginEl.textContent = s ? (s.plugin ? 'yes' : 'no') : '—'
  hubBtn.disabled = !s?.plugin
}

async function activeTabUrl(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.url ?? null
  } catch {
    return null
  }
}

async function check(force = false): Promise<void> {
  statusEl.textContent = 'Checking…'
  const url = await activeTabUrl()
  if (!url) {
    statusEl.textContent = 'No active tab.'
    render(null)
    return
  }
  // Prefer the content script (it sees the page's overlay flag); fall back to
  // a direct fetch of the plugin index from the extension context.
  let s: PageStatus | null = null
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id != null) s = await chrome.tabs.sendMessage(tab.id, { type: 'wrikka:status' })
  } catch {
    s = null
  }
  if (!s) s = await detectStatus(url, force).catch(() => null)
  render(s)
  statusEl.textContent = s ? `Checked ${new Date(s.checkedAt).toLocaleTimeString()}` : 'Could not check this page.'
}

hubBtn.addEventListener('click', async () => {
  const url = await activeTabUrl()
  if (url) await chrome.tabs.create({ url: hubUrl(url) })
})

document.getElementById('copy')!.addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement
  try {
    await navigator.clipboard.writeText(SETUP_SNIPPET)
    btn.textContent = 'Copied ✓'
  } catch {
    btn.textContent = 'Copy failed'
  }
  setTimeout(() => { btn.textContent = 'Copy setup snippet' }, 1400)
})

document.getElementById('recheck')!.addEventListener('click', () => {
  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => (tab?.id != null ? chrome.tabs.sendMessage(tab.id, { type: 'wrikka:recheck' }) : null))
    .catch(() => null)
    .finally(() => void check(true))
})

void check()
