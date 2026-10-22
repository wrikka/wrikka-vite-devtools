import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { Comment } from '../../protocol'
import { findTarget, pagePins } from '../anchor'
import { hint, statusPill } from '../../ui/bits'

export interface PinsProps {
  comments: Comment[]
  visible: boolean
}

interface Pin {
  comment: Comment
  target: Element
}

interface Spot {
  left: number
  top: number
  hidden: boolean
}

export default function Pins(p: PinsProps) {
  const pins = createMemo<Pin[]>(() =>
    pagePins(p.comments).flatMap((c) => {
      const target = findTarget(c.selection.cssPath)
      return target ? [{ comment: c, target }] : []
    }),
  )
  const [spots, setSpots] = createSignal<Spot[]>([])
  const [openId, setOpenId] = createSignal<string | undefined>()
  const open = createMemo(() => pins().find((x) => x.comment.id === openId()))

  let frame = 0
  let bubble!: HTMLDivElement

  function reposition(): void {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      setSpots(
        pins().map(({ target }) => {
          const r = target.getBoundingClientRect()
          return {
            hidden: !p.visible || (r.width === 0 && r.height === 0),
            left: Math.min(Math.max(r.left + 6, 6), innerWidth - 26),
            top: Math.min(Math.max(r.top + 6, 6), innerHeight - 26),
          }
        }),
      )
      placeBubble()
    })
  }

  function placeBubble(): void {
    const pin = open()
    if (!pin || !bubble) return
    const r = pin.target.getBoundingClientRect()
    const h = bubble.offsetHeight || 120
    const w = bubble.offsetWidth || 280
    const top = r.bottom + h + 16 <= innerHeight ? r.bottom + 8 : Math.max(8, r.top - h - 8)
    bubble.style.left = `${Math.min(Math.max(r.left, 8), innerWidth - w - 8)}px`
    bubble.style.top = `${Math.max(8, Math.min(top, innerHeight - h - 8))}px`
  }

  onMount(() => {
    addEventListener('scroll', reposition, { capture: true, passive: true })
    addEventListener('resize', reposition)
    onCleanup(() => {
      removeEventListener('scroll', reposition, true)
      removeEventListener('resize', reposition)
      cancelAnimationFrame(frame)
    })
  })
  createEffect(() => {
    pins()
    p.visible
    reposition()
  })
  createEffect(() => {
    if (open() && p.visible !== false) placeBubble()
  })
  createEffect(() => {
    if (!p.visible) setOpenId(undefined)
  })

  function toggle(id: string): void {
    setOpenId((prev) => (prev === id ? undefined : id))
  }

  return (
    <>
      <For each={pins()}>{(pin, i) => {
        const spot = createMemo(() => spots()[i()] ?? { left: 0, top: 0, hidden: true })
        return (
          <button
            class={`fixed z-[2147482999] flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-solid border-line bg-accent p-0 text-[10px] font-bold text-white ${spot().hidden ? 'invisible' : ''}`}
            style={{ left: `${spot().left}px`, top: `${spot().top}px` }}
            title={pin.comment.body}
            aria-label={`comment ${i() + 1}`}
            onClick={() => toggle(pin.comment.id)}
          >
            {i() + 1}
          </button>
        )
      }}</For>
      <Show when={open()}>
        {(pin) => (
          <div
            ref={bubble}
            role="status"
            class="fixed z-[2147483001] w-[280px] rounded-xl border border-solid border-line bg-surface-raised p-2 text-ink shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div class="flex items-start gap-1.5">
              <span class={statusPill(pin().comment.status)}>{pin().comment.status}</span>
              <button
                class="ml-auto cursor-pointer rounded-md border-none bg-transparent px-1 text-[12px] text-ink-muted hover:bg-control hover:text-ink"
                onClick={() => setOpenId(undefined)}
                aria-label="Close pin bubble"
              >
                ✕
              </button>
            </div>
            <div>{pin().comment.body}</div>
            <div class={hint}>{`${pin().comment.selection.mode} @ ${pin().comment.selection.cssPath}`}</div>
            <Show when={pin().comment.resultSummary}>
              <div class={hint}>{`result: ${pin().comment.resultSummary}`}</div>
            </Show>
          </div>
        )}
      </Show>
    </>
  )
}
