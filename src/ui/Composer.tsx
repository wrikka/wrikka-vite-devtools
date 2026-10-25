import { For, Show, createSignal, onCleanup, onMount } from 'solid-js'
import type { Selection } from '../protocol'
import type { PanelApi } from './api'
import { useAccess } from './access-store'
import { showToast } from './toast'
import { readDraft, stashDraft } from './draft-stash'
import FocusChips, { focusPrefix, type FocusArea } from './FocusChips'
import { btn, btnPrimary, card, chip, chipOn, field, hint, row, sectionLabel } from './bits'

export interface ComposerProps {
  api: PanelApi
  selection: Selection
  /** Target page url — the hub iframe lives on a devtools route, so callers pass it in. */
  page: string
  prefill?: string
  /** Omitted on pages with nothing to capture (the hub); the attach row then hides. */
  capture?: () => Promise<string>
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
  let save: ReturnType<typeof setTimeout> | undefined
  const [msg, setMsg] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [attach, setAttach] = createSignal(false)
  const [skills, setSkills] = createSignal<{ name: string }[] | undefined>()
  const [chosen, setChosen] = createSignal<Set<string>>(new Set())
  const [focus, setFocus] = createSignal<FocusArea[]>([])
  const access = useAccess(p.api)

  function remember(): void {
    clearTimeout(save)
    save = setTimeout(() => stashDraft(p.page, { body: ta.value, skills: [...chosen()] }), 300)
  }

  onMount(() => {
    if (p.prefill) ta.value = p.prefill
    else {
      const draft = readDraft(p.page)
      if (draft) {
        ta.value = draft.body
        setChosen(new Set(draft.skills))
      }
    }
    void p.api
      .call('list-skills', {})
      .then((res: { skills: { name: string }[] }) => setSkills(res.skills.slice(0, 30)))
      .catch(() => setSkills([]))
  })
  onCleanup(() => clearTimeout(save))

  function toggleSkill(name: string): void {
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
    remember()
  }

  function toggleFocus(area: FocusArea): void {
    setFocus((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]))
  }

  async function submit(): Promise<void> {
    if (!access.can('comment:write')) {
      setMsg('read-only session — commenting is disabled')
      showToast('read-only session — commenting is disabled', 'warn')
      return
    }
    const text = ta.value.trim()
    if (!text) {
      setMsg('write something first')
      return
    }
    const body = focusPrefix(focus()) + text
    setBusy(true)
    try {
      let capturePath: string | undefined
      if (attach() && p.capture) {
        setMsg('capturing page…')
        const dataUrl = await p.capture()
        const saved = await p.api.call('save-capture', { dataUrl, page: p.page })
        capturePath = saved.path as string
      }
      setMsg('submitting…')
      await p.api.call('submit-comment', {
        body,
        page: p.page,
        kind: kind.value as 'comment' | 'idea',
        selection: p.selection,
        skills: [...chosen()],
        capturePath,
      })
      setMsg(kind.value === 'comment' ? 'submitted — agent starts automatically' : 'submitted')
      showToast(kind.value === 'comment' ? 'comment submitted — agent starting' : 'idea submitted', 'ok')
      stashDraft(p.page, { body: '', skills: [] })
      setTimeout(p.onClose, 1500)
    } catch (err) {
      setMsg(`failed: ${String(err)}`)
      showToast(`submit failed: ${String(err)}`, 'bad')
      setBusy(false)
    }
  }

  return (
    <div class={`${card} gap-2`}>
      <span class={sectionLabel}>comment</span>
      <Show when={access.readOnly()}>
        <span class={`${hint} rounded-md border border-solid border-warn/40 bg-warn/10 px-2 py-1 text-warn-ink`}>
          Read-only session (viewer role) — comments and captures are disabled.
        </span>
      </Show>
      <FocusChips selected={focus()} onToggle={toggleFocus} />
      <textarea
        ref={ta}
        class={`${field} min-h-20 resize-y`}
        placeholder="What should the agent change here? (Ctrl/Cmd+Enter to submit)"
        disabled={access.readOnly()}
        onInput={remember}
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
      <details class="group">
        <summary class="cursor-pointer text-[11px] text-ink-muted hover:text-ink">Options</summary>
        <div class={`${row} mt-1.5`}>
          <select
            ref={kind}
            class={btn}
            aria-label="Comment kind"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <option value="comment">Comment</option>
            <option value="idea">Idea</option>
          </select>
          <Show when={p.capture}>
            <label class={`${row} cursor-pointer`}>
              <input
                type="checkbox"
                checked={attach()}
                disabled={access.readOnly()}
                onChange={(e) => setAttach(e.currentTarget.checked)}
              />
              attach page capture
            </label>
          </Show>
        </div>
        <div class={`${row} mt-1.5`}>
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
      </details>
      <div class={`${row} justify-end`}>
        <span class={`${hint} mr-auto`} role="status">
          {msg()}
        </span>
        <button class={btnPrimary} disabled={busy() || access.readOnly()} onClick={() => void submit()}>
          Submit
        </button>
      </div>
    </div>
  )
}
