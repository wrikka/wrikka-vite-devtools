// Floating badge + setup panel rendered inside one shadow host so page CSS
// can never leak in and the host page can never see our DOM.

import { SETUP_SNIPPET, hubUrl, type PageStatus } from './shared'

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, sans-serif; }
.wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; }
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 999px; cursor: pointer;
  background: #1c1c22; color: #eee; border: 1px solid #3a3a44;
  font-size: 12px; font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,.35);
  user-select: none;
}
.pill:hover { border-color: #5a5a66; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #888; flex: none; }
.dot.ok { background: #3ddc84; box-shadow: 0 0 6px #3ddc84; }
.dot.warn { background: #f5b83d; box-shadow: 0 0 6px #f5b83d; }
.pill .x, .pill .hub {
  border: 0; background: none; color: #999; cursor: pointer;
  font-size: 12px; line-height: 1; padding: 0 0 0 2px;
}
.pill .x:hover, .pill .hub:hover { color: #fff; }
.panel {
  position: absolute; right: 0; bottom: 40px; width: 280px;
  background: #17171c; color: #e8e8ec; border: 1px solid #3a3a44;
  border-radius: 10px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.45);
  font-size: 12px; line-height: 1.45;
}
.panel h4 { margin: 0 0 6px; font-size: 12.5px; }
.panel p { margin: 0 0 8px; color: #b9b9c4; }
.panel pre {
  margin: 0 0 8px; padding: 8px; border-radius: 6px;
  background: #0e0e12; border: 1px solid #2c2c36;
  font-size: 11px; white-space: pre-wrap; word-break: break-word; color: #cfd8e3;
}
.panel .row { display: flex; gap: 6px; }
.panel button {
  flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #3a3a44;
  background: #26262e; color: #eee; font-size: 11.5px; cursor: pointer;
}
.panel button:hover { background: #30303a; }
.panel button.primary { background: #2f6fed; border-color: #2f6fed; }
.panel .close { position: absolute; top: 6px; right: 8px; }
`

export interface Badge {
  update(status: PageStatus): void
  destroy(): void
}

export function mountBadge(onOpenChat: () => void): Badge | null {
  try {
    if (document.getElementById('wrikka-companion')) return null
    const host = document.createElement('div')
    host.id = 'wrikka-companion'
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>${CSS}</style><div class="wrap"></div>`
    document.documentElement.appendChild(host)

    const wrap = root.querySelector('.wrap') as HTMLElement
    let status: PageStatus | null = null
    let dismissed = false
    let panelOpen = false

    const pill = document.createElement('div')
    pill.className = 'pill'
    const dot = document.createElement('span')
    dot.className = 'dot'
    const label = document.createElement('span')
    label.textContent = 'Wrikka'
    const hub = document.createElement('button')
    hub.className = 'hub'
    hub.textContent = '↗'
    hub.title = 'Open devtools hub'
    const close = document.createElement('button')
    close.className = 'x'
    close.textContent = '×'
    close.title = 'Dismiss'
    pill.append(dot, label, hub, close)

    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.style.display = 'none'

    wrap.append(pill, panel)

    close.addEventListener('click', (e) => {
      e.stopPropagation()
      dismissed = true
      wrap.style.display = 'none'
    })

    hub.addEventListener('click', (e) => {
      e.stopPropagation()
      if (status?.plugin) window.open(hubUrl(status.url), '_blank', 'noopener')
    })

    pill.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.hub, .x')) return
      if (status?.plugin) {
        onOpenChat()
        label.textContent = 'Chat ✓'
        setTimeout(() => { label.textContent = 'Wrikka' }, 1400)
      } else {
        panelOpen = !panelOpen
        renderPanel()
      }
    })

    function renderPanel() {
      const s = status
      if (!s) return
      panel.innerHTML = ''
      const h = document.createElement('h4')
      const p = document.createElement('p')
      const pre = document.createElement('pre')
      pre.textContent = SETUP_SNIPPET
      const row = document.createElement('div')
      row.className = 'row'
      const copy = document.createElement('button')
      copy.className = 'primary'
      copy.textContent = 'Copy setup snippet'
      copy.addEventListener('click', () => void copySnippet(copy))
      const dismiss = document.createElement('button')
      dismiss.textContent = 'Dismiss'
      dismiss.addEventListener('click', () => { panelOpen = false; panel.style.display = 'none' })
      row.append(copy, dismiss)

      if (s.local) {
        h.textContent = 'No devtools detected on this page'
        p.textContent = 'wrikka-vite-devtools serves /__devtools/ and an in-page overlay. Add it to your Vite config:'
      } else {
        h.textContent = 'Running this on a local dev server?'
        p.textContent = 'Set up wrikka-vite-devtools to get the devtools hub, panels and in-page overlay:'
      }
      const x = document.createElement('button')
      x.className = 'close x'
      x.textContent = '×'
      x.addEventListener('click', () => { panelOpen = false; panel.style.display = 'none' })
      panel.append(x, h, p, pre, row)
      panel.style.display = panelOpen ? 'block' : 'none'
    }

    async function copySnippet(btn: HTMLButtonElement) {
      try {
        await navigator.clipboard.writeText(SETUP_SNIPPET)
        btn.textContent = 'Copied ✓'
      } catch {
        const ta = document.createElement('textarea')
        ta.value = SETUP_SNIPPET
        document.body.appendChild(ta)
        ta.select()
        try { document.execCommand('copy') } catch { /* noop */ }
        ta.remove()
        btn.textContent = 'Copied ✓'
      }
      setTimeout(() => { btn.textContent = 'Copy setup snippet' }, 1400)
    }

    return {
      update(s: PageStatus) {
        status = s
        if (dismissed) return
        dot.className = `dot ${s.plugin ? 'ok' : s.local ? 'warn' : ''}`
        hub.style.display = s.plugin ? '' : 'none'
        if (panelOpen) renderPanel()
      },
      destroy() {
        host.remove()
      },
    }
  } catch {
    return null
  }
}
