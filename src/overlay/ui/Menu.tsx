import { For, onCleanup, onMount } from 'solid-js'
import { hint } from '../../ui/bits'

export interface MenuAction {
  id: string
  label: string
  run(): void
}

export interface MenuProps {
  /** Viewport coords to anchor the menu at (top-left of the picked element). */
  x: number
  y: number
  actions: MenuAction[]
  onClose(): void
}

const item =
  'w-full cursor-pointer rounded-md border-none bg-transparent px-2 py-1 text-left text-[12px] text-ink hover:bg-control-hover focus:bg-control-hover focus:outline-none'

/** Context menu shown where an element was picked: labelled source-search targets. */
export default function Menu(p: MenuProps) {
  let node!: HTMLDivElement

  function place(): void {
    const w = node.offsetWidth || 220
    const h = node.offsetHeight || 120
    node.style.left = `${Math.max(8, Math.min(p.x, innerWidth - w - 8))}px`
    node.style.top = `${Math.max(8, Math.min(p.y + 24, innerHeight - h - 8))}px`
  }

  function outside(e: MouseEvent): void {
    if (!node.contains(e.target as Node)) p.onClose()
  }

  onMount(() => {
    place()
    node.querySelector<HTMLButtonElement>('button')?.focus()
    // Capture on document: the shadow host itself is not a "click inside".
    addEventListener('mousedown', outside, true)
    onCleanup(() => removeEventListener('mousedown', outside, true))
  })

  function step(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      return p.onClose()
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.stopPropagation()
    const items = [...node.querySelectorAll<HTMLButtonElement>('button')]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div
      ref={node}
      role="menu"
      aria-label="Search this element in source"
      class="fixed z-[2147483004] flex w-56 flex-col gap-0.5 rounded-xl border border-solid border-line bg-surface-raised p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.5)] select-none"
      onKeyDown={step}
    >
      <span class={`${hint} px-2 pb-0.5 pt-1`}>Search in source</span>
      <For each={p.actions}>
        {(a) => (
          <button class={item} role="menuitem" onClick={a.run}>
            {a.label}
          </button>
        )}
      </For>
    </div>
  )
}
