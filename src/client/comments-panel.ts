import type { Comment } from '../protocol'
import { buildCommentForm } from './comments-form'
import { hint, paragraph, row, type ClientApi } from './dom'

const STATUS_PILL: Record<Comment['status'], string> = {
  queued: 'bg-amber-100 text-amber-800 dark:(bg-amber-900 text-amber-200)',
  running: 'bg-blue-100 text-blue-800 dark:(bg-blue-900 text-blue-200)',
  done: 'bg-green-100 text-green-800 dark:(bg-green-900 text-green-200)',
  failed: 'bg-red-100 text-red-800 dark:(bg-red-900 text-red-200)',
}

export function mountComments(section: HTMLElement, api: ClientApi): void {
  const form = buildCommentForm(api, () => void refresh())
  const list = document.createElement('div')
  list.className = 'mt-4 space-y-3'
  section.append(form, list)

  const logs = new Map<string, string>()
  const subscribed = new Set<string>()
  const cards = new Map<string, HTMLElement>()
  let lastRender = ''

  setInterval(() => void refresh(), 2000)
  void refresh()

  async function refresh(): Promise<void> {
    try {
      const { items } = await api.call('list-comments')
      render(items as Comment[])
    } catch {
      /* dev server restarting — keep last render */
    }
  }

  function render(items: Comment[]): void {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const key = items.map((c) => `${c.id}:${c.status}:${c.resultSummary ?? ''}`).join('|')
    if (key === lastRender) return
    lastRender = key
    cards.clear()
    list.replaceChildren(...items.map((c) => {
      const card = commentCard(c)
      cards.set(c.id, card)
      return card
    }))
    if (items.length === 0) list.append(hint('no comments yet — submit one above, or use the in-page overlay'))
  }

  function commentCard(c: Comment): HTMLElement {
    const pill = document.createElement('span')
    pill.className = `rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[c.status]}`
    pill.textContent = c.status

    const running = c.status === 'running'
    const run = document.createElement('button')
    run.className = 'rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50'
    run.textContent = running ? 'Cancel' : 'Re-run'
    run.addEventListener('click', () => void (running ? cancelRun(c) : startRun(c)))

    const dismiss = document.createElement('button')
    dismiss.className = 'rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
    dismiss.textContent = 'Dismiss'
    dismiss.addEventListener('click', () => void remove(c))

    const card = document.createElement('article')
    card.className = 'space-y-1 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700'
    card.append(
      row([pill, kindTag(c), time(c)]),
      paragraph(c.body),
      hint(`${c.selection.mode} @ ${c.selection.cssPath ?? '—'} — ${c.page}`),
    )
    if (c.skills.length > 0) card.append(hint(`skills: ${c.skills.join(', ')}`))
    if (c.capturePath) card.append(hint(`capture: ${c.capturePath}`))
    if (c.resultSummary) card.append(hint(`result: ${c.resultSummary}`))

    const logBox = document.createElement('pre')
    logBox.className = 'hidden max-h-60 overflow-auto whitespace-pre-wrap rounded bg-neutral-900 p-2 font-mono text-xs text-neutral-100'
    const existing = logs.get(c.id)
    if (existing) {
      logBox.textContent = existing
      logBox.classList.remove('hidden')
      logBox.dataset.open = '1'
    }
    card.append(row([run, dismiss]), logBox)

    if (c.status === 'running' && c.streamId && !subscribed.has(c.streamId)) void streamLogs(c.id, c.streamId)
    return card
  }

  async function startRun(c: Comment): Promise<void> {
    const res = await api.call('run-agent', { commentId: c.id })
    if (res.streamId) void streamLogs(c.id, res.streamId as string)
    void refresh()
  }

  async function cancelRun(c: Comment): Promise<void> {
    await api.call('cancel-agent', { commentId: c.id })
    void refresh()
  }

  async function remove(c: Comment): Promise<void> {
    await api.call('delete-comment', { id: c.id })
    void refresh()
  }

  async function streamLogs(commentId: string, streamId: string): Promise<void> {
    if (subscribed.has(streamId)) return
    subscribed.add(streamId)
    logs.set(commentId, logs.get(commentId) ?? '')
    try {
      for await (const chunk of api.subscribe('agent-logs', streamId)) {
        logs.set(commentId, logs.get(commentId)! + chunk)
        const box = cards.get(commentId)?.querySelector('pre')
        if (box) {
          box.classList.remove('hidden')
          box.textContent = logs.get(commentId)!
          box.scrollTop = box.scrollHeight
        }
      }
    } catch {
      /* stream lost — next refresh re-renders */
    }
    void refresh()
  }
}

function kindTag(c: Comment): HTMLElement {
  const t = document.createElement('span')
  t.className = 'rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-800'
  t.textContent = c.kind
  return t
}

function time(c: Comment): HTMLElement {
  const t = document.createElement('span')
  t.className = 'text-xs text-neutral-500'
  t.textContent = new Date(c.createdAt).toLocaleString()
  return t
}
