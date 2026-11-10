import { For, Show } from 'solid-js'
import type { Comment } from '../../protocol'
import { btn, chip, hint, statusPill } from '../../ui/bits'
import { copyText, showToast } from '../../ui/toast'
import { AgentIcon, CopyIcon } from './icons'

export interface ChatThreadProps {
  comment: Comment
  /** Live tail of the `agent-logs` stream while the run is active. */
  log?: string
  viewer: boolean
  onRun(comment: Comment): void
}

const STARTERS = [
  'Review this page and list what to improve first',
  'Fix the most obvious UX issue you see',
  'Add a short summary of what this page does',
]

function stamp(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Empty-thread state: explainer plus one-click prompts that fill the composer. */
export function ChatEmpty(p: { onPick(prompt: string): void }) {
  return (
    <div class="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
      <p class={`${hint} m-0 max-w-56`}>
        Ask the agent to change this page — replies stream back here as comments run.
      </p>
      <div class="flex flex-col items-center gap-1.5">
        <For each={STARTERS}>
          {(s) => (
            <button class={`${chip} max-w-64 text-left`} onClick={() => p.onPick(s)}>
              {s}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

/** One exchange: the user's right-aligned bubble, then the agent's status bubble. */
export default function ChatThread(p: ChatThreadProps) {
  const c = () => p.comment

  async function copy(): Promise<void> {
    const ok = await copyText(c().body)
    showToast(ok ? 'message copied' : 'copy failed', ok ? 'ok' : 'bad')
  }

  return (
    <div class="flex flex-col gap-2">
      <div class="group flex flex-col items-end gap-0.5">
        <div class="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[12px] leading-relaxed text-white">
          <div class="whitespace-pre-wrap break-words">{c().body}</div>
          <Show when={c().selection.cssPath}>
            <div class="mt-1 font-mono text-[10px] text-white/70">{c().selection.cssPath}</div>
          </Show>
        </div>
        <div class="flex items-center gap-1 pr-1">
          <span class={`${hint} text-[10px]`}>{stamp(c().createdAt)}</span>
          <button
            class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            onClick={() => void copy()}
            aria-label="Copy message"
            title="Copy"
          >
            <CopyIcon />
          </button>
        </div>
      </div>
      <div class="flex flex-col items-start gap-0.5">
        <div class="flex max-w-[90%] flex-col gap-1.5 rounded-2xl rounded-bl-md border border-solid border-line bg-control px-3 py-2 text-[12px] text-ink">
          <div class="flex items-center gap-1.5">
            <span class="flex size-4 shrink-0 items-center justify-center rounded bg-accent-soft text-accent-ink">
              <AgentIcon />
            </span>
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
        <span class={`${hint} pl-1 text-[10px]`}>{stamp(c().createdAt)}</span>
      </div>
    </div>
  )
}
