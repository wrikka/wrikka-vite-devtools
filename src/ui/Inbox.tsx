import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import type { Comment } from '../protocol'
import type { PanelApi } from './api'
import { btn, card, chip, chipOn, hint, link, row, statusPill } from './bits'

export interface InboxProps {
  api: PanelApi
  /** Reports how many comments are still open (not `done`) so the tab label can show it. */
  onOpenCount?(count: number): void
}

type Filter = 'all' | Comment['status']
const FILTERS: Filter[] = ['all', 'queued', 'running', 'done', 'failed']

/** Only a real web url may become a clickable target — never `javascript:` and friends. */
function httpUrl(value: string): string | undefined {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

function signature(items: Comment[]): string {
  return items.map((c) => `${c.id}:${c.status}:${c.body.length}:${c.resultSummary ?? ''}`).join('|')
}

export default function Inbox(p: InboxProps) {
  const [items, setItems] = createSignal<Comment[]>([])
  const [filter, setFilter] = createSignal<Filter>('all')
  const [pageFilter, setPageFilter] = createSignal<string>('all')
  const [logs, setLogs] = createSignal<Record<string, string>>({})

  const sorted = createMemo(() => [...items()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  const pages = createMemo(() => [...new Set(items().map((c) => c.page))])
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
    const res = await p.api.call('run-agent', { commentId: c.id })
    if (res.started && res.streamId) void streamLogs(c.id, res.streamId as string)
    else if (res.reason)
      setLogs((prev) => ({ ...prev, [c.id]: `${prev[c.id] ?? ''}(${res.reason})\n` }))
    void refresh()
  }

  async function cancelRun(c: Comment): Promise<void> {
    await p.api.call('cancel-agent', { commentId: c.id })
    void refresh()
  }

  async function dismiss(c: Comment): Promise<void> {
    await p.api.call('delete-comment', { id: c.id })
    setItems((prev) => prev.filter((x) => x.id !== c.id))
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

  function CommentCard(cp: { comment: Comment }) {
    let box!: HTMLDivElement
    const log = createMemo(() => logs()[cp.comment.id])
    createEffect(() => {
      const text = log()
      if (text === undefined || !box) return
      box.textContent = text
      box.scrollTop = box.scrollHeight
    })
    return (
      <div class={card}>
        <span class={statusPill(cp.comment.status)}>{cp.comment.status}</span>
        <div>{cp.comment.body}</div>
        <div class={hint}>
          {`${cp.comment.selection.mode} @ ${cp.comment.selection.cssPath} — `}
          <Show when={httpUrl(cp.comment.page)} fallback={<span>{cp.comment.page}</span>}>
            {(url) => (
              <a
                class={`${link} break-all`}
                href={url()}
                target="_blank"
                rel="noreferrer"
                title="Open the target page"
              >
                {cp.comment.page}
              </a>
            )}
          </Show>
        </div>
        <Show when={cp.comment.skills.length > 0}>
          <div class={hint}>{`skills: ${cp.comment.skills.join(', ')}`}</div>
        </Show>
        <Show when={cp.comment.capturePath}>
          <div class={hint}>{`capture: ${cp.comment.capturePath}`}</div>
        </Show>
        <Show when={cp.comment.resultSummary}>
          <div class={hint}>{`result: ${cp.comment.resultSummary}`}</div>
        </Show>
        <div class={row}>
          <Show when={cp.comment.status === 'running'} fallback={
            <button class={btn} onClick={() => void startRun(cp.comment)}>Re-run</button>
          }>
            <button class={btn} onClick={() => void cancelRun(cp.comment)}>Cancel</button>
          </Show>
          <button class={btn} onClick={() => void dismiss(cp.comment)}>Dismiss</button>
        </div>
        <Show when={log() !== undefined}>
          <div
            ref={box}
            class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[#26282f] p-2 font-mono text-[11px] text-[#9aa0ab]"
          />
        </Show>
      </div>
    )
  }

  return (
    <>
      <div class={row}>
        <For each={FILTERS}>{(f) => (
          <button
            class={`${chip} ${filter() === f ? chipOn : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
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
          <span class={hint}>{`${visible().length}/${items().length}`}</span>
        </Show>
      </div>
      <div class="flex flex-col gap-2">
        <For each={visible()}>{(c) => <CommentCard comment={c} />}</For>
      </div>
      <Show when={visible().length === 0}>
        <p class={hint}>
          {items().length === 0
            ? 'no comments yet — pick an element and submit one'
            : 'nothing matches this filter'}
        </p>
      </Show>
    </>
  )
}
