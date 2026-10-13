import { el, panel } from './dom'
import { pageUrl, type Idea, type OverlayApi } from './api'

export function openIdeas(api: OverlayApi, root: ShadowRoot, onApply: (idea: Idea) => void): void {
  const { body, remove } = panel(root, 'Generate ideas')
  const focus = el('input', { type: 'text', placeholder: 'optional focus, e.g. checkout flow' })
  const generate = el('button', { class: 'primary' }, ['Generate'])
  const msg = el('span', { class: 'hint' })
  const cards = el('div', { class: 'cards' })
  body.append(focus, el('div', { class: 'row' }, [generate, msg]), cards)

  generate.addEventListener('click', () => void run())

  async function run(): Promise<void> {
    generate.disabled = true
    msg.textContent = 'asking the agent CLI — can take a minute…'
    cards.replaceChildren()
    try {
      const res = await api.call('generate-ideas', { page: pageUrl(), focus: focus.value.trim() || undefined })
      const ideas = res.ideas as Idea[]
      if (ideas.length === 0) {
        msg.textContent = res.raw ? `no ideas parsed: ${String(res.raw).slice(0, 200)}` : 'no ideas returned'
        return
      }
      msg.textContent = `${ideas.length} ideas from [${res.driver}] — apply one to open the composer`
      cards.replaceChildren(...ideas.map(card))
    } catch (err) {
      msg.textContent = `failed: ${String(err)}`
    } finally {
      generate.disabled = false
    }
  }

  function card(idea: Idea): HTMLElement {
    const apply = el('button', { class: 'primary' }, ['Apply'])
    apply.addEventListener('click', () => {
      remove()
      onApply(idea)
    })
    return el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [el('span', { class: `impact ${idea.impact}` }, [idea.impact]), el('h3', {}, [idea.title])]),
      el('div', { class: 'hint' }, [idea.detail]),
      apply,
    ])
  }
}
