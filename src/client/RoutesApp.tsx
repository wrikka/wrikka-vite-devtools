import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { RoutesReport } from '../rpc/routes'
import type { SeoReport, SeoRow } from '../rpc/seo'
import type { PanelApi } from '../ui/api'
import {
  btn,
  card,
  chip,
  chipOn,
  empty,
  field,
  hint,
  kindTone,
  page,
  pageHead,
  row,
  stat,
  statLabel,
  statRow,
  statValue,
  title,
  tonePill,
} from '../ui/bits'
import { mergeSeo } from './mergeSeo'
import RouteDetail from './RouteDetail'

const ORIGIN_KEY = 'wrikka:seo-origin'
const DEFAULT_ORIGIN = 'http://localhost:5173'

type KindFilter = 'all' | 'layout' | 'index' | 'page' | 'not-found'
const KINDS: KindFilter[] = ['all', 'layout', 'index', 'page', 'not-found']

/** Issue severity → the card's left edge, so a long route list scans by color. */
function edgeOf(seo: SeoRow | undefined): string {
  if (!seo) return 'border-l-line'
  if (seo.issues.some((i) => i.level === 'bad')) return 'border-l-bad'
  if (seo.issues.length > 0) return 'border-l-warn'
  return 'border-l-ok'
}

export interface RoutesPanelProps {
  api: PanelApi
  /** Absolute project root, so editor links resolve. */
  root(): string
}

export default function RoutesApp(p: RoutesPanelProps) {
  const [report, setReport] = createSignal<RoutesReport>()
  const [seo, setSeo] = createSignal<Map<string, SeoRow>>(new Map())
  const [origin, setOrigin] = createSignal(localStorage.getItem(ORIGIN_KEY) || DEFAULT_ORIGIN)
  const [busy, setBusy] = createSignal(false)
  const [msg, setMsg] = createSignal('reading route files…')
  const [query, setQuery] = createSignal('')
  const [kind, setKind] = createSignal<KindFilter>('all')
  const [issuesOnly, setIssuesOnly] = createSignal(false)

  onMount(() => void load())

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('list-routes', {})) as RoutesReport
      setReport(res)
      setSeo(new Map())
      setMsg(
        res.detected === 'none'
          ? 'no route folder found (src/routes, src/pages, …)'
          : `${res.routes.length} routes · ${res.detected}`,
      )
    } catch (err) {
      setMsg(`route scan failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function audit(): Promise<void> {
    const routes = report()?.routes ?? []
    const statics = routes.filter((r) => r.params.length === 0).map((r) => r.path)
    if (statics.length === 0) {
      setMsg('nothing to fetch — every route takes a param, or none were found.')
      return
    }
    setBusy(true)
    localStorage.setItem(ORIGIN_KEY, origin())
    setMsg(`fetching ${statics.length} paths from ${origin()}…`)
    try {
      const res = (await p.api.call('audit-seo', { origin: origin(), paths: statics })) as SeoReport
      setSeo(mergeSeo(routes, res.rows))
      const bad = res.rows.filter((r) => r.issues.some((i) => i.level === 'bad')).length
      const warn = res.rows.filter((r) => r.issues.some((i) => i.level === 'warn')).length
      setMsg(`served html: ${res.rows.length} fetched · ${bad} broken · ${warn} warnings`)
    } catch (err) {
      setMsg(`audit failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const stats = createMemo(() => {
    const routes = report()?.routes ?? []
    let bad = 0
    let warn = 0
    for (const row of seo().values()) {
      if (row.issues.some((i) => i.level === 'bad')) bad += 1
      else if (row.issues.length > 0) warn += 1
    }
    return {
      routes: routes.length,
      dynamic: routes.filter((r) => r.params.length > 0).length,
      audited: seo().size,
      bad,
      warn,
    }
  })

  const rows = createMemo(() => {
    const all = report()?.routes ?? []
    const needle = query().trim().toLowerCase()
    const map = seo()
    return all.filter(
      (r) =>
        (kind() === 'all' || r.kind === kind()) &&
        (!needle || r.path.toLowerCase().includes(needle) || r.file.toLowerCase().includes(needle)) &&
        (!issuesOnly() || (map.get(r.path)?.issues.length ?? 0) > 0),
    )
  })

  return (
    <div class={page}>
      <div class={pageHead}>
        <h1 class={title}>Routes &amp; SEO</h1>
        <span class={`${hint} mr-auto`}>{msg()}</span>
        <button class={btn} disabled={busy()} onClick={() => void load()}>
          {busy() ? 'working…' : 'Rescan source'}
        </button>
      </div>

      <div class={statRow}>
        <div class={stat}>
          <span class={statValue}>{stats().routes}</span>
          <span class={statLabel}>routes</span>
        </div>
        <div class={stat}>
          <span class={statValue}>{stats().dynamic}</span>
          <span class={statLabel}>with params</span>
        </div>
        <div class={stat}>
          <span class={statValue}>{stats().audited}</span>
          <span class={statLabel}>fetched html</span>
        </div>
        <div class={stat}>
          <span class={`${statValue} ${stats().bad > 0 ? 'text-bad-ink' : stats().warn > 0 ? 'text-warn-ink' : 'text-ink-faint'}`}>
            {stats().bad}
          </span>
          <span class={statLabel}>{stats().warn > 0 ? `${stats().warn} warnings` : 'with issues'}</span>
        </div>
      </div>

      <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
        <div class={row}>
          <input
            class={`${field} max-w-64 font-mono`}
            aria-label="Dev server origin"
            placeholder={DEFAULT_ORIGIN}
            value={origin()}
            onInput={(e) => setOrigin(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void audit()
            }}
          />
          <button class={btn} disabled={busy()} onClick={() => void audit()}>
            Audit served HTML
          </button>
          <span class={`${hint} ml-auto`}>read-only fetch of each static path</span>
        </div>
        <input
          class={`${field} font-mono`}
          aria-label="Filter routes"
          placeholder="filter by path or file"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <div class={row}>
          <For each={KINDS}>{(k) => (
            <button class={`${chip} ${kind() === k ? chipOn : ''}`} aria-pressed={kind() === k} onClick={() => setKind(k)}>
              {k}
            </button>
          )}</For>
          <button
            class={`${chip} ${issuesOnly() ? chipOn : ''}`}
            aria-pressed={issuesOnly()}
            disabled={seo().size === 0}
            onClick={() => setIssuesOnly(!issuesOnly())}
          >
            with issues only
          </button>
        </div>
      </div>

      <Show when={report()?.detected === 'none'}>
        <div class={empty}>
          <p class="m-0 text-[13px] text-ink">No route folder found</p>
          <p class={`${hint} mt-1`}>TanStack Router projects keep them in `src/routes`.</p>
        </div>
      </Show>
      <Show when={!busy() && rows().length === 0 && report()?.detected !== 'none'}>
        <div class={empty}>
          <p class="m-0 text-[13px] text-ink">Nothing matches</p>
          <p class={`${hint} mt-1`}>Clear the filters or rescan.</p>
        </div>
      </Show>

      <div class="flex flex-col gap-2">
        <For each={rows()}>{(r) => (
          <div class={`${card} border-l-2 ${edgeOf(seo().get(r.path))}`}>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-[14px] font-semibold text-ink">{r.path}</span>
              <span class={tonePill(kindTone(r.kind))}>{r.kind}</span>
              <Show when={r.params.length > 0}>
                <span class={chip}>{r.params.length} param(s) — not fetched</span>
              </Show>
            </div>
            <RouteDetail api={p.api} root={() => p.root()} route={r} seo={seo().get(r.path)} />
          </div>
        )}</For>
      </div>
    </div>
  )
}
