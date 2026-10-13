import { For, Show, createSignal, onMount } from 'solid-js'
import { capturePage, pageUrl, type OverlayApi, type Selection } from '../api'
import { btn, btnPrimary, chip, chipOn, field, hint, row } from './bits'

export interface ComposerProps {
  api: OverlayApi
  selection: Selection
  prefill?: string
  onClose(): void
}

function selectionHint(s: Selection): string {
  if (s.mode === 'page') return `whole page — ${s.framework ?? 'unknown'} framework`
  const label = s.mode === 'component' ? `${s.framework ?? '?'}:${s.componentLabel ?? s.tagName}` : s.tagName
  return `${s.mode} — ${label} @ ${s.cssPath}`
}

export default function Composer(p: ComposerProps) {
  let ta!: HTMLTextAreaElement
  let kind!: HTMLSelectElement
  const [msg, setMsg] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [attach, setAttach] = createSignal(false)
  const [skills, setSkills] = createSignal<{ name: string }[] | undefined>()
  const [chosen, setChosen] = createSignal<Set<string>>(new Set())

  onMount(() => {
    if (p.prefill) ta.value = p.prefill
    void p.api
      .call('list-skills', {})
      .then((res: { skills: { name: string }[] }) => setSkills(res.skills.slice(0, 30)))
      .catch(() => setSkills([]))
  })

  function toggleSkill(name: string): void {
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function submit(): Promise<void> {
    const body = ta.value.trim()
    if (!body) {
      setMsg('write something first')
      return
    }
    setBusy(true)
    try {
      let capturePath: string | undefined
      if (attach()) {
        setMsg('capturing page…')
        const dataUrl = await capturePage()
        const saved = await p.api.call('save-capture', { dataUrl, page: pageUrl() })
        capturePath = saved.path as string
      }
      setMsg('submitting…')
      await p.api.call('submit-comment', {
        body,
        page: pageUrl(),
        kind: kind.value as 'comment' | 'idea',
        selection: p.selection,
        skills: [...chosen()],
        capturePath,
      })
      setMsg(kind.value === 'comment' ? 'submitted — agent starts automatically' : 'submitted')
      setTimeout(p.onClose, 1500)
    } catch (err) {
      setMsg(`failed: ${String(err)}`)
      setBusy(false)
    }
  }

  return (
    <>
      <textarea
        ref={ta}
        class={`${field} min-h-16 resize-y`}
        placeholder="What should the agent change here? (Ctrl/Cmd+Enter to submit)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (!busy()) void submit()
          }
        }}
      />
      <div class={row}>
        <span class={hint}>{selectionHint(p.selection)}</span>
      </div>
      <div class={row}>
        <select
          ref={kind}
          class={btn}
          aria-label="Comment kind"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <option value="comment">Comment</option>
          <option value="idea">Idea</option>
        </select>
        <label class={`${row} cursor-pointer`}>
          <input
            type="checkbox"
            checked={attach()}
            onChange={(e) => setAttach(e.currentTarget.checked)}
          />
          attach page capture
        </label>
      </div>
      <div class={row}>
        <Show
          when={skills()}
          fallback={<span class={hint}>{skills() === undefined ? 'skills: loading…' : 'no skills found'}</span>}
        >
          {(list) => (
            <>
              <span class={hint}>skills:</span>
              <For each={list()}>{(s) => (
                <button
                  class={`${chip} ${chosen().has(s.name) ? chipOn : ''}`}
                  title={s.name}
                  onClick={() => toggleSkill(s.name)}
                >
                  {s.name}
                </button>
              )}</For>
            </>
          )}
        </Show>
      </div>
      <div class={row}>
        <button class={btnPrimary} disabled={busy()} onClick={() => void submit()}>
          Submit
        </button>
        <span class={hint} role="status">
          {msg()}
        </span>
      </div>
    </>
  )
}
