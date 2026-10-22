import { Show } from 'solid-js'
import { iconBtn, iconBtnOn } from '../../ui/bits'
import { CommentIcon, ComponentIcon, ElementIcon, PageIcon, PanelIcon, PinsIcon, SearchIcon } from '../../ui/icons'

export type PillMode = 'element' | 'component' | 'page'

const MODES: { id: PillMode; label: string; Icon: () => ReturnType<typeof ElementIcon> }[] = [
  { id: 'element', label: 'Pick an element', Icon: ElementIcon },
  { id: 'component', label: 'Pick a component', Icon: ComponentIcon },
  { id: 'page', label: 'Comment on the whole page', Icon: PageIcon },
]

export interface PillProps {
  mode: PillMode
  onMode(m: PillMode): void
  /** queued + running comments — drives the dot colour and the count badge. */
  active: number
  running: boolean
  composerOpen: boolean
  pinsOn: boolean
  hub: string
  onComment(): void
  onSearch(): void
  onPins(): void
}

export default function Pill(p: PillProps) {
  const cycle = (): PillMode => {
    const i = MODES.findIndex((m) => m.id === p.mode)
    return MODES[(i + 1) % MODES.length]!.id
  }
  const current = (): (typeof MODES)[number] => MODES.find((m) => m.id === p.mode) ?? MODES[0]!

  return (
    <div
      class="fixed bottom-3 right-3 z-[2147483000] flex h-9 items-center gap-0.5 rounded-full border border-solid border-line bg-surface-raised px-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] select-none"
      role="toolbar"
      aria-label="Wrikka comment tools"
    >
      <span
        class={`h-2 w-2 shrink-0 rounded-full ${p.running ? 'animate-pulse bg-info' : p.active > 0 ? 'bg-warn' : 'bg-ok'}`}
        role="status"
        aria-label={p.running ? 'an agent is running' : p.active > 0 ? 'comments queued' : 'idle'}
      />
      <button
        class={`${iconBtn} ${p.mode !== 'page' ? iconBtnOn : ''}`}
        onClick={() => p.onMode(cycle())}
        aria-label={`${current().label} — click to cycle target`}
        title={`${current().label} (click cycles element → component → page)`}
      >
        {current().Icon()}
      </button>
      <button
        class={`${iconBtn} ${p.composerOpen ? iconBtnOn : ''}`}
        onClick={p.onComment}
        aria-label="Add a comment"
        title="Pick something, then comment"
      >
        <CommentIcon />
      </button>
      <button
        class={iconBtn}
        onClick={p.onSearch}
        aria-label="Search source for an element"
        title="Pick something, then search its source"
      >
        <SearchIcon />
      </button>
      <button
        class={`${iconBtn} ${p.pinsOn ? '' : 'opacity-40'}`}
        onClick={p.onPins}
        aria-label="Show or hide annotation pins"
        aria-pressed={p.pinsOn}
        title="Show or hide annotation pins"
      >
        <PinsIcon />
      </button>
      <a
        class={`${iconBtn} relative no-underline`}
        href={p.hub}
        target="_blank"
        rel="noreferrer"
        aria-label="Open the comments panel in the devtools hub"
        title="Inbox, ideas and runner live in the hub panel"
      >
        <PanelIcon />
        <Show when={p.active > 0}>
          <span class="absolute -top-1 -right-1 rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
            {p.active}
          </span>
        </Show>
      </a>
    </div>
  )
}
