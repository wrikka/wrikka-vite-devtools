import { onCleanup, onMount, type ParentProps } from 'solid-js'
import { CloseIcon } from './icons'

export interface PanelProps extends ParentProps {
  title: string
  onClose(): void
}

/** Centred modal card with a click-away backdrop; Esc closes, focus is managed. */
export default function Panel(p: PanelProps) {
  let node!: HTMLDivElement
  const previous = document.activeElement as HTMLElement | null

  onMount(() => {
    node.querySelector<HTMLElement>('textarea, input:not([type=checkbox]), select, button')?.focus()
  })
  onCleanup(() => previous?.focus?.())

  return (
    <div
      class="fixed inset-0 z-[2147483001] flex items-center justify-center bg-black/40 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) p.onClose()
      }}
    >
      <div
        ref={node}
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        class="flex max-h-[min(80vh,600px)] w-[min(460px,100%)] flex-col gap-2.5 overflow-auto rounded-xl border border-solid border-line bg-surface-raised p-3.5 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            p.onClose()
          }
        }}
      >
        <div class="flex items-center gap-2">
          <h3 class="m-0 text-[13px] font-semibold tracking-[0.01em]">{p.title}</h3>
          <button
            class="ml-auto flex size-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-muted transition-colors hover:bg-control hover:text-ink focus-visible:bg-control focus-visible:text-ink focus-visible:outline-none"
            onClick={p.onClose}
            aria-label={`Close ${p.title}`}
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>
        {p.children}
      </div>
    </div>
  )
}
