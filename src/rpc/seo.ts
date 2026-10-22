import { defineRpcFunction } from 'devframe'
import { z } from 'zod'

const CONCURRENCY = 4
const TIMEOUT_MS = 8_000
const MAX_ROUTES = 60

const IssueSchema = z.object({
  level: z.enum(['bad', 'warn']),
  what: z.string(),
})

const AuditSchema = z.object({
  path: z.string(),
  url: z.string(),
  status: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  og: z.record(z.string(), z.string()),
  twitter: z.record(z.string(), z.string()),
  canonical: z.string().optional(),
  lang: z.string().optional(),
  h1: z.number(),
  bytes: z.number(),
  ms: z.number(),
  issues: z.array(IssueSchema),
})

export type SeoRow = z.infer<typeof AuditSchema>
export type SeoIssue = z.infer<typeof IssueSchema>
export interface SeoReport {
  rows: SeoRow[]
  origin: string
}

const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '::1'])

/** Only the dev server on this machine — the hub runs unattended, so no outbound fetches. */
export function assertLocalOrigin(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('origin must be http(s)')
  if (!PRIVATE_HOSTS.has(url.hostname)) throw new Error(`refused: ${url.hostname} is not a local dev origin`)
  return url
}

function attr(html: string, re: RegExp): string | undefined {
  const m = re.exec(html)
  return m?.[1] ? decodeEntities(m[1]) : undefined
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/** Meta tags grouped by `property`/`name` prefix, e.g. og / twitter. */
export function metaByPrefix(html: string, prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const key = /(?:property|name)=["']([^"']+)["']/i.exec(tag)?.[1]
    const content = /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (key?.startsWith(`${prefix}:`) && content !== undefined) out[key.slice(prefix.length + 1)] = decodeEntities(content)
  }
  return out
}

export function judge(row: Omit<SeoRow, 'issues'>): SeoIssue[] {
  const issues: SeoIssue[] = []
  const push = (level: 'bad' | 'warn', what: string): void => void issues.push({ level, what })
  /** -1 is the abort sentinel, 0 is a fetch that threw before a response. */
  if (row.status === -1) push('bad', 'request timed out')
  else if (row.status === 0) push('bad', 'no response from the dev server')
  else if (row.status >= 400) push('bad', `http ${row.status}`)
  if (!row.title) push('bad', 'no <title>')
  else if (row.title.length < 10) push('warn', `title too short (${row.title.length})`)
  else if (row.title.length > 60) push('warn', `title too long (${row.title.length})`)
  if (!row.description) push('bad', 'no meta description')
  else if (row.description.length < 50) push('warn', `description too short (${row.description.length})`)
  else if (row.description.length > 160) push('warn', `description too long (${row.description.length})`)
  if (!row.og.image) push('warn', 'no og:image')
  if (!row.og.title) push('warn', 'no og:title')
  if (!row.twitter.card) push('warn', 'no twitter:card')
  if (!row.canonical) push('warn', 'no canonical link')
  if (!row.lang) push('warn', 'html has no lang attribute')
  if (row.h1 === 0) push('warn', 'no h1 in the served html')
  else if (row.h1 > 1) push('warn', `${row.h1} h1 elements`)
  return issues
}

async function auditOne(origin: URL, path: string): Promise<Omit<SeoRow, 'issues'>> {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, origin)
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let status = 0
  let html = ''
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/html', 'user-agent': 'wrikka-vite-devtools-seo-audit' },
    })
    status = res.status
    html = await res.text()
  } catch (err) {
    html = ''
    status = err instanceof Error && err.name === 'AbortError' ? -1 : 0
  } finally {
    clearTimeout(timer)
  }
  const head = html.slice(0, Math.max(html.indexOf('</head>'), 4000))
  return {
    path: url.pathname,
    url: url.href,
    status,
    title: attr(head, /<title[^>]*>([^<]*)<\/title>/i),
    description: attr(head, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
      attr(head, /<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
    og: metaByPrefix(head, 'og'),
    twitter: metaByPrefix(head, 'twitter'),
    canonical: attr(head, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i),
    lang: attr(html.slice(0, 2000), /<html\b[^>]*lang=["']([^"']*)["']/i),
    h1: (html.match(/<h1\b/gi) ?? []).length,
    bytes: html.length,
    ms: Date.now() - started,
  }
}

export const auditSeo = defineRpcFunction({
  name: 'audit-seo',
  type: 'query',
  agent: {
    description:
      'Fetch each route from the local dev server and report the served <title>, meta description, og/twitter tags, canonical, lang and h1 count with pass-or-warn issues per path (localhost origins only)',
  },
  args: [
    z.object({
      origin: z.string().min(1),
      paths: z.array(z.string()).min(1).max(MAX_ROUTES),
    }),
  ],
  returns: z.object({ rows: z.array(AuditSchema), origin: z.string() }),
  handler: async ({ origin, paths }) => {
    const base = assertLocalOrigin(origin)
    const queue = paths.slice(0, MAX_ROUTES)
    const rows: SeoRow[] = []
    let cursor = 0

    async function worker(): Promise<void> {
      while (cursor < queue.length) {
        const path = queue[cursor++]!
        const partial = await auditOne(base, path)
        rows.push({ ...partial, issues: judge(partial) })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
    rows.sort((a, b) => a.path.localeCompare(b.path))
    return { rows, origin: base.origin }
  },
})
