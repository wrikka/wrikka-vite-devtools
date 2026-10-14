import type { Selection } from '../protocol'
import { hint, label, option, row, select, type ClientApi } from './dom'

export function buildCommentForm(api: ClientApi, onDone: () => void): HTMLElement {
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
