import { Show } from 'solid-js'
import { CommentIcon } from '../../ui/icons'

export interface PillProps {
  open: boolean
  /** queued + running comments — drives the badge and the ring. */
  active: number
  running: boolean
  onToggle(): void
}

/**
 * One icon, bottom-left. Everything else (route mentions, suggestions, pins,
 * inbox link) lives in the composer it opens. `left-14` clears the 40 px dock
 * rail the hub docks on the same edge.
 */
export default function Pill(p: PillProps) {
  return (
    <button
      class={`fixed bottom-4 left-14 z-[2147483000] flex size-11 cursor-pointer items-center justify-center rounded-full border border-solid shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-colors select-none ${
        p.open
          ? 'border-line-strong bg-control text-ink'
          : 'border-accent bg-accent text-white hover:bg-accent-hover'
      } ${p.running ? 'ring-2 ring-info/60' : p.active > 0 ? 'ring-2 ring-warn/60' : ''}`}
      onClick={p.onToggle}
      aria-label={p.open ? 'Close the comment box' : 'Leave a comment'}
      aria-expanded={p.open}
      title={p.open ? 'Close the comment box' : 'Comment on this page — type @ for a route'}
    >
      <span class="scale-125">
        <CommentIcon />
      </span>
      <Show when={p.active > 0}>
        <span class="absolute -top-1 -right-1 min-w-4 rounded-full bg-surface px-1 text-center text-[9px] font-bold text-ink">
          {p.active}
        </span>
      </Show>
      <span
        class={`absolute right-0.5 bottom-0.5 size-2 rounded-full ${p.running ? 'animate-pulse bg-info-ink' : p.active > 0 ? 'bg-warn-ink' : 'bg-ok-ink'}`}
        aria-hidden
      />
    </button>
  )
}
