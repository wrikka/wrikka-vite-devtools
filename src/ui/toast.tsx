import { For, createSignal } from 'solid-js'

export type ToastTone = 'info' | 'ok' | 'warn' | 'bad'

interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

const [items, setItems] = createSignal<ToastItem[]>([])
let seq = 0

/** Fire-and-forget feedback for actions that have no inline status line. */
export function showToast(text: string, tone: ToastTone = 'info', ms = 2600): void {
  const id = ++seq
  setItems((prev) => [...prev.slice(-3), { id, text, tone }])
  setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), ms)
}

const tones: Record<ToastTone, string> = {
  info: 'border-line text-ink',
  ok: 'border-ok/50 text-ok-ink',
  warn: 'border-warn/50 text-warn-ink',
  bad: 'border-bad/50 text-bad-ink',
}

export function Toaster() {
  return (
    <div
      class="pointer-events-none fixed bottom-3 left-1/2 z-[2147483002] flex -translate-x-1/2 flex-col items-center gap-1.5"
      aria-live="polite"
    >
      <For each={items()}>
        {(t) => (
          <div
            class={`pointer-events-auto rounded-lg border border-solid bg-surface-raised px-3 py-1.5 text-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${tones[t.tone]}`}
            role="status"
          >
            {t.text}
          </div>
        )}
      </For>
    </div>
  )
}

/** Clipboard with an execCommand fallback for iframes that block the async API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
