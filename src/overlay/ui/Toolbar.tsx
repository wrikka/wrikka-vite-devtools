import { Show } from 'solid-js'
import { btn, btnActive, row } from './bits'

export type ToolbarMode = 'element' | 'component' | 'page'

export interface ToolbarProps {
  mode: ToolbarMode
  onMode(m: ToolbarMode): void
  badge: number
  active: 'comment' | 'ideas' | 'inbox' | null
  pinsOn: boolean
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
      aria-label="Devfra comment toolbar"
    >
      <span class="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa0ab]">devfra</span>
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
        <Action label="Comment" on={p.active === 'comment'} onClick={p.onComment} title="Pick an element or comment on the page" />
        <Action label="Ideas" on={p.active === 'ideas'} onClick={p.onIdeas} title="Generate improvement ideas" />
        <Action label="Inbox" on={p.active === 'inbox'} onClick={p.onInbox} title="Open the comments inbox" />
        <button
          class={`${btn} ${p.pinsOn ? '' : 'opacity-40'}`}
          onClick={p.onPins}
          aria-label="Show or hide annotation pins"
          aria-pressed={!p.pinsOn}
        >
          Pins
        </button>
      </div>
      <Show when={p.badge > 0}>
        <span
          class="ml-auto rounded-full bg-[#4c6ef5] px-2 text-[11px] font-semibold text-white"
          aria-live="polite"
          aria-label={`${p.badge} comments queued or running`}
        >
          {p.badge}
        </span>
      </Show>
    </div>
  )
}

function Action(p: { label: string; on: boolean; title: string; onClick(): void }) {
  return (
    <button class={`${btn} ${p.on ? btnActive : ''}`} onClick={p.onClick} aria-label={p.label} title={p.title}>
      {p.label}
    </button>
  )
}
