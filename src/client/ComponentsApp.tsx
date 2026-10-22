import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { ComponentRow, ComponentsReport } from '../rpc/components'
import type { PanelApi } from '../ui/api'
import { btn, card, chip, chipOn, field, hint, link, row, statusPill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'

type SortKey = 'risk' | 'loc' | 'name'
type KindFilter = 'all' | 'component' | 'page' | 'layout' | 'hook'

const KINDS: KindFilter[] = ['all', 'component', 'page', 'layout', 'hook']
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'risk', label: 'risk first' },
  { key: 'loc', label: 'largest' },
  { key: 'name', label: 'name' },
]

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
      const big = res.components.filter((c) => c.loc > 250).length
      setMsg(`${res.components.length} exports · ${unused} unreferenced · ${big} over 250 lines`)
    } catch (err) {
      setMsg(`scan failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

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
    <div class="flex flex-col gap-2 p-3">
      <div class={row}>
        <h1 class="text-[13px] font-semibold text-ink">Components</h1>
        <span class={`${hint} mr-auto`}>{msg()}</span>
        <button class={btn} disabled={busy()} onClick={() => void load()}>
          {busy() ? 'scanning…' : 'Rescan'}
        </button>
      </div>

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

      <Show when={report()?.truncated}>
        <p class={hint}>scan stopped at the file cap — the list is partial.</p>
      </Show>
      <Show when={!busy() && rows().length === 0}>
        <p class={hint}>Nothing matches. Clear the filters, or the project has no `src/` folder.</p>
      </Show>

      <div class="flex flex-col gap-1.5">
        <For each={rows()}>{(r) => {
          const expanded = () => open() === keyOf(r)
          return (
            <div class={card}>
              <button
                class="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
                aria-expanded={expanded()}
                onClick={() => setOpen(expanded() ? undefined : keyOf(r))}
              >
                <span class="text-[12px] font-semibold text-ink">{r.name}</span>
                <span class={statusPill(r.kind === 'hook' ? 'running' : r.refs === 0 ? 'failed' : 'done')}>{r.kind}</span>
                <span class={`${hint} ml-auto shrink-0`}>{r.refs} refs · {r.loc} lines</span>
              </button>
              <div class={`${hint} break-all font-mono`} title={r.file}>{r.file}</div>
              <Show when={expanded()}>
                <div class="flex flex-col gap-1 border-t border-solid border-line pt-1.5">
                  <p class={hint}>
                    {r.refs === 0
                      ? 'No other file mentions this name — it is either dead code or reached only dynamically.'
                      : `Referenced by ${r.refs} other file(s).`}
                    {r.loc > 250 ? ` At ${r.loc} lines this file is past the 250-line limit.` : ''}
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
