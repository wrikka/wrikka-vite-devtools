import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import {
  btn,
  card,
  chip,
  empty,
  field,
  hint,
  page,
  pageHead,
  row,
  sectionLabel,
  stat,
  statLabel,
  statRow,
  statValue,
  title,
  tonePill,
  type Tone,
} from '../ui/bits'
import { SearchIcon } from '../ui/icons'
import {
  SOLID_INSTALL_STEPS,
  collectOwners,
  matchesRow,
  ownerRows,
  readSolidSetup,
  solidVersions,
  sourceRows,
  unownedSignals,
  type OwnerRow,
  type SignalRow,
  type SolidSetupLike,
} from './solid'

/** Component vs computation vs the rest — same tone language as the other panels. */
function ownerTone(kind: string): Tone {
  if (kind === 'component') return 'accent'
  if (kind === 'computation') return 'info'
  return 'warn'
}

export default function SolidApp() {
  const [setup, setSetup] = createSignal<SolidSetupLike>()
  const [owners, setOwners] = createSignal<OwnerRow[]>([])
  const [signals, setSignals] = createSignal<SignalRow[]>([])
  const [query, setQuery] = createSignal('')
  const [selected, setSelected] = createSignal<string>()

  onMount(scan)

  function scan(): void {
    const found = readSolidSetup()
    setSetup(found)
    setOwners(found ? ownerRows(collectOwners(found)) : [])
    setSignals(found ? unownedSignals(found) : [])
  }

  const rows = createMemo(() => owners().filter((r) => matchesRow(r, query())))
  const active = createMemo(() => owners().find((r) => r.id === selected()))
  const versions = createMemo(() => {
    const found = setup()
    return found ? solidVersions(found) : undefined
  })
  const mismatch = createMemo(() => {
    const v = versions()
    return !!v && v.expected !== 'unknown' && v.solid !== v.expected
  })
  const stats = createMemo(() => {
    const list = owners()
    return {
      owners: list.length,
      components: list.filter((r) => r.kind === 'component').length,
      computations: list.filter((r) => r.kind === 'computation').length,
      depth: list.reduce((max, r) => Math.max(max, r.depth), 0),
    }
  })

  return (
    <div class={page}>
      <div class={pageHead}>
        <h1 class={title}>Solid</h1>
        <span class={`${hint} mr-auto`}>
          {setup()
            ? 'live owner tree read from the attached debugger'
            : 'solid-devtools is not attached'}
        </span>
        <button class={btn} onClick={scan}>
          Rescan
        </button>
      </div>

      <Show
        when={setup()}
        fallback={
          <div class={`${card} gap-2`}>
            <p class="m-0 text-[13px] font-semibold text-ink">
              Attach the Solid debugger to see components and signals
            </p>
            <p class={hint}>
              This panel reads the app's live Solid owner tree. It stays empty until the host app loads the
              debugger setup — the app must run a development build, because production strips Solid's DEV hooks.
            </p>
            <ol class="m-0 flex list-decimal flex-col gap-1 pl-5">
              <For each={SOLID_INSTALL_STEPS}>
                {(step) => <li class={`${hint} break-all font-mono`}>{step}</li>}
              </For>
            </ol>
            <div class={row}>
              <button class={btn} onClick={() => location.reload()}>
                Reload page
              </button>
              <span class={hint}>
                Already imported the setup? Reload, then Rescan — the global is read once per page load.
              </span>
            </div>
          </div>
        }
      >
        <div class={statRow}>
          <div class={stat}>
            <span class={statValue}>{stats().owners}</span>
            <span class={statLabel}>owners</span>
          </div>
          <div class={stat}>
            <span class={statValue}>{stats().components}</span>
            <span class={statLabel}>components</span>
          </div>
          <div class={stat}>
            <span class={statValue}>{stats().computations}</span>
            <span class={statLabel}>computations</span>
          </div>
          <div class={stat}>
            <span class={statValue}>{stats().depth}</span>
            <span class={statLabel}>max depth</span>
          </div>
        </div>

        <div class={`${card} gap-2`}>
          <div class={row}>
            <span class={sectionLabel}>versions</span>
            <span class={chip}>solid {versions()?.solid}</span>
            <span class={chip}>client {versions()?.client}</span>
            <span class={chip}>expected {versions()?.expected}</span>
            <span class={`${hint} mr-auto`}>{signals().length} unowned signals</span>
          </div>
          <Show when={mismatch()}>
            <p class="m-0 text-[11px] text-warn-ink">
              The setup was built for Solid {versions()?.expected} but this page runs {versions()?.solid} — owner
              fields may be missing.
            </p>
          </Show>
        </div>

        <div class="relative">
          <span class="pointer-events-none absolute top-2.5 left-2 text-ink-faint">
            <SearchIcon />
          </span>
          <input
            class={`${field} pl-7 font-mono`}
            aria-label="Filter owners"
            placeholder="filter by component, computation, or kind"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </div>

        <Show when={owners().length === 0}>
          <p class={empty}>
            The debugger is attached, but no owners were registered yet.
            <br />
            Render a component, then Rescan.
          </p>
        </Show>
        <Show when={owners().length > 0 && rows().length === 0}>
          <p class={empty}>Nothing matches “{query()}”.</p>
        </Show>

        <div class="flex flex-col gap-1.5">
          <For each={rows()}>
            {(r) => (
              <button
                class={`${card} cursor-pointer border-l-2 text-left transition-colors hover:border-line-strong hover:bg-control ${
                  selected() === r.id ? 'border-l-accent' : 'border-l-line'
                }`}
                style={{ 'margin-left': `${Math.min(r.depth, 8) * 10}px` }}
                aria-pressed={selected() === r.id}
                onClick={() => setSelected(selected() === r.id ? undefined : r.id)}
              >
                <div class={row}>
                  <span class="text-[12px] font-semibold text-ink">{r.name}</span>
                  <span class={tonePill(ownerTone(r.kind))}>{r.kind}</span>
                  <span class={`${hint} ml-auto shrink-0`}>
                    {r.sources} src · {r.owned} owned
                  </span>
                </div>
                <span class={`${hint} truncate font-mono`}>{r.preview}</span>
              </button>
            )}
          </For>
        </div>

        <Show when={active()}>
          {(rowValue) => (
            <div class={`${card} border-l-2 border-l-accent`}>
              <div class={row}>
                <span class="text-[12px] font-semibold text-ink">{rowValue().name}</span>
                <span class={tonePill(ownerTone(rowValue().kind))}>{rowValue().kind}</span>
                <span class={`${hint} mr-auto`}>depth {rowValue().depth}</span>
              </div>
              <span class={`${hint} break-all font-mono`}>value: {rowValue().preview}</span>
              <span class={sectionLabel}>signals read by this owner ({rowValue().sources})</span>
              <Show when={sourceRows(rowValue().owner).length > 0} fallback={<p class={hint}>No recorded sources.</p>}>
                <div class="flex flex-col gap-0.5">
                  <For each={sourceRows(rowValue().owner)}>
                    {(s) => (
                      <div class={row}>
                        <span class={`${hint} font-mono`}>{s.name}</span>
                        <span class={`${hint} truncate font-mono`}>{s.preview}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </Show>

        <div class={card}>
          <div class={row}>
            <span class={sectionLabel}>unowned signals</span>
            <span class={`${hint} mr-auto`}>created outside any component or effect</span>
          </div>
          <Show when={signals().length > 0} fallback={<p class={hint}>None registered.</p>}>
            <div class="flex flex-col gap-0.5">
              <For each={signals()}>
                {(s) => (
                  <div class={row}>
                    <span class={`${hint} font-mono`}>{s.name}</span>
                    <span class={`${hint} truncate font-mono`}>{s.preview}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
