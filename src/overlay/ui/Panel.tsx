import { onCleanup, onMount, type ParentProps } from 'solid-js'

export interface PanelProps extends ParentProps {
  title: string
  onClose(): void
}

/** Dialog card anchored above the toolbar strip; Esc closes, focus is managed. */
export default function Panel(p: PanelProps) {
  let node!: HTMLDivElement
  const previous = document.activeElement as HTMLElement | null

  onMount(() => {
    node.querySelector<HTMLElement>('textarea, input:not([type=checkbox]), select')?.focus()
  })
  onCleanup(() => previous?.focus?.())

  return (
    <div
      ref={node}
      role="dialog"
      aria-label={p.title}
      class="fixed bottom-11 left-3 z-[2147483001] flex max-h-[min(70vh,560px)] w-[min(440px,calc(100vw-24px))] flex-col gap-2 overflow-auto rounded-xl border border-solid border-[#3a3d46] bg-[#17181d] p-3 text-[#e8e9ed] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          p.onClose()
        }
      }}
    >
      <div class="flex items-center gap-2">
        <h3 class="m-0 text-[13px] font-medium">{p.title}</h3>
        <button
          class="ml-auto cursor-pointer rounded-md border-none bg-transparent px-1.5 text-[12px] text-[#9aa0ab] hover:bg-[#26282f] hover:text-[#e8e9ed]"
          onClick={p.onClose}
          aria-label={`Close ${p.title}`}
        >
          ✕
        </button>
      </div>
      {p.children}
    </div>
  )
}
