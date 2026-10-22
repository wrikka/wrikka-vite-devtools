import { Show, createEffect } from 'solid-js'
import type { Comment } from '../protocol'
import { btn, card, hint, link, row, statusPill } from './bits'

export interface CommentCardProps {
  comment: Comment
  /** Accumulated agent output, or `undefined` while no run has been started for it. */
  log: string | undefined
  onRun(comment: Comment): void
  onCancel(comment: Comment): void
  onDismiss(comment: Comment): void
}

/** Only a real web url may become a clickable target — never `javascript:` and friends. */
function httpUrl(value: string): string | undefined {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

export default function CommentCard(p: CommentCardProps) {
  let box!: HTMLDivElement
  createEffect(() => {
    const text = p.log
    if (text === undefined || !box) return
    box.textContent = text
    box.scrollTop = box.scrollHeight
  })

  return (
    <div class={card}>
      <span class={statusPill(p.comment.status)}>{p.comment.status}</span>
      <div>{p.comment.body}</div>
      <div class={hint}>
        {`${p.comment.selection.mode} @ ${p.comment.selection.cssPath} — `}
        <Show when={httpUrl(p.comment.page)} fallback={<span>{p.comment.page}</span>}>
          {(url) => (
            <a
              class={`${link} break-all`}
              href={url()}
              target="_blank"
              rel="noreferrer"
              title="Open the target page"
            >
              {p.comment.page}
            </a>
          )}
        </Show>
      </div>
      <Show when={p.comment.skills.length > 0}>
        <div class={hint}>{`skills: ${p.comment.skills.join(', ')}`}</div>
      </Show>
      <Show when={p.comment.capturePath}>
        <div class={hint}>{`capture: ${p.comment.capturePath}`}</div>
      </Show>
      <Show when={p.comment.resultSummary}>
        <div class={hint}>{`result: ${p.comment.resultSummary}`}</div>
      </Show>
      <div class={row}>
        <Show when={p.comment.status === 'running'} fallback={
          <button class={btn} onClick={() => p.onRun(p.comment)}>Re-run</button>
        }>
          <button class={btn} onClick={() => p.onCancel(p.comment)}>Cancel</button>
        </Show>
        <button class={btn} onClick={() => p.onDismiss(p.comment)}>Dismiss</button>
      </div>
      <Show when={p.log !== undefined}>
        <div
          ref={box}
          class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-surface-sunken p-2 font-mono text-[11px] text-ink-muted"
        />
      </Show>
    </div>
  )
}
