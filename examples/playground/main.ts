import 'virtual:uno.css'

const BASE = '/__devtools/'
const PANEL_BASE = `${BASE}wrikka-vite-devtools/`

interface HubIndex {
  base: string
  frames: { id: string; base: string; title: string }[]
}

interface ConnectionMeta {
  backend: string
  configs?: {
    ui?: { dockPreferences?: { defaultMode?: string; defaultPosition?: string } }
  }
}

interface Panel {
  name: string
  desc: string
  tag: 'own' | 'framework' | 'add-on' | 'opt-in'
  href?: string
}

const TAG_CLS: Record<Panel['tag'], string> = {
  own: 'bg-accent-soft text-accent-ink',
  framework: 'bg-ok/20 text-ok-ink',
  'add-on': 'bg-control text-ink-muted',
  'opt-in': 'bg-warn/20 text-warn-ink',
}

const PANELS: Panel[] = [
  { name: 'Comments', desc: 'Inbox, new comment, ideas, diagnostics — the agent console.', tag: 'own', href: PANEL_BASE },
  { name: 'Components', desc: 'Visual grid of every component with refs, exports and a LOC budget.', tag: 'own', href: `${PANEL_BASE}#/components` },
  { name: 'Routes & SEO', desc: 'Route table plus an audit of the HTML the dev server actually serves.', tag: 'own', href: `${PANEL_BASE}#/routes` },
  { name: 'Solid', desc: 'Live owner tree, signals read per owner, unowned signals.', tag: 'framework', href: `${PANEL_BASE}#/solid` },
  { name: 'UnoCSS', desc: 'The inspector served by @unocss/vite, framed as a dock panel.', tag: 'framework' },
  { name: 'Devframe Inspector', desc: 'Mounted frames, their RPC surfaces, and the hub protocol.', tag: 'add-on' },
  { name: 'OG preview', desc: 'Social card as crawlers see it — title, description, image.', tag: 'add-on' },
  { name: 'Accessibility', desc: 'Contrast, focus order, landmarks, and the offending nodes.', tag: 'add-on' },
  { name: 'Git', desc: 'Branch, status, staged diff and log without leaving the app.', tag: 'add-on' },
  { name: 'Assets & Terminals', desc: 'Public asset tree, plus a real shell session in the dock.', tag: 'add-on' },
  { name: 'Data Inspector · Code Server', desc: 'Opt-in frames; install their peers and add the keys.', tag: 'opt-in' },
]

const NAV_LINKS: [href: string, label: string][] = [
  ['/', 'Home'],
  ['/get-started.html', 'Get Started'],
  ['/usage.html', 'Usage'],
]

function el(id: string): HTMLElement | null {
  return document.getElementById(id)
}

function setStat(id: string, value: string, tone: string): void {
  const node = el(id)
  if (!node) return
  node.textContent = value
  node.className = `text-[20px] font-semibold leading-none tabular-nums ${tone}`
}

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } })
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`${path}: ${res.status}`)
  return res.json() as Promise<T>
}

function renderNav(): void {
  const host = el('site-nav')
  if (!host) return
  const path = location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/'
  const links = NAV_LINKS.map(([href, label]) => {
    const active = href === '/' ? path === '/' : path === href
    const cls = active ? 'bg-control font-medium text-ink' : 'text-ink-muted hover:bg-control hover:text-ink'
    return `<a class="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] ${cls}" href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a>`
  }).join('')
  host.innerHTML = `<header class="sticky top-0 z-40 border-b border-solid border-line bg-surface/85 backdrop-blur-md">
    <div class="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-2">
      <a class="flex shrink-0 items-center gap-2 rounded-md" href="/" aria-label="wrikka-vite-devtools home">
        <span class="flex size-7 items-center justify-center rounded-lg border border-solid border-line bg-accent-soft text-[13px] font-bold text-accent-ink">W</span>
        <span class="hidden text-[12px] font-semibold text-ink sm:inline">wrikka<span class="text-ink-faint">/</span>devtools</span>
      </a>
      <nav class="flex items-center gap-0.5 overflow-x-auto" aria-label="Site">${links}</nav>
      <a class="ml-auto shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-hover" href="${BASE}">Open hub</a>
    </div>
  </header>`
}

function panelCard(p: Panel): string {
  const inner = `<span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-solid border-line bg-control text-[12px] font-bold text-accent-ink">${p.name.charAt(0)}</span>
    <span class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="flex items-center gap-2">
        <span class="truncate text-[13px] font-semibold text-ink">${p.name}</span>
        <span class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TAG_CLS[p.tag]}">${p.tag}</span>
      </span>
      <span class="text-[11px] leading-relaxed text-ink-muted">${p.desc}</span>
    </span>`
  const cls = 'group flex items-start gap-3 rounded-xl border border-solid border-line bg-surface-raised p-4 transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-control'
  return p.href ? `<a class="${cls}" href="${p.href}">${inner}</a>` : `<div class="${cls}">${inner}</div>`
}

function renderPanels(): void {
  const root = el('panels')
  if (root) root.innerHTML = PANELS.map(panelCard).join('')
}

async function probe(): Promise<void> {
  const [index, meta] = await Promise.allSettled([json<HubIndex>('__index.json'), json<ConnectionMeta>('__connection.json')])

  if (index.status === 'fulfilled') {
    setStat('status-hub', 'online', 'text-ok-ink')
    setStat('status-frames', String(index.value.frames.length), 'text-ink')
    el('status-frames')?.setAttribute('title', index.value.frames.map((f) => f.title).join(', '))
  } else {
    setStat('status-hub', 'offline', 'text-bad-ink')
    setStat('status-frames', '—', 'text-ink-muted')
  }

  if (meta.status === 'fulfilled') {
    const dock = meta.value.configs?.ui?.dockPreferences
    setStat('status-backend', meta.value.backend, 'text-ink')
    setStat('status-dock', `${dock?.defaultMode ?? 'float'} · ${dock?.defaultPosition ?? '—'}`, 'text-ink')
  } else {
    setStat('status-backend', '—', 'text-ink-muted')
    setStat('status-dock', '—', 'text-ink-muted')
  }
}

renderNav()
renderPanels()
if (el('status-hub')) void probe()
