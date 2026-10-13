import { el, panel } from './dom'
import { capturePage, pageUrl, type OverlayApi, type Selection } from './api'

export interface ComposerOptions {
  selection: Selection
  prefill?: string
}

function selectionHint(s: Selection): string {
  if (s.mode === 'page') return `whole page — ${s.framework ?? 'unknown'} framework`
  const label = s.mode === 'component' ? `${s.framework ?? '?'}:${s.componentLabel ?? s.tagName}` : s.tagName
  return `${s.mode} — ${label} @ ${s.cssPath}`
}

export function openComposer(api: OverlayApi, root: ShadowRoot, opts: ComposerOptions): void {
  const { body: node, remove: close } = panel(root, 'New comment')
  const selected = new Set<string>()

  const ta = el('textarea', { placeholder: 'What should the agent change here?' })
  if (opts.prefill) ta.value = opts.prefill
  const kind = el('select', {}, [el('option', { value: 'comment' }, ['Comment']), el('option', { value: 'idea' }, ['Idea'])])
  const capture = el('input', { type: 'checkbox' })
  const chips = el('div', { class: 'row' }, [el('span', { class: 'hint' }, ['skills: loading…'])])
  const msg = el('span', { class: 'hint' })
  const submit = el('button', { class: 'primary' }, ['Submit'])

  node.append(
    ta,
    el('div', { class: 'row' }, [el('span', { class: 'hint' }, [selectionHint(opts.selection)])]),
    el('div', { class: 'row' }, [kind, el('label', { class: 'row' }, [capture, ' attach page capture'])]),
    chips,
    el('div', { class: 'row' }, [submit, msg]),
  )
  ta.focus()

  void api
    .call('list-skills')
    .then((res: { skills: { name: string }[] }) => {
      chips.replaceChildren(
        ...res.skills.slice(0, 30).map((s) =>
          el('button', {
            class: 'chip',
            title: s.name,
            onclick: (e: Event) => {
              const on = selected.has(s.name)
              if (on) selected.delete(s.name)
              else selected.add(s.name)
              ;(e.target as HTMLElement).classList.toggle('on', !on)
            },
          }, [s.name]),
        ),
      )
      if (res.skills.length === 0) chips.replaceChildren(el('span', { class: 'hint' }, ['no skills found']))
    })
    .catch(() => chips.replaceChildren(el('span', { class: 'hint' }, ['skills unavailable'])))

  submit.addEventListener('click', () => void submitComment())

  async function submitComment(): Promise<void> {
    const body = ta.value.trim()
    if (!body) {
      msg.textContent = 'write something first'
      return
    }
    submit.disabled = true
    try {
      let capturePath: string | undefined
      if (capture.checked) {
        msg.textContent = 'capturing page…'
        const dataUrl = await capturePage()
        const saved = await api.call('save-capture', { dataUrl, page: pageUrl() })
        capturePath = saved.path as string
      }
      msg.textContent = 'submitting…'
      await api.call('submit-comment', {
        body,
        page: pageUrl(),
        kind: kind.value as 'comment' | 'idea',
        selection: opts.selection,
        skills: [...selected],
        capturePath,
      })
      msg.textContent = 'submitted — agent starts automatically'
      setTimeout(close, 1500)
    } catch (err) {
      msg.textContent = `failed: ${String(err)}`
      submit.disabled = false
    }
  }
}
