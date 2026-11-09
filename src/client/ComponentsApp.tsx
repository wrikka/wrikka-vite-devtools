import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { ComponentRow, ComponentsReport } from '../rpc/components'
import type { PanelApi } from '../ui/api'
import { btn, field, grid, hint, row, sectionLabel } from '../ui/bits'
import { BarList } from '../ui/charts'
import Segmented from '../ui/Segmented'
import ComponentCard from './ComponentCard'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'

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

  const all = createMemo(() => report()?.components ?? [])

  const stats = createMemo(() => {
    const rows = all()
    const total = rows.length
    return {
      total,
      pages: rows.filter((c) => c.kind === 'page').length,
      avgLoc: total === 0 ? 0 : Math.round(rows.reduce((sum, c) => sum + c.loc, 0) / total),
      long: rows.filter((c) => c.loc > LOC_LIMIT).length,
    }
  })

  const kindItems = createMemo(() =>
    KINDS.map((k) => ({
      id: k,
      label: k,
      count: k === 'all' ? all().length : all().filter((c) => c.kind === k).length,
    })),
  )

  const largest = createMemo(() =>
    [...all()]
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 8)
      .map((c) => ({
        label: c.name,
        hint: c.file,
        value: c.loc,
        tone: c.loc > LOC_LIMIT ? ('bad' as const) : c.loc > LOC_LIMIT * 0.6 ? ('warn' as const) : ('ok' as const),
      })),
  )

  const rows = createMemo(() => {
    const needle = query().trim().toLowerCase()
    const filtered = all().filter(
      (r) =>
        (kind() === 'all' || r.kind === kind()) &&
        (!unusedOnly() || r.refs === 0) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.file.toLowerCase().includes(needle)),
    )
    return reorder(filtered, sort())
  })

  return (
    <PanelPage>
      <PanelHeader
        title="Components"
        description={msg()}
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Rescan"
      />

      <StatStrip
        items={[
          { value: stats().total, label: 'exports found' },
          { value: stats().pages, label: 'page exports' },
          { value: stats().avgLoc, label: 'avg lines' },
          {
            value: stats().long,
            label: `over ${LOC_LIMIT} lines`,
            tone: stats().long > 0 ? 'text-warn-ink' : 'text-ink-faint',
          },
        ]}
      />

      <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
        <input
          class={`${field} font-mono`}
          aria-label="Filter components"
          placeholder="filter by name or path"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <div class={row}>
          <Segmented
            items={kindItems()}
            value={kind()}
            onChange={(id) => setKind(id as KindFilter)}
            ariaLabel="Filter by kind"
          />
          <button
            class={`${btn} ${unusedOnly() ? 'border-accent bg-control-hover' : ''}`}
            aria-pressed={unusedOnly()}
            onClick={() => setUnusedOnly(!unusedOnly())}
          >
            unreferenced only
          </button>
          <select
            class={`${btn} ml-auto`}
            aria-label="Sort"
            value={sort()}
            onChange={(e) => setSort(e.currentTarget.value as SortKey)}
          >
            <For each={SORTS}>{(s) => <option value={s.key}>{s.label}</option>}</For>
          </select>
        </div>
      </div>

      <Show when={largest().length > 0}>
        <div class="flex flex-col gap-1.5 rounded-xl border border-solid border-line bg-surface-raised p-3">
          <span class={sectionLabel}>largest exports</span>
          <BarList items={largest()} format={(v) => `${v} lines`} />
        </div>
      </Show>

      <Show when={report()?.truncated}>
        <p class={hint}>scan stopped at the file cap — the list is partial.</p>
      </Show>

      <Show when={!busy() && rows().length === 0}>
        <EmptyState
          title="Nothing to show"
          hint="Clear the filters, or the project has no `src/` folder."
        />
      </Show>

      <div class={grid}>
        <For each={rows()}>
          {(r) => (
            <ComponentCard
              api={p.api}
              root={p.root}
              row={r}
              expanded={open() === keyOf(r)}
              onToggle={() => setOpen(open() === keyOf(r) ? undefined : keyOf(r))}
            />
          )}
        </For>
      </div>
    </PanelPage>
  )
}
