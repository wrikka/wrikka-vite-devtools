import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { Comment } from '../protocol'
import type { PanelApi } from './api'
import { useAccess } from './access-store'
import CommentCard from './CommentCard'
import CommentRow from './CommentRow'
import { showToast } from './toast'
import { btn, chip, chipOn, empty, hint, row, stat, statLabel, statRow, statValue } from './bits'

export interface InboxProps {
  api: PanelApi
  /** Reports how many comments are still open (not `done`) so the tab label can show it. */
  onOpenCount?(count: number): void
}

type Filter = 'all' | Comment['status']
const FILTERS: Filter[] = ['all', 'queued', 'running', 'done', 'failed']

function signature(items: Comment[]): string {
  return items.map((c) => `${c.id}:${c.status}:${c.body.length}:${c.resultSummary ?? ''}`).join('|')
}

export default function Inbox(p: InboxProps) {
  const [items, setItems] = createSignal<Comment[]>([])
  const [filter, setFilter] = createSignal<Filter>('all')
  const [pageFilter, setPageFilter] = createSignal<string>('all')
  const [logs, setLogs] = createSignal<Record<string, string>>({})
  const [view, setView] = createSignal<'cards' | 'list'>('cards')
  const access = useAccess(p.api)

  const sorted = createMemo(() => [...items()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  const pages = createMemo(() => [...new Set(items().map((c) => c.page))])
  const counts = createMemo(() => {
    const by = { queued: 0, running: 0, done: 0, failed: 0 }
    for (const c of items()) {
      if (c.status === 'queued' || c.status === 'running' || c.status === 'done' || c.status === 'failed') by[c.status] += 1
    }
    return by
  })
  const countOf = (f: Filter): number => (f === 'all' ? items().length : counts()[f])
  const visible = createMemo(() =>
    sorted().filter(
      (c) =>
        (filter() === 'all' || c.status === filter()) &&
        (pageFilter() === 'all' || c.page === pageFilter()),
    ),
  )
  createEffect(() => p.onOpenCount?.(items().filter((c) => c.status !== 'done').length))

  async function refresh(): Promise<void> {
    try {
      const { items: next } = (await p.api.call('list-comments')) as { items: Comment[] }
      if (signature(next) !== signature(items())) setItems(next)
    } catch {
      /* dev server restarting — keep last render */
    }
  }

  void refresh()
  const timer = setInterval(() => void refresh(), 2000)
  onCleanup(() => clearInterval(timer))

  async function startRun(c: Comment): Promise<void> {
    if (!access.can('run:start')) {
      showToast('read-only session — agent runs are disabled', 'warn')
      return
    }
    try {
      const res = await p.api.call('run-agent', { commentId: c.id })
      if (res.started && res.streamId) {
        showToast('agent run started', 'ok')
        void streamLogs(c.id, res.streamId as string)
      } else if (res.reason) {
        showToast(String(res.reason), res.reason === 'already running' ? 'info' : 'warn')
        setLogs((prev) => ({ ...prev, [c.id]: `${prev[c.id] ?? ''}(${res.reason})\n` }))
      }
      void refresh()
    } catch (err) {
      showToast(`run failed: ${String(err)}`, 'bad')
    }
  }

  async function cancelRun(c: Comment): Promise<void> {
    if (!access.can('run:cancel')) {
      showToast('read-only session — cancelling is disabled', 'warn')
      return
    }
    try {
      await p.api.call('cancel-agent', { commentId: c.id })
      showToast('run cancelled', 'info')
      void refresh()
    } catch (err) {
      showToast(`cancel failed: ${String(err)}`, 'bad')
    }
  }

  async function dismiss(c: Comment): Promise<void> {
    if (!access.can('comment:delete')) {
      showToast('read-only session — dismissal is disabled', 'warn')
      return
    }
    try {
      await p.api.call('delete-comment', { id: c.id })
      setItems((prev) => prev.filter((x) => x.id !== c.id))
      showToast('comment dismissed', 'info')
    } catch (err) {
      showToast(`dismiss failed: ${String(err)}`, 'bad')
    }
  }

  async function streamLogs(commentId: string, streamId: string): Promise<void> {
    setLogs((prev) => ({ ...prev, [commentId]: prev[commentId] ?? '' }))
    try {
      for await (const chunk of p.api.subscribe('agent-logs', streamId)) {
        setLogs((prev) => ({ ...prev, [commentId]: (prev[commentId] ?? '') + chunk }))
      }
    } catch {
      /* stream lost */
    }
    void refresh()
  }

  return (
    <>
      <div class={statRow}>
        <div class={stat}>
          <span class={statValue}>{items().length}</span>
          <span class={statLabel}>total comments</span>
        </div>
        <div class={stat}>
          <span class={`${statValue} text-warn-ink`}>{counts().queued + counts().running}</span>
          <span class={statLabel}>{counts().running > 0 ? `${counts().running} running` : 'open'}</span>
        </div>
        <div class={stat}>
          <span class={`${statValue} text-ok-ink`}>{counts().done}</span>
          <span class={statLabel}>done</span>
        </div>
        <div class={stat}>
          <span class={`${statValue} ${counts().failed > 0 ? 'text-bad-ink' : 'text-ink-faint'}`}>{counts().failed}</span>
          <span class={statLabel}>failed</span>
        </div>
      </div>

      <div class={`${row} mt-3`}>
        <For each={FILTERS}>{(f) => (
          <button
            class={`${chip} ${filter() === f ? chipOn : ''}`}
            aria-pressed={filter() === f}
            onClick={() => setFilter(f)}
          >
            {f}
            <Show when={f !== 'all' && countOf(f) > 0}>
              <span class="ml-1 opacity-70">{countOf(f)}</span>
            </Show>
          </button>
        )}</For>
        <Show when={pages().length > 1}>
          <select
            class={btn}
            aria-label="Filter by page"
            value={pageFilter()}
            onChange={(e) => setPageFilter(e.currentTarget.value)}
          >
            <option value="all">all pages</option>
            <For each={pages()}>{(u) => <option value={u}>{u}</option>}</For>
          </select>
        </Show>
        <Show when={items().length > 0}>
          <span class={`${hint} ml-auto`}>{`showing ${visible().length}/${items().length}`}</span>
        </Show>
        <div class="flex gap-1" role="group" aria-label="Comment layout">
          <button
            class={`${chip} ${view() === 'cards' ? chipOn : ''}`}
            aria-pressed={view() === 'cards'}
            onClick={() => setView('cards')}
          >
            cards
          </button>
          <button
            class={`${chip} ${view() === 'list' ? chipOn : ''}`}
            aria-pressed={view() === 'list'}
            onClick={() => setView('list')}
          >
            list
          </button>
        </div>
      </div>

      <Show when={access.readOnly()}>
        <div class={`${hint} mt-2 rounded-md border border-solid border-warn/40 bg-warn/10 px-2.5 py-1.5 text-warn-ink`}>
          Read-only session (viewer role) — running agents, cancelling, and dismissing are disabled.
        </div>
      </Show>

      <Show
        when={view() === 'list'}
        fallback={
          <div class="mt-3 grid grid-cols-1 gap-2 2xl:grid-cols-2">
            <For each={visible()}>
              {(c) => (
                <CommentCard
                  comment={c}
                  log={logs()[c.id]}
                  readOnly={access.readOnly()}
                  onRun={(comment) => void startRun(comment)}
                  onCancel={(comment) => void cancelRun(comment)}
                  onDismiss={(comment) => void dismiss(comment)}
                />
              )}
            </For>
          </div>
        }
      >
        <div class="mt-3 flex flex-col gap-1.5">
          <For each={visible()}>
            {(c) => (
              <CommentRow
                comment={c}
                readOnly={access.readOnly()}
                onRun={(comment) => void startRun(comment)}
                onCancel={(comment) => void cancelRun(comment)}
                onDismiss={(comment) => void dismiss(comment)}
              />
            )}
          </For>
        </div>
      </Show>
      <Show when={visible().length === 0}>
        <div class={`${empty} mt-3`}>
          <p class="m-0 text-[13px] text-ink">{items().length === 0 ? 'No comments yet' : 'Nothing matches this filter'}</p>
          <p class={`${hint} mt-1`}>
            {items().length === 0
              ? 'Pick an element in your app, write a comment, and it lands here for the agent.'
              : 'Clear the filter to see everything again.'}
          </p>
        </div>
      </Show>
    </>
  )
}
