import { Show } from 'solid-js'
import type { Comment } from '../protocol'
import { btn, hint, statusPill } from './bits'

const dot: Record<string, string> = {
  queued: 'bg-warn',
  running: 'animate-pulse bg-info',
  done: 'bg-ok',
  failed: 'bg-bad',
}

export interface CommentRowProps {
  comment: Comment
  readOnly: boolean
  onRun(comment: Comment): void
  onCancel(comment: Comment): void
  onDismiss(comment: Comment): void
}

/** Dense list row for scanning many comments; the card view keeps the full body. */
export default function CommentRow(p: CommentRowProps) {
  const c = () => p.comment
  return (
    <div class="flex items-center gap-2 rounded-lg border border-solid border-line bg-surface-raised px-2.5 py-1.5">
      <span class={`h-2 w-2 shrink-0 rounded-full ${dot[c().status] ?? 'bg-line'}`} aria-hidden />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-[12px] text-ink" title={c().body}>
          {c().body}
        </span>
        <span class={`${hint} truncate`}>
          {c().kind} · {c().selection.mode}
          {c().selection.cssPath ? ` @ ${c().selection.cssPath}` : ''} · {c().createdAt.slice(0, 16).replace('T', ' ')}
        </span>
      </div>
      <span class={statusPill(c().status)}>{c().status}</span>
      <div class="flex shrink-0 gap-1">
        <Show
          when={c().status === 'running'}
          fallback={
            <button class={btn} disabled={p.readOnly} onClick={() => p.onRun(c())}>
              {c().status === 'queued' ? 'Run' : 'Re-run'}
            </button>
          }
        >
          <button class={btn} disabled={p.readOnly} onClick={() => p.onCancel(c())}>
            Cancel
          </button>
        </Show>
        <button class={btn} disabled={p.readOnly} onClick={() => p.onDismiss(c())} title="Delete this comment">
          ✕
        </button>
      </div>
    </div>
  )
}
