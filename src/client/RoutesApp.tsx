import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { RoutesReport } from '../rpc/routes'
import type { SeoReport, SeoRow } from '../rpc/seo'
import type { PanelApi } from '../ui/api'
import { btn, card, chip, chipOn, field, hint, row } from '../ui/bits'
import { mergeSeo } from './mergeSeo'
import RouteDetail from './RouteDetail'

const ORIGIN_KEY = 'wrikka:seo-origin'
const DEFAULT_ORIGIN = 'http://localhost:5173'

type KindFilter = 'all' | 'layout' | 'index' | 'page' | 'not-found'
const KINDS: KindFilter[] = ['all', 'layout', 'index', 'page', 'not-found']

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
    <div class="flex flex-col gap-2 p-3">
      <div class={row}>
        <h1 class="text-[13px] font-semibold text-ink">Routes &amp; SEO</h1>
        <span class={`${hint} mr-auto`}>{msg()}</span>
        <button class={btn} disabled={busy()} onClick={() => void load()}>
          {busy() ? 'working…' : 'Rescan source'}
        </button>
      </div>

      <div class={row}>
        <input
          class={`${field} max-w-60 font-mono`}
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

      <Show when={report()?.detected === 'none'}>
        <p class={hint}>
          No route folder under this project root. TanStack Router projects keep them in `src/routes`.
        </p>
      </Show>
      <Show when={!busy() && rows().length === 0 && report()?.detected !== 'none'}>
        <p class={hint}>Nothing matches. Clear the filters or rescan.</p>
      </Show>

      <div class="flex flex-col gap-1.5">
        <For each={rows()}>{(r) => (
          <div class={card}>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-[12px] font-semibold text-ink">{r.path}</span>
              <span class={chip}>{r.kind}</span>
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
