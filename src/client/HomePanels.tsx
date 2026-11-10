import { For, Show, createMemo, createSignal } from 'solid-js'
import { chip, chipOn, grid, hint, row, sectionLabel, tile } from '../ui/bits'
import { ChevronIcon } from '../ui/icons'
import { PANEL_GLYPHS } from '../ui/panel-icons'
import { EmptyState } from './PanelKit'
import { openDock } from './hub-link'
import { CATEGORY_LABEL, CATEGORY_TINT, PANELS, type Category } from './panel-catalog'

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[]

export default function HomePanels() {
  const [filter, setFilter] = createSignal<Category | 'all'>('all')
  const [query, setQuery] = createSignal('')

  const shown = createMemo(() => {
    const q = query().trim().toLowerCase()
    return PANELS.filter(
      (p) =>
        (filter() === 'all' || p.category === filter()) &&
        (!q || `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(q)),
    )
  })

  return (
    <div class="flex flex-col gap-2">
      <div class={row}>
        <span class={sectionLabel}>all panels</span>
        <span class={`${hint} ml-auto`}>
          {shown().length}/{PANELS.length} · click to open in the dock
        </span>
      </div>

      <div class={`${row} rounded-xl border border-solid border-line bg-surface-raised p-1.5`}>
        <button class={`${chip} ${filter() === 'all' ? chipOn : ''}`} onClick={() => setFilter('all')}>
          all
        </button>
        <For each={CATEGORIES}>
          {(c) => (
            <button class={`${chip} ${filter() === c ? chipOn : ''}`} onClick={() => setFilter(c)}>
              {CATEGORY_LABEL[c]}
            </button>
          )}
        </For>
        <input
          class="ml-auto w-40 rounded-full border border-solid border-line bg-control px-2.5 py-0.5 text-[11px] text-ink transition-colors placeholder:text-ink-faint focus:border-line-strong focus-visible:border-line-strong focus:outline-none"
          placeholder="filter panels…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          aria-label="Filter panels"
        />
      </div>

      <div class={grid}>
        <For each={shown()}>
          {(panel) => {
            const Glyph = PANEL_GLYPHS[panel.hash]
            return (
              <button class={`${tile} group`} onClick={() => void openDock(panel.dockId, panel.hash)} title={`Open ${panel.title}`}>
                <span class="flex items-center gap-2">
                  <span
                    class={`flex size-7 shrink-0 items-center justify-center rounded-lg ${CATEGORY_TINT[panel.category]} ${Glyph ? 'text-[13px]' : 'text-[10px] font-bold tracking-wide'}`}
                  >
                    {Glyph ? <Glyph /> : panel.monogram}
                  </span>
                  <span class="truncate text-[12px] font-semibold text-ink">{panel.title}</span>
                  <span class={`${hint} ml-auto shrink-0 text-[10px] uppercase tracking-wide`}>{CATEGORY_LABEL[panel.category]}</span>
                  <span class={`${hint} shrink-0 transition-transform group-hover:translate-x-0.5`} aria-hidden>
                    <ChevronIcon />
                  </span>
                </span>
                <span class="line-clamp-2 text-[11px] leading-snug text-ink-muted">{panel.description}</span>
              </button>
            )
          }}
        </For>
      </div>

      <Show when={shown().length === 0}>
        <EmptyState title="No panel matches" hint={`Nothing matches “${query()}” — try another category or clear the filter.`} />
      </Show>
    </div>
  )
}
