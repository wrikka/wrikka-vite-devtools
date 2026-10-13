import { For, createSignal } from 'solid-js'
import { pageUrl, type Idea, type OverlayApi } from '../api'
import { btnPrimary, card, field, hint, row } from './bits'

export interface IdeasProps {
  api: OverlayApi
  onApply(idea: Idea): void
}

const impactColors: Record<string, string> = {
  High: 'bg-[#7c2d3a]',
  Medium: 'bg-[#7a5b1e]',
  Low: 'bg-[#2e6b45]',
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
        page: pageUrl(),
        focus: focus().trim() || undefined,
      })
      const list = res.ideas as Idea[]
      if (list.length === 0) {
        setMsg(res.raw ? `no ideas parsed: ${String(res.raw).slice(0, 200)}` : 'no ideas returned')
        return
      }
      setMsg(`${list.length} ideas from [${res.driver}] — apply one to open the composer`)
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
        <For each={ideas()}>{(idea) => (
          <div class={card}>
            <div class={row}>
              <span
                class={`w-fit rounded border border-solid border-[#3a3d46] px-1.5 text-[10px] font-bold uppercase text-white ${impactColors[idea.impact] ?? ''}`}
              >
                {idea.impact}
              </span>
              <h3 class="m-0 text-[13px] font-medium">{idea.title}</h3>
            </div>
            <div class={hint}>{idea.detail}</div>
            <button class={btnPrimary} onClick={() => p.onApply(idea)}>
              Apply
            </button>
          </div>
        )}</For>
      </div>
    </>
  )
}
