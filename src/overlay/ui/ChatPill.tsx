import { Show } from 'solid-js'
import { ChatIcon } from './icons'

export interface ChatPillProps {
  open: boolean
  /** queued + running comments — same badge the comment pill shows. */
  active: number
  running: boolean
  onToggle(): void
}

/**
 * Second floating button beside the comment pill (`left-[104px]` clears the
 * 44 px pill at `left-14`). Toggles the chat sidebar and the page shift. The
 * badge and status dot mirror Pill so the pair reads as one control strip.
 */
export default function ChatPill(p: ChatPillProps) {
  return (
    <button
      class={`fixed bottom-4 left-[104px] z-[2147483000] flex size-11 cursor-pointer items-center justify-center rounded-full border border-solid shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
        p.open
          ? 'border-line-strong bg-control text-ink'
          : 'border-line bg-surface-raised text-ink hover:bg-control'
      } ${p.running ? 'ring-2 ring-info/60' : p.active > 0 ? 'ring-2 ring-warn/60' : ''}`}
      onClick={p.onToggle}
      aria-label={p.open ? 'Close chat' : 'Open chat'}
      aria-expanded={p.open}
      title="Chat — the agent works on this page's comments"
    >
      <span class="scale-125">
        <ChatIcon />
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
