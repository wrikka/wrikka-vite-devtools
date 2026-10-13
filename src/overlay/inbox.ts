import { el, panel } from './dom'
import type { Comment, OverlayApi } from './api'

export function openInbox(api: OverlayApi, root: ShadowRoot, onBadge?: (n: number) => void): void {
  const { body, remove } = panel(root, 'Comments')
  const list = el('div', { class: 'cards' })
  body.append(list)

  const logs = new Map<string, string>()
  const logNodes = new Map<string, HTMLElement>()
  let closed = false

  const timer = setInterval(() => void refresh(), 2000)
  void refresh()

  async function refresh(): Promise<void> {
    if (closed) return
    if (!list.isConnected) {
      close()
      return
    }
    try {
      const { items } = await api.call('list-comments')
      render(items as Comment[])
    } catch {
      /* dev server restarting — keep last render */
    }
  }

  function render(items: Comment[]): void {
    onBadge?.(items.filter((c) => c.status === 'queued' || c.status === 'running').length)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    list.replaceChildren(...items.map(commentCard))
    if (items.length === 0) list.append(el('p', { class: 'hint' }, ['no comments yet — pick an element and submit one']))
  }

  function commentCard(c: Comment): HTMLElement {
    const pill = el('span', { class: `status ${c.status}` }, [c.status])
    const run = el('button', { disabled: c.status === 'running' }, [c.status === 'running' ? 'Running…' : 'Re-run'])
    run.addEventListener('click', () => void startRun(c))
    const card = el('div', { class: 'comment' }, [
      pill,
      el('div', {}, [c.body]),
      el('div', { class: 'hint' }, [`${c.selection.mode} @ ${c.selection.cssPath} — ${c.page}`]),
      c.skills.length > 0 ? el('div', { class: 'hint' }, [`skills: ${c.skills.join(', ')}`]) : '',
      c.capturePath ? el('div', { class: 'hint' }, [`capture: ${c.capturePath}`]) : '',
      c.resultSummary ? el('div', { class: 'hint' }, [`result: ${c.resultSummary}`]) : '',
      run,
    ])
    const existing = logs.get(c.id)
    if (existing) {
      const box = el('div', { class: 'logs' }, [existing])
      logNodes.set(c.id, box)
      card.append(box)
    }
    return card
  }

  async function startRun(c: Comment): Promise<void> {
    const res = await api.call('run-agent', { commentId: c.id })
    if (res.started && res.streamId) void streamLogs(c.id, res.streamId as string)
    else if (res.reason) logs.set(c.id, `${logs.get(c.id) ?? ''}(${res.reason})\n`)
    void refresh()
  }

  async function streamLogs(commentId: string, streamId: string): Promise<void> {
    logs.set(commentId, logs.get(commentId) ?? '')
    try {
      for await (const chunk of api.subscribe('agent-logs', streamId)) {
        logs.set(commentId, logs.get(commentId)! + chunk)
        const node = logNodes.get(commentId)
        if (node) {
          node.textContent = logs.get(commentId)!
          node.scrollTop = node.scrollHeight
        }
      }
    } catch {
      /* stream lost */
    }
    void refresh()
  }

  function close(): void {
    closed = true
    clearInterval(timer)
    remove()
  }
}
