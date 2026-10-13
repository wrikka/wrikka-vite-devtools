import type { Comment, Selection } from '../protocol'

export interface ClientApi {
  call(id: string, args?: unknown): Promise<any>
  subscribe(channel: string, id: string): AsyncIterable<string>
}

const STATUS_PILL: Record<Comment['status'], string> = {
  queued: 'bg-amber-100 text-amber-800 dark:(bg-amber-900 text-amber-200)',
  running: 'bg-blue-100 text-blue-800 dark:(bg-blue-900 text-blue-200)',
  done: 'bg-green-100 text-green-800 dark:(bg-green-900 text-green-200)',
  failed: 'bg-red-100 text-red-800 dark:(bg-red-900 text-red-200)',
}

export function mountComments(section: HTMLElement, api: ClientApi): void {
  const form = buildForm(api, () => void refresh())
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

    const run = document.createElement('button')
    run.className = 'rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50'
    run.disabled = c.status === 'running'
    run.textContent = c.status === 'running' ? 'Running…' : 'Re-run'
    run.addEventListener('click', () => void startRun(c))

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
    card.append(run, logBox)

    if (c.status === 'running' && c.streamId && !subscribed.has(c.streamId)) void streamLogs(c.id, c.streamId)
    return card
  }

  async function startRun(c: Comment): Promise<void> {
    const res = await api.call('run-agent', { commentId: c.id })
    if (res.streamId) void streamLogs(c.id, res.streamId as string)
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

function buildForm(api: ClientApi, onDone: () => void): HTMLElement {
  const body = document.createElement('textarea')
  body.placeholder = 'what should the agent change?'
  body.rows = 3
  body.className = 'w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700'

  const kind = select('kind', ['comment', 'idea'])
  const mode = select('mode', ['page', 'element', 'component'])
  const cssPath = document.createElement('input')
  cssPath.placeholder = 'css path (e.g. main > h1) — use "html" for the whole page'
  cssPath.value = 'html'
  cssPath.className = 'rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700'

  const page = document.createElement('input')
  page.placeholder = 'page url the comment targets'
  page.value = window.location.origin + '/'
  page.className = 'rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700'

  const skills = document.createElement('select')
  skills.multiple = true
  skills.size = 6
  skills.className = 'w-full rounded border border-neutral-300 p-1 text-xs dark:border-neutral-700'
  skills.add(option('', 'no skills attached'))
  void api
    .call('list-skills', {})
    .then((res: { skills: { name: string; description: string }[] }) => {
      skills.replaceChildren()
      for (const s of res.skills) skills.add(option(s.name, `${s.name} — ${s.description.slice(0, 80)}`))
    })
    .catch(() => {
      /* skill roots unreadable — form works without attachments */
    })

  const submit = document.createElement('button')
  submit.className = 'rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
  submit.textContent = 'Submit'
  submit.addEventListener('click', () => void send())

  const note = hint('')
  const grid = document.createElement('div')
  grid.className = 'grid gap-2'
  grid.append(body, row([kind, mode]), cssPath, page, label('skills (ctrl-click to multi-select)'), skills, row([submit, note]))
  return grid

  async function send(): Promise<void> {
    if (body.value.trim().length === 0) {
      note.textContent = 'write something first'
      return
    }
    submit.disabled = true
    note.textContent = 'submitting…'
    const selection: Selection = { mode: mode.value as Selection['mode'], cssPath: cssPath.value || undefined }
    try {
      await api.call('submit-comment', {
        body: body.value,
        page: page.value || window.location.href,
        kind: kind.value,
        selection,
        skills: Array.from(skills.selectedOptions)
          .map((o) => o.value)
          .filter(Boolean),
      })
      body.value = ''
      note.textContent = 'submitted — agent picks it up automatically'
      onDone()
    } catch (err) {
      note.textContent = `submit failed: ${String(err)}`
    } finally {
      submit.disabled = false
    }
  }
}

function select(marker: string, values: string[]): HTMLSelectElement {
  const s = document.createElement('select')
  s.className = 'rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700'
  for (const v of values) s.add(option(v, v))
  s.setAttribute('data-select', marker)
  return s
}

function option(value: string, text: string): HTMLOptionElement {
  const o = document.createElement('option')
  o.value = value
  o.textContent = text
  return o
}

function label(text: string): HTMLElement {
  const l = document.createElement('p')
  l.className = 'text-xs text-neutral-500'
  l.textContent = text
  return l
}

function row(nodes: Node[]): HTMLElement {
  const d = document.createElement('div')
  d.className = 'flex flex-wrap items-center gap-2'
  d.append(...nodes)
  return d
}

function paragraph(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'text-sm'
  p.textContent = text
  return p
}

function hint(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'text-xs text-neutral-500'
  p.textContent = text
  return p
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
