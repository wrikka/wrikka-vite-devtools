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

interface Idea {
  n: number
  app: string
  group: string
  problem: string
  impact: 'high' | 'mid' | 'low'
  effort: 'S' | 'M' | 'L'
  /** Dock id — the client SPA route that renders this panel. */
  route: string
}

// Same list the maintenance chat works from — keep the three groups in sync.
const IDEAS: Idea[] = [
  { n: 1, app: 'Theme & Tokens', group: 'Source', problem: 'Audits used utilities against the theme, catching palette hardcodes and stray dark: variants.', impact: 'high', effort: 'S', route: 'theme' },
  { n: 2, app: 'Network', group: 'Runtime', problem: 'Captures fetch/XHR so slow or failing calls can be replayed and handed to the agent.', impact: 'high', effort: 'M', route: 'network' },
  { n: 3, app: 'Runs & Queue', group: 'Agent', problem: 'One view of every agent run with duration, status, cancel and retry.', impact: 'high', effort: 'S', route: 'runs' },
  { n: 4, app: 'MCP Playground', group: 'Agent', problem: 'Lists mounted tools with schemas and invokes them without an external inspector.', impact: 'high', effort: 'S', route: 'mcp-playground' },
  { n: 5, app: 'Performance', group: 'Runtime', problem: 'Web Vitals and slow resources from the real page before asking for an optimization.', impact: 'mid', effort: 'M', route: 'performance' },
  { n: 6, app: 'Console & Logs', group: 'Runtime', problem: 'Merges page console with live agent output and forwards a selection to the agent.', impact: 'mid', effort: 'M', route: 'console' },
  { n: 7, app: 'Bundle', group: 'Build', problem: 'Shows the largest modules, init cost and cycles behind a growing bundle.', impact: 'mid', effort: 'M', route: 'bundle' },
  { n: 8, app: 'Env & Config', group: 'Build', problem: 'Compares env vars referenced in code with .env and redacts the values.', impact: 'mid', effort: 'S', route: 'env' },
  { n: 9, app: 'Visual Diff', group: 'Quality', problem: 'Captures a baseline and diffs it so UI changes show their blast radius.', impact: 'mid', effort: 'M', route: 'visual-diff' },
  { n: 10, app: 'Tests', group: 'Quality', problem: 'Runs the matching test file from the dock and sends failures to the agent.', impact: 'mid', effort: 'M', route: 'tests' },
  { n: 11, app: 'State Snapshots', group: 'Runtime', problem: 'Snapshots route, DOM and storage over time to expose leaks and drift.', impact: 'mid', effort: 'M', route: 'state' },
  { n: 12, app: 'Import Graph', group: 'Build', problem: 'Maps importers and unused exports before a refactor.', impact: 'low', effort: 'M', route: 'imports' },
  { n: 13, app: 'i18n', group: 'Source', problem: 'Finds missing keys, hardcoded copy and per-locale coverage.', impact: 'low', effort: 'M', route: 'i18n' },
  { n: 14, app: 'Security Headers', group: 'Quality', problem: 'Checks CSP, HSTS and COOP on the served HTML before deploy.', impact: 'low', effort: 'S', route: 'security' },
]

const impactTone: Record<Idea['impact'], string> = {
  high: 'text-bad-ink',
  mid: 'text-warn-ink',
  low: 'text-ok-ink',
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
  ['/form.html', 'Form'],
  ['/dashboard.html', 'Dashboard'],
  ['/pricing.html', 'Pricing'],
  ['/kanban.html', 'Kanban'],
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
    <div class="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-2">
      <a class="flex shrink-0 items-center gap-2 rounded-md" href="/" aria-label="wrikka-vite-devtools playground home">
        <span class="flex size-7 items-center justify-center rounded-lg border border-solid border-line bg-accent-soft text-[13px] font-bold text-accent-ink">W</span>
        <span class="hidden text-[12px] font-semibold text-ink sm:inline">wrikka<span class="text-ink-faint">/</span>playground</span>
      </a>
      <nav class="flex items-center gap-0.5 overflow-x-auto" aria-label="Example pages">${links}</nav>
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

function card(idea: Idea): string {
  return `<a class="flex flex-col gap-1 rounded-xl border border-solid border-line bg-surface-raised p-4 transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-control" href="${PANEL_BASE}#/${idea.route}">
    <div class="flex items-center gap-2">
      <span class="font-mono text-[10px] text-ink-faint">${String(idea.n).padStart(2, '0')}</span>
      <span class="text-[13px] font-semibold text-ink">${idea.app}</span>
      <span class="ml-auto rounded-full bg-control px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">${idea.group}</span>
    </div>
    <span class="text-[11px] leading-relaxed text-ink-muted">${idea.problem}</span>
    <div class="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
      <span class="${impactTone[idea.impact]}">${idea.impact} impact</span>
      <span class="text-ink-faint">·</span>
      <span class="text-ink-muted">${idea.effort} effort</span>
    </div>
  </a>`
}

function renderRoadmap(): void {
  const root = el('roadmap')
  if (root) root.innerHTML = IDEAS.map(card).join('')
}

renderNav()
renderPanels()
renderRoadmap()
if (el('status-hub')) void probe()
