import { Show } from 'solid-js'
import type { Comment } from '../../protocol'
import { btn, hint, statusPill } from '../../ui/bits'

export interface ChatThreadProps {
  comment: Comment
  /** Live tail of the `agent-logs` stream while the run is active. */
  log?: string
  viewer: boolean
  onRun(comment: Comment): void
}

/** One exchange: the user's right-aligned bubble, then the agent's status bubble. */
export default function ChatThread(p: ChatThreadProps) {
  const c = () => p.comment
  return (
    <div class="flex flex-col gap-2">
      <div class="flex justify-end">
        <div class="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[12px] leading-relaxed text-white">
          <div class="whitespace-pre-wrap break-words">{c().body}</div>
          <Show when={c().selection.cssPath}>
            <div class="mt-1 font-mono text-[10px] text-white/70">{c().selection.cssPath}</div>
          </Show>
        </div>
      </div>
      <div class="flex justify-start">
        <div class="flex max-w-[90%] flex-col gap-1.5 rounded-2xl rounded-bl-md border border-solid border-line bg-control px-3 py-2 text-[12px] text-ink">
          <div class="flex items-center gap-2">
            <span class={statusPill(c().status)}>{c().status}</span>
            <Show when={c().status === 'queued' && !p.viewer}>
              <button class={`${btn} px-1.5 py-0`} onClick={() => p.onRun(c())}>
                run agent
              </button>
            </Show>
          </div>
          <Show when={c().status === 'queued'}>
            <span class={hint}>waiting for an agent run</span>
          </Show>
          <Show when={c().resultSummary}>
            <div class="whitespace-pre-wrap break-words text-ink-muted">{c().resultSummary}</div>
          </Show>
          <Show when={c().status === 'running'}>
            <span class="animate-pulse text-ink-muted">agent is working…</span>
          </Show>
          <Show when={p.log}>
            <pre class="m-0 max-h-32 overflow-auto rounded-md bg-surface-sunken p-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words text-ink-muted">
              {p.log}
            </pre>
          </Show>
        </div>
      </div>
    </div>
  )
}
