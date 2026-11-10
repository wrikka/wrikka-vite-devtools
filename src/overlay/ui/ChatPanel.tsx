import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { btnPrimary, field, hint } from '../../ui/bits'
import { showToast } from '../../ui/toast'
import { readDraft, stashDraft } from '../../ui/draft-stash'
import { ExpandIcon, ShrinkIcon } from '../../ui/icons'
import { CloseIcon, LatestIcon } from './icons'
import { pageUrl, type Comment, type PanelApi } from '../api'
import { samePage } from '../anchor'
import { CHAT_WIDTH_PX } from '../page-shift'
import { submitPageComment } from '../submit-comment'
import ChatThread, { ChatEmpty } from './ChatThread'

export interface ChatPanelProps {
  api: PanelApi
  /** Current page path — fallback route target for submits. */
  route: string
  viewer: boolean
  /** Live comment list polled by App — the chat thread is derived from it. */
  comments: Comment[]
  /** False while the panel slides back out; it stays mounted for the transition. */
  open: boolean
  /** Fullscreen covers the viewport and drops the page shift. */
  full: boolean
  onToggleFull(): void
  onClose(): void
  onSubmitted(): void
}

const LOG_TAIL = 1200
const SLIDE = '260ms cubic-bezier(0.32, 0.72, 0, 1)'

function tail(text: string): string {
  return text.length > LOG_TAIL ? text.slice(-LOG_TAIL) : text
}

export default function ChatPanel(p: ChatPanelProps) {
  let list!: HTMLDivElement
  let ta!: HTMLTextAreaElement
  const [text, setText] = createSignal('')
  const [msg, setMsg] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [logs, setLogs] = createSignal<Record<string, string>>({})
  const [away, setAway] = createSignal(false)
  const page = pageUrl()
  const draftKey = `${page}#chat`

  const thread = createMemo(() =>
    p.comments.filter((c) => samePage(c.page)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  )
  const running = createMemo(() => thread().some((c) => c.status === 'running'))

  const followed = new Set<string>()
  let alive = true

  onMount(() => {
    const draft = readDraft(draftKey)
    if (draft?.body) setText(draft.body)
    ta.focus()
  })
  onCleanup(() => {
    alive = false
  })

  // Follow the agent-logs stream of every running comment on this page; the App
  // poll flips the status, this adds the live tail inside the agent bubble.
  createEffect(() => {
    for (const c of thread()) {
      if (c.status === 'running' && c.streamId && !followed.has(c.streamId)) {
        followed.add(c.streamId)
        void follow(c.id, c.streamId)
      }
    }
  })

  // Chase the tail only while the user is parked at the bottom — scrolling up
  // to re-read must not be yanked back by the next poll or log chunk.
  createEffect(() => {
    thread()
    logs()
    if (list && !away()) list.scrollTop = list.scrollHeight
  })

  function onListScroll(e: Event): void {
    const el = e.currentTarget as HTMLDivElement
    setAway(el.scrollHeight - el.scrollTop - el.clientHeight > 48)
  }

  function jumpToLatest(): void {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  async function follow(commentId: string, streamId: string): Promise<void> {
    try {
      for await (const chunk of p.api.subscribe('agent-logs', streamId)) {
        if (!alive) return
        setLogs((prev) => ({ ...prev, [commentId]: tail((prev[commentId] ?? '') + chunk) }))
      }
    } catch {
      /* stream lost — the poll still reports the final status */
    }
  }

  async function runAgent(c: Comment): Promise<void> {
    try {
      const res = (await p.api.call('run-agent', { commentId: c.id })) as {
        started?: boolean
        streamId?: string
        reason?: string
      }
      if (res.started && res.streamId && !followed.has(res.streamId)) {
        followed.add(res.streamId)
        void follow(c.id, res.streamId)
        showToast('agent run started', 'ok')
      } else if (res.reason) {
        showToast(String(res.reason), res.reason === 'already running' ? 'info' : 'warn')
      }
      p.onSubmitted()
    } catch (err) {
      showToast(`run failed: ${String(err)}`, 'bad')
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!busy()) void submit()
    }
  }

  async function submit(): Promise<void> {
    const body = text().trim()
    if (!body) {
      setMsg('write something first')
      return
    }
    if (p.viewer) {
      setMsg('read-only session — the viewer role cannot submit')
      return
    }
    setBusy(true)
    setMsg('sending…')
    try {
      await submitPageComment(p.api, { body, page, route: p.route, kind: 'comment' })
      stashDraft(draftKey, { body: '', skills: [] })
      setText('')
      setMsg('')
      showToast('message sent — the agent will pick it up', 'ok')
      p.onSubmitted()
    } catch (err) {
      setMsg(`failed: ${String(err)}`)
    }
    setBusy(false)
  }

  return (
    <div
      class={`fixed inset-y-0 z-[2147483000] flex flex-col border-r border-solid border-line bg-surface text-ink shadow-[0_0_32px_rgba(0,0,0,0.35)] ${p.open ? '' : 'pointer-events-none'}`}
      style={{
        left: p.full ? '0px' : `-${CHAT_WIDTH_PX}px`,
        width: p.full ? '100vw' : `${CHAT_WIDTH_PX}px`,
        transition: `left ${SLIDE}, width ${SLIDE}`,
      }}
      role="dialog"
      aria-label="Chat"
      aria-modal={p.full}
      aria-hidden={!p.open}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          p.onClose()
        }
      }}
    >
      <div class="flex items-center gap-2 border-b border-solid border-line px-3 py-2.5">
        <span
          class={`size-2 shrink-0 rounded-full ${running() ? 'animate-pulse bg-accent' : 'bg-ink-faint'}`}
          title={running() ? 'agent running' : 'idle'}
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-[13px] font-semibold tracking-[0.01em]">Chat</span>
          <span class={`${hint} truncate font-mono`} title={p.route}>
            {p.route}
          </span>
        </div>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-muted transition-colors hover:bg-control hover:text-ink focus-visible:bg-control focus-visible:text-ink focus-visible:outline-none"
          onClick={p.onToggleFull}
          aria-label={p.full ? 'Dock chat' : 'Fullscreen chat'}
          title={p.full ? 'Dock chat' : 'Fullscreen'}
        >
          {p.full ? <ShrinkIcon /> : <ExpandIcon />}
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-muted transition-colors hover:bg-control hover:text-ink focus-visible:bg-control focus-visible:text-ink focus-visible:outline-none"
          onClick={p.onClose}
          aria-label="Close chat"
          title="Close (Esc)"
        >
          <CloseIcon />
        </button>
      </div>

      <div class="relative flex min-h-0 flex-1 flex-col">
        <div ref={list} onScroll={onListScroll} class="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          <Show
            when={thread().length === 0}
            fallback={<For each={thread()}>{(c) => <ChatThread comment={c} log={logs()[c.id]} viewer={p.viewer} onRun={runAgent} />}</For>}
          >
            <ChatEmpty onPick={setText} />
          </Show>
        </div>
        <Show when={away()}>
          <button
            class="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-solid border-line-strong bg-surface-raised px-2.5 py-1 text-[11px] text-ink shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors hover:bg-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            onClick={jumpToLatest}
            aria-label="Jump to latest message"
          >
            <LatestIcon />
            Latest
          </button>
        </Show>
      </div>

      <div class="flex flex-col gap-1.5 border-t border-solid border-line p-2.5">
        <Show when={p.viewer}>
          <span class={`${hint} rounded-lg border border-solid border-warn/40 bg-warn/10 px-2 py-1 text-warn-ink`}>
            read-only session — the viewer role cannot submit
          </span>
        </Show>
        <textarea
          ref={ta}
          class={`${field} min-h-16 resize-y`}
          placeholder="Ask the agent to change this page… ⌘/Ctrl+Enter to send"
          value={text()}
          disabled={p.viewer}
          onInput={(e) => {
            setText(e.currentTarget.value)
            stashDraft(draftKey, { body: e.currentTarget.value, skills: [] })
          }}
          onKeyDown={onKey}
        />
        <div class="flex items-center gap-1.5">
          <span class={`${hint} mr-auto truncate`} role="status">
            {msg()}
          </span>
          <button class={btnPrimary} disabled={busy() || p.viewer} onClick={() => void submit()}>
            {busy() ? 'sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
