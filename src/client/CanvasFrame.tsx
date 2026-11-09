import { Show } from 'solid-js'
import { hint, kindTone, meter, meterTone, tonePill, toneSoft } from '../ui/bits'
import type { BoardFrame } from './canvas-board'
import CanvasPreview from './CanvasPreview'

export interface CanvasFrameProps {
  frame: BoardFrame
  selected: boolean
  dimmed: boolean
  /** This frame currently owns an iframe (gated by zoom and viewport). */
  preview: boolean
  previewSrc?: string
  onSelect(): void
  onFocus(): void
}

/** One artboard on the board: a route page with a live/wireframe body, or a component card. */
export default function CanvasFrame(p: CanvasFrameProps) {
  const f = () => p.frame
  const isPage = () => f().kind === 'page'
  const initial = () => f().label.slice(0, 1).toUpperCase()
  const locWidth = () => `${Math.min(100, Math.round((f().loc / 250) * 100))}%`

  return (
    <div
      data-frame
      role="button"
      tabindex="0"
      class={`absolute flex cursor-pointer flex-col gap-1 rounded-lg border border-solid p-2 text-left transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        p.selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface-raised hover:border-line-strong'
      } ${p.dimmed ? 'opacity-25' : ''}`}
      style={{ left: `${f().x}px`, top: `${f().y}px`, width: `${f().w}px`, height: `${f().h}px` }}
      aria-pressed={p.selected}
      aria-label={`${f().kind} ${f().label}`}
      onClick={p.onSelect}
      onDblClick={p.onFocus}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        p.onSelect()
      }}
    >
      <span class="flex items-center gap-1.5">
        <span class="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink" title={f().label}>
          {f().label}
        </span>
        <span class={tonePill(isPage() ? 'ok' : kindTone(f().badge))}>{f().badge}</span>
      </span>

      <Show
        when={isPage()}
        fallback={
          <>
            <span class="mt-0.5 flex items-center gap-2">
              <span
                class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-bold ${toneSoft(kindTone(f().badge))}`}
                aria-hidden="true"
              >
                {initial()}
              </span>
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class={`${hint} flex items-baseline justify-between gap-1 tabular-nums`}>
                  <span>{f().loc} lines</span>
                  <span class="rounded-full bg-control px-1.5 text-[10px] text-ink-muted">
                    {f().refs} refs
                  </span>
                </span>
                <span class={meter} title={`${f().loc} of 250 lines`}>
                  <span
                    class={`block h-full rounded-full ${meterTone(f().loc)}`}
                    style={{ width: locWidth() }}
                  />
                </span>
              </span>
            </span>
            <span class={`${hint} mt-auto truncate font-mono`} title={f().file}>
              {f().file}
            </span>
          </>
        }
      >
        <span class={`${hint} truncate font-mono`} title={f().file}>
          {f().file}
        </span>
        <Show
          when={p.preview && p.previewSrc}
          fallback={
            <span class="mt-1 flex flex-1 flex-col gap-1 rounded border border-solid border-line bg-surface-sunken p-1.5">
              <span class="h-2 w-1/3 rounded-sm bg-control" />
              <span class="h-1.5 w-4/5 rounded-sm bg-control" />
              <span class="h-1.5 w-2/3 rounded-sm bg-control" />
            </span>
          }
        >
          <CanvasPreview
            src={p.previewSrc!}
            title={f().label}
            width={f().w - 16}
            height={f().h - 56}
          />
        </Show>
        <span class={`${hint} mt-auto truncate`} title={f().note}>
          {f().note}
        </span>
      </Show>
    </div>
  )
}
