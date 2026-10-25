export type Category = 'project' | 'framework' | 'source' | 'runtime' | 'agent' | 'build' | 'quality'

export interface PanelInfo {
  /** Client hash route; the comments workspace is the empty hash. */
  hash: string
  /** Dock id the hub registers — `hub:docks:activate` takes this. */
  dockId: string
  title: string
  description: string
  category: Category
  monogram: string
}

export const CATEGORY_LABEL: Record<Category, string> = {
  project: 'Project',
  framework: 'Framework',
  source: 'Source',
  runtime: 'Runtime',
  agent: 'Agent',
  build: 'Build',
  quality: 'Quality',
}

/** Monogram tile tint per category, so the launcher reads as groups without icons. */
export const CATEGORY_TINT: Record<Category, string> = {
  project: 'bg-accent-soft text-accent-ink',
  framework: 'bg-info/20 text-info-ink',
  source: 'bg-ok/20 text-ok-ink',
  runtime: 'bg-info/20 text-info-ink',
  agent: 'bg-warn/20 text-warn-ink',
  build: 'bg-ok/20 text-ok-ink',
  quality: 'bg-bad/20 text-bad-ink',
}

export const PANELS: PanelInfo[] = [
  {
    hash: '',
    dockId: 'wrikka-vite-devtools',
    title: 'Comments',
    description: 'Inbox, composer, ideas and diagnostics for the in-page capture flow.',
    category: 'project',
    monogram: 'CM',
  },
  {
    hash: 'components',
    dockId: 'components',
    title: 'Components',
    description: 'Visual grid of every component with refs, exports and a LOC budget.',
    category: 'project',
    monogram: 'CO',
  },
  {
    hash: 'routes',
    dockId: 'routes',
    title: 'Routes & SEO',
    description: 'Route table plus an audit of the HTML the dev server actually serves.',
    category: 'project',
    monogram: 'RT',
  },
  {
    hash: 'solid',
    dockId: 'solid',
    title: 'Solid',
    description: 'Live owner tree, signals read per owner, and unowned signals.',
    category: 'framework',
    monogram: 'SO',
  },
  {
    hash: 'theme',
    dockId: 'theme',
    title: 'Theme & Tokens',
    description: 'Theme tokens versus the utilities actually used in source.',
    category: 'source',
    monogram: 'TH',
  },
  {
    hash: 'network',
    dockId: 'network',
    title: 'Network',
    description: 'Fetch/XHR captured from the page, with status, duration and replay.',
    category: 'runtime',
    monogram: 'NW',
  },
  {
    hash: 'runs',
    dockId: 'runs',
    title: 'Runs & Queue',
    description: 'Every agent run with duration, status, cancel and retry.',
    category: 'agent',
    monogram: 'RN',
  },
  {
    hash: 'mcp-playground',
    dockId: 'mcp-playground',
    title: 'MCP Playground',
    description: 'The aggregated toolset, grouped by app and callable in place.',
    category: 'agent',
    monogram: 'MC',
  },
  {
    hash: 'performance',
    dockId: 'performance',
    title: 'Performance',
    description: 'Web Vitals and slow resources measured on the real page.',
    category: 'runtime',
    monogram: 'PF',
  },
  {
    hash: 'console',
    dockId: 'console',
    title: 'Console & Logs',
    description: 'Page console merged with agent streams, searchable and sendable.',
    category: 'runtime',
    monogram: 'LG',
  },
  {
    hash: 'bundle',
    dockId: 'bundle',
    title: 'Bundle',
    description: 'Largest client modules from the Vite module graph.',
    category: 'build',
    monogram: 'BU',
  },
  {
    hash: 'env',
    dockId: 'env',
    title: 'Env & Config',
    description: 'Env vars referenced in code versus the .env files, redacted.',
    category: 'build',
    monogram: 'EN',
  },
  {
    hash: 'visual-diff',
    dockId: 'visual-diff',
    title: 'Visual Diff',
    description: 'Saved captures compared against the live page.',
    category: 'quality',
    monogram: 'VD',
  },
  {
    hash: 'tests',
    dockId: 'tests',
    title: 'Tests',
    description: 'Locate the spec for a source file and run it from the dock.',
    category: 'quality',
    monogram: 'TS',
  },
  {
    hash: 'state',
    dockId: 'state',
    title: 'State Snapshots',
    description: 'Signals, route and storage sampled by the overlay over time.',
    category: 'runtime',
    monogram: 'ST',
  },
  {
    hash: 'imports',
    dockId: 'imports',
    title: 'Import Graph',
    description: 'Importers and unused exports per file before a refactor.',
    category: 'build',
    monogram: 'IM',
  },
  {
    hash: 'i18n',
    dockId: 'i18n',
    title: 'i18n',
    description: 'Missing keys, hardcoded copy and per-locale coverage.',
    category: 'source',
    monogram: 'I8',
  },
  {
    hash: 'security',
    dockId: 'security',
    title: 'Security Headers',
    description: 'CSP, HSTS and COOP on the served HTML before deploy.',
    category: 'quality',
    monogram: 'SC',
  },
]

const byHash = new Map(PANELS.map((p) => [p.hash, p]))

/** Panel for a client hash (`#/theme` or `theme`); the comments workspace maps to `''`. */
export function panelForHash(hash: string): PanelInfo | undefined {
  const key = hash.replace(/^#\//, '')
  return byHash.get(key)
}

/** Panel URLs live under the frame, which is the hub mount plus this frame's id. */
export function frameBase(): string {
  const path = location.pathname.replace(/\/+$/, '')
  return `${path}/`
}

/** The hub mount is one segment above the frame base — `/__devtools/` in the default setup. */
export function hubBase(): string {
  const path = location.pathname.replace(/\/+$/, '')
  const at = path.lastIndexOf('/')
  return at > 0 ? `${path.slice(0, at)}/` : '/__devtools/'
}

/** Link to one panel served by this frame, for the hub to open directly. */
export function panelUrl(hash: string): string {
  return hash ? `${frameBase()}#/${hash}` : frameBase()
}
