import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { btnPrimary, field, hint } from '../../ui/bits'
import { showToast } from '../../ui/toast'
import { readDraft, stashDraft } from '../../ui/draft-stash'
import { pageUrl, type Comment, type PanelApi } from '../api'
import { samePage } from '../anchor'
import { CHAT_WIDTH_PX } from '../page-shift'
import { submitPageComment } from '../submit-comment'
import ChatThread from './ChatThread'

export interface ChatPanelProps {
  api: PanelApi
  /** Current page path — fallback route target for submits. */
  route: string
  viewer: boolean
  /** Live comment list polled by App — the chat thread is derived from it. */
  comments: Comment[]
  /** False while the panel slides back out; it stays mounted for the transition. */
  open: boolean
  onClose(): void
  onSubmitted(): void
}

const LOG_TAIL = 1200

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
  const page = pageUrl()
  const draftKey = `${page}#chat`

  const thread = createMemo(() =>
    p.comments.filter((c) => samePage(c.page)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  )

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

  // Keep the newest message in view while the thread grows or logs stream in.
  createEffect(() => {
    thread()
    logs()
    if (list) list.scrollTop = list.scrollHeight
  })

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
      class={`fixed inset-y-0 z-[2147483000] flex flex-col border-r border-solid border-line bg-surface text-ink shadow-[0_0_48px_rgba(0,0,0,0.4)] ${p.open ? '' : 'pointer-events-none'}`}
      style={{ left: `-${CHAT_WIDTH_PX}px`, width: `${CHAT_WIDTH_PX}px` }}
      role="dialog"
      aria-label="Chat"
      aria-hidden={!p.open}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          p.onClose()
        }
      }}
    >
      <div class="flex items-center gap-2 border-b border-solid border-line px-3 py-2.5">
        <span class="text-[13px] font-semibold tracking-[0.01em]">Chat</span>
        <span class={`${hint} min-w-0 flex-1 truncate font-mono`} title={p.route}>
          {p.route}
        </span>
        <button
          class="cursor-pointer rounded-md border-none bg-transparent px-1.5 text-[12px] text-ink-muted hover:bg-control hover:text-ink"
          onClick={p.onClose}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      <div ref={list} class="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Show when={thread().length === 0}>
          <p class={`${hint} m-0 py-6 text-center`}>
            No comments on this page yet — send a message and the agent picks it up.
          </p>
        </Show>
        <For each={thread()}>
          {(c) => <ChatThread comment={c} log={logs()[c.id]} viewer={p.viewer} onRun={runAgent} />}
        </For>
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
