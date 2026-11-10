import { Show } from 'solid-js'
import { CommentIcon } from '../../ui/icons'

export interface ChatPillProps {
  open: boolean
  /** queued + running comments — same badge the comment pill shows. */
  active: number
  onToggle(): void
}

/**
 * Second floating button beside the comment pill (`left-[104px]` clears the
 * 44 px pill at `left-14`). Toggles the chat sidebar and the page shift.
 */
export default function ChatPill(p: ChatPillProps) {
  return (
    <button
      class={`fixed bottom-4 left-[104px] z-[2147483000] flex size-11 cursor-pointer items-center justify-center rounded-full border border-solid shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-colors select-none ${
        p.open
          ? 'border-line-strong bg-control text-ink'
          : 'border-line bg-surface-raised text-ink hover:bg-control'
      }`}
      onClick={p.onToggle}
      aria-label={p.open ? 'Close chat' : 'Open chat'}
      aria-expanded={p.open}
      title="Chat — the agent works on this page's comments"
    >
      <span class="scale-125">
        <CommentIcon />
      </span>
      <Show when={p.active > 0}>
        <span class="absolute -top-1 -right-1 min-w-4 rounded-full bg-surface px-1 text-center text-[9px] font-bold text-ink">
          {p.active}
        </span>
      </Show>
    </button>
  )
}
