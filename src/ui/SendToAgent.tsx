import { createSignal } from 'solid-js'
import type { Selection } from '../protocol'
import type { PanelApi } from './api'
import { btnPrimary, field, hint, row } from './bits'

export interface SendToAgentProps {
  api: PanelApi
  /** What the agent prompt names as the request target — a source path or a route url. */
  page: string
  selection: Selection
  placeholder: string
}

/** One-line instruction that becomes a normal comment, so the agent run and the inbox stay the same. */
export default function SendToAgent(p: SendToAgentProps) {
  let input!: HTMLInputElement
  const [busy, setBusy] = createSignal(false)
  const [msg, setMsg] = createSignal('')

  async function send(): Promise<void> {
    const body = input.value.trim()
    if (!body) {
      setMsg('write an instruction first')
      return
    }
    setBusy(true)
    try {
      await p.api.call('submit-comment', { body, page: p.page, kind: 'comment', selection: p.selection })
      input.value = ''
      setMsg('sent — it shows up in the Inbox and the agent starts')
    } catch (err) {
      setMsg(`failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class={`${row} pt-1`}>
      <input
        ref={input}
        class={`${field} flex-1 font-mono`}
        aria-label={`Instruction for ${p.page}`}
        placeholder={p.placeholder}
        disabled={busy()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (!busy()) void send()
          }
        }}
      />
      <button class={btnPrimary} disabled={busy()} onClick={() => void send()}>
        {busy() ? 'sending…' : 'Ask agent'}
      </button>
      <span class={`${hint} w-full`} role="status">
        {msg()}
      </span>
    </div>
  )
}
