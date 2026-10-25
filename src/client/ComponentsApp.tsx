import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { ComponentRow, ComponentsReport } from '../rpc/components'
import type { PanelApi } from '../ui/api'
import {
  btn,
  chip,
  chipOn,
  empty,
  field,
  grid,
  hint,
  kindTone,
  link,
  meter,
  meterTone,
  page,
  pageHead,
  row,
  stat,
  statLabel,
  statRow,
  statValue,
  tile,
  tileOn,
  title,
  tonePill,
} from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'

type SortKey = 'risk' | 'loc' | 'name'
type KindFilter = 'all' | 'component' | 'page' | 'layout' | 'hook'

const KINDS: KindFilter[] = ['all', 'component', 'page', 'layout', 'hook']
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'risk', label: 'risk first' },
  { key: 'loc', label: 'largest' },
  { key: 'name', label: 'name' },
]
const LOC_LIMIT = 250

export interface ComponentsPanelProps {
  api: PanelApi
  /** Absolute project root, so editor links resolve. */
  root(): string
}

function keyOf(r: ComponentRow): string {
  return `${r.file}#${r.name}`
}

/** Sorted so the risky work surfaces first: unreferenced, then biggest. */
function reorder(rows: ComponentRow[], sort: SortKey): ComponentRow[] {
  const copy = [...rows]
  if (sort === 'loc') copy.sort((a, b) => b.loc - a.loc || a.name.localeCompare(b.name))
  if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy
}

function locPercent(loc: number): string {
  return `${Math.min(100, Math.round((loc / LOC_LIMIT) * 100))}%`
}

export default function ComponentsApp(p: ComponentsPanelProps) {
  const [report, setReport] = createSignal<ComponentsReport>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('scanning source…')
  const [query, setQuery] = createSignal('')
  const [kind, setKind] = createSignal<KindFilter>('all')
  const [unusedOnly, setUnusedOnly] = createSignal(false)
  const [sort, setSort] = createSignal<SortKey>('risk')
  const [open, setOpen] = createSignal<string>()

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('list-components', {})) as ComponentsReport
      setReport(res)
      const unused = res.components.filter((c) => c.refs === 0).length
      const big = res.components.filter((c) => c.loc > LOC_LIMIT).length
      setMsg(`${res.components.length} exports · ${unused} unreferenced · ${big} over ${LOC_LIMIT} lines`)
    } catch (err) {
      setMsg(`scan failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const stats = createMemo(() => {
    const all = report()?.components ?? []
    return {
      total: all.length,
      unused: all.filter((c) => c.refs === 0).length,
      long: all.filter((c) => c.loc > LOC_LIMIT).length,
      largest: all.reduce((max, c) => Math.max(max, c.loc), 0),
    }
  })

  const rows = createMemo(() => {
    const all = report()?.components ?? []
    const needle = query().trim().toLowerCase()
    const filtered = all.filter(
      (r) =>
        (kind() === 'all' || r.kind === kind()) &&
        (!unusedOnly() || r.refs === 0) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.file.toLowerCase().includes(needle)),
    )
    return reorder(filtered, sort())
  })

  return (
    <div class={page}>
      <div class={pageHead}>
        <h1 class={title}>Components</h1>
        <span class={`${hint} mr-auto`}>{msg()}</span>
        <button class={btn} disabled={busy()} onClick={() => void load()}>
          {busy() ? 'scanning…' : 'Rescan'}
        </button>
      </div>

      <div class={statRow}>
        <div class={stat}>
          <span class={statValue}>{stats().total}</span>
          <span class={statLabel}>exports found</span>
        </div>
        <div class={stat}>
          <span class={`${statValue} ${stats().unused > 0 ? 'text-bad-ink' : 'text-ink-faint'}`}>{stats().unused}</span>
          <span class={statLabel}>unreferenced</span>
        </div>
        <div class={stat}>
          <span class={`${statValue} ${stats().long > 0 ? 'text-warn-ink' : 'text-ink-faint'}`}>{stats().long}</span>
          <span class={statLabel}>over {LOC_LIMIT} lines</span>
        </div>
        <div class={stat}>
          <span class={statValue}>{stats().largest}</span>
          <span class={statLabel}>largest file (lines)</span>
        </div>
      </div>

      <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
        <input
          class={`${field} font-mono`}
          aria-label="Filter components"
          placeholder="filter by name or path"
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
            class={`${chip} ${unusedOnly() ? chipOn : ''}`}
            aria-pressed={unusedOnly()}
            onClick={() => setUnusedOnly(!unusedOnly())}
          >
            unreferenced only
          </button>
          <select class={`${btn} ml-auto`} aria-label="Sort" value={sort()} onChange={(e) => setSort(e.currentTarget.value as SortKey)}>
            <For each={SORTS}>{(s) => <option value={s.key}>{s.label}</option>}</For>
          </select>
        </div>
      </div>

      <Show when={report()?.truncated}>
        <p class={hint}>scan stopped at the file cap — the list is partial.</p>
      </Show>
      <Show when={!busy() && rows().length === 0}>
        <div class={empty}>
          <p class="m-0 text-[13px] text-ink">Nothing to show</p>
          <p class={`${hint} mt-1`}>Clear the filters, or the project has no `src/` folder.</p>
        </div>
      </Show>

      <div class={grid}>
        <For each={rows()}>{(r) => {
          const expanded = () => open() === keyOf(r)
          return (
            <div class={`${tile} ${expanded() ? tileOn : ''}`}>
              <button
                class="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-0 text-left"
                aria-expanded={expanded()}
                onClick={() => setOpen(expanded() ? undefined : keyOf(r))}
              >
                <div class="flex items-start gap-2">
                  <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={r.name}>
                    {r.name}
                  </span>
                  <span class={tonePill(kindTone(r.kind))}>{r.kind}</span>
                </div>
                <span class={`${hint} truncate font-mono`} title={r.file}>{r.file}</span>
                <div class={row}>
                  <Show when={r.refs === 0}>
                    <span class={tonePill('bad')}>unreferenced</span>
                  </Show>
                  <Show when={r.loc > LOC_LIMIT}>
                    <span class={tonePill('warn')}>split</span>
                  </Show>
                  <span class={`${hint} ml-auto`}>{r.refs} refs · {r.loc} lines</span>
                </div>
                <div class={meter} role="presentation">
                  <div class={`h-full rounded-full ${meterTone(r.loc)}`} style={{ width: locPercent(r.loc) }} />
                </div>
              </button>
              <Show when={expanded()}>
                <div class="flex flex-col gap-1.5 border-t border-solid border-line pt-2">
                  <p class={`${hint} m-0`}>
                    {r.refs === 0
                      ? 'No other file mentions this name — it is either dead code or reached only dynamically.'
                      : `Referenced by ${r.refs} other file(s).`}
                    {r.loc > LOC_LIMIT ? ` At ${r.loc} lines this file is past the ${LOC_LIMIT}-line limit.` : ''}
                  </p>
                  <div class={row}>
                    <span class={hint}>exports:</span>
                    <For each={r.exports}>{(name) => <span class={chip}>{name}</span>}</For>
                  </div>
                  <a
                    class={`${link} w-fit text-[11px]`}
                    href={`vscode://file/${p.root()}/${r.file}`}
                    aria-label={`Open ${r.file} in the editor`}
                  >
                    open in editor
                  </a>
                  <SendToAgent
                    api={p.api}
                    page={r.file}
                    selection={{ mode: 'component', componentLabel: r.name, cssPath: r.file }}
                    placeholder={`e.g. split ${r.name} into smaller pieces`}
                  />
                </div>
              </Show>
            </div>
          )
        }}</For>
      </div>
    </div>
  )
}
