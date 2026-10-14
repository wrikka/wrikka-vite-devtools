import { Show, type JSX } from 'solid-js'
import { btn, btnActive } from '../../ui/bits'

export type PillMode = 'element' | 'component' | 'page'

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
  onPins(): void
}

export default function Pill(p: PillProps) {
  return (
    <div
      class="fixed bottom-3 right-3 z-[2147483000] flex h-9 items-center gap-1 rounded-full border border-solid border-[#3a3d46] bg-[#17181d] px-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] select-none"
      role="toolbar"
      aria-label="Wrikka comment tools"
    >
      <span
        class={`h-2 w-2 shrink-0 rounded-full ${p.running ? 'animate-pulse bg-[#2f5aa8]' : p.active > 0 ? 'bg-[#5c5f2e]' : 'bg-[#2e6b45]'}`}
        role="status"
        aria-label={p.running ? 'an agent is running' : p.active > 0 ? 'comments queued' : 'idle'}
      />
      <select
        class={`${btn} max-w-24 rounded-full`}
        aria-label="Comment target mode"
        value={p.mode}
        onChange={(e) => p.onMode(e.currentTarget.value as PillMode)}
      >
        <option value="element">element</option>
        <option value="component">component</option>
        <option value="page">page</option>
      </select>
      <button
        class={`${btn} rounded-full ${p.composerOpen ? btnActive : ''}`}
        onClick={p.onComment}
        aria-label="Add a comment"
        title="Pick an element or comment on the page"
      >
        <span class="inline-flex items-center gap-1">
          <CommentIcon />
          <span>Comment</span>
        </span>
      </button>
      <button
        class={`${btn} rounded-full px-1.5 ${p.pinsOn ? '' : 'opacity-40'}`}
        onClick={p.onPins}
        aria-label="Show or hide annotation pins"
        aria-pressed={!p.pinsOn}
        title="Show or hide annotation pins"
      >
        <PinsIcon />
      </button>
      <a
        class={`${btn} inline-flex items-center gap-1 rounded-full no-underline`}
        href={p.hub}
        target="_blank"
        rel="noreferrer"
        aria-label="Open the comments panel in the devtools hub"
        title="Inbox, ideas and runner live in the hub panel"
      >
        <PanelIcon />
        <Show when={p.active > 0}>
          <span class="rounded-full bg-[#4c6ef5] px-1.5 text-[10px] font-semibold text-white">{p.active}</span>
        </Show>
      </a>
    </div>
  )
}

// Inline 14px stroke glyphs — no icon runtime, safe for the self-contained overlay bundle.
const svg = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': true,
} as const

function CommentIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function PinsIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6z" />
    </svg>
  )
}
function PanelIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M3 5h18v14H3z" />
      <path d="M9 5v14M15 5v14" />
    </svg>
  )
}
