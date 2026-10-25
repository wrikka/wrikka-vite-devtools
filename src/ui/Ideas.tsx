import { For, Show, createSignal } from 'solid-js'
import type { Idea } from '../protocol'
import type { PanelApi } from './api'
import { btnPrimary, card, empty, field, hint, row, tonePill, type Tone } from './bits'

export interface IdeasProps {
  api: PanelApi
  /** Page the ideas are generated about — passed in so the hub can ask about the app page. */
  page: string
  /** Hub applies an idea through its own composer tab; omit to hide the button. */
  onApply?(idea: Idea): void
}

const impactTones: Record<string, Tone> = {
  High: 'bad',
  Medium: 'warn',
  Low: 'ok',
}

export default function Ideas(p: IdeasProps) {
  const [focus, setFocus] = createSignal('')
  const [msg, setMsg] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [ideas, setIdeas] = createSignal<Idea[]>([])

  async function run(): Promise<void> {
    setBusy(true)
    setMsg('asking the agent CLI — can take a minute…')
    setIdeas([])
    try {
      const res = await p.api.call('generate-ideas', {
        page: p.page,
        focus: focus().trim() || undefined,
      })
      const list = res.ideas as Idea[]
      if (list.length === 0) {
        setMsg(res.raw ? `no ideas parsed: ${String(res.raw).slice(0, 200)}` : 'no ideas returned')
        return
      }
      setMsg(`${list.length} ideas from [${res.driver}]`)
      setIdeas(list)
    } catch (err) {
      setMsg(`failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        class={field}
        type="text"
        placeholder="optional focus, e.g. checkout flow"
        value={focus()}
        onInput={(e) => setFocus(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy()) void run()
        }}
      />
      <div class={row}>
        <button class={btnPrimary} disabled={busy()} onClick={() => void run()}>
          Generate
        </button>
        <span class={hint} role="status">
          {msg()}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <Show
          when={ideas().length > 0}
          fallback={
            <p class={empty}>
              No ideas yet.
              <br />
              Pick a focus (optional) and press Generate — the agent CLI reads the page and proposes changes.
            </p>
          }
        >
          <For each={ideas()}>{(idea) => (
            <div class={card}>
              <div class={row}>
                <span class={tonePill(impactTones[idea.impact] ?? 'accent')}>{idea.impact}</span>
                <h3 class="m-0 text-[13px] font-medium text-ink">{idea.title}</h3>
              </div>
              <div class={hint}>{idea.detail}</div>
              <Show when={p.onApply}>
                <button class={`${btnPrimary} w-fit`} onClick={() => p.onApply?.(idea)}>
                  Apply
                </button>
              </Show>
            </div>
          )}</For>
        </Show>
      </div>
    </>
  )
}
