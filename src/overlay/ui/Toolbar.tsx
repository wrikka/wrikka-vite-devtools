import { Show, type JSX } from 'solid-js'
import { btn, btnActive, row } from './bits'

export type ToolbarMode = 'element' | 'component' | 'page'

export interface ToolbarProps {
  mode: ToolbarMode
  onMode(m: ToolbarMode): void
  badge: number
  active: 'comment' | 'ideas' | 'inbox' | null
  pinsOn: boolean
  hub: string
  onComment(): void
  onIdeas(): void
  onInbox(): void
  onPins(): void
}

export default function Toolbar(p: ToolbarProps) {
  return (
    <div
      class="fixed inset-x-0 bottom-0 z-[2147483000] flex h-10 items-center gap-2 border-t border-solid border-[#3a3d46] bg-[#17181d] px-3 select-none"
      role="toolbar"
      aria-label="Wrikka devtools comment toolbar"
    >
      <span class="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa0ab]">wrikka</span>
      <select
        class={`${btn}`}
        aria-label="Comment target mode"
        value={p.mode}
        onChange={(e) => p.onMode(e.currentTarget.value as ToolbarMode)}
      >
        <option value="element">element</option>
        <option value="component">component</option>
        <option value="page">page</option>
      </select>
      <span class="mx-1 h-5 w-px shrink-0 bg-[#3a3d46]" aria-hidden="true" />
      <div class={row}>
        <Action label="Comment" icon={<CommentIcon />} on={p.active === 'comment'} onClick={p.onComment} title="Pick an element or comment on the page" />
        <Action label="Ideas" icon={<IdeasIcon />} on={p.active === 'ideas'} onClick={p.onIdeas} title="Generate improvement ideas" />
        <Action label="Inbox" icon={<InboxIcon />} on={p.active === 'inbox'} onClick={p.onInbox} title="Open the comments inbox" />
        <button
          class={`${btn} ${p.pinsOn ? '' : 'opacity-40'}`}
          onClick={p.onPins}
          aria-label="Show or hide annotation pins"
          aria-pressed={!p.pinsOn}
        >
          <span class="inline-flex items-center gap-1">
            <PinsIcon />
            <span>Pins</span>
          </span>
        </button>
      </div>
      <div class="ml-auto flex items-center gap-1.5">
        <a
          class={`${btn} inline-flex items-center gap-1 no-underline`}
          href={p.hub}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the devtools hub panels"
          title="Open every devtools panel in the hub"
        >
          <PanelsIcon />
          <span>Panels</span>
        </a>
        <Show when={p.badge > 0}>
          <span
            class="rounded-full bg-[#4c6ef5] px-2 text-[11px] font-semibold text-white"
            aria-live="polite"
            aria-label={`${p.badge} comments queued or running`}
          >
            {p.badge}
          </span>
        </Show>
      </div>
    </div>
  )
}

function Action(p: { label: string; icon: JSX.Element; on: boolean; title: string; onClick(): void }) {
  return (
    <button class={`${btn} ${p.on ? btnActive : ''}`} onClick={p.onClick} aria-label={p.label} title={p.title}>
      <span class="inline-flex items-center gap-1">
        {p.icon}
        <span>{p.label}</span>
      </span>
    </button>
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

function CommentIcon() {
  return (
    <svg {...svg}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IdeasIcon() {
  return (
    <svg {...svg}>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-12z" />
    </svg>
  )
}
function InboxIcon() {
  return (
    <svg {...svg}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5 5h14l3 7v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z" />
    </svg>
  )
}
function PinsIcon() {
  return (
    <svg {...svg}>
      <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6z" />
    </svg>
  )
}
function PanelsIcon() {
  return (
    <svg {...svg}>
      <path d="M3 5h18v14H3z" />
      <path d="M9 5v14M15 5v14" />
    </svg>
  )
}
