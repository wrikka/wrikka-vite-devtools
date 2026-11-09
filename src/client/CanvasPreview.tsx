import { Show, createSignal } from 'solid-js'
import { hint } from '../ui/bits'
import { PREVIEW_H, PREVIEW_W, previewScale } from './canvas-board'

export interface CanvasPreviewProps {
  src: string
  title: string
  /** Usable artboard area below the header strip. */
  width: number
  height: number
}

/** A real host route rendered cover-scaled into an artboard; not interactive. */
export default function CanvasPreview(p: CanvasPreviewProps) {
  const [state, setState] = createSignal<'loading' | 'ready' | 'failed'>('loading')
  return (
    <div class="relative mt-1 min-h-0 flex-1 overflow-hidden rounded border border-solid border-line bg-surface-sunken">
      <Show when={state() === 'loading'}>
        <span class={`${hint} absolute inset-0 m-auto h-fit w-fit`}>loading preview…</span>
      </Show>
      <Show when={state() === 'failed'}>
        <span class={`${hint} absolute inset-0 m-auto h-fit w-fit text-center`}>
          preview failed — open live
        </span>
      </Show>
      <Show when={state() !== 'failed'}>
        <iframe
          data-wrikka-preview
          src={p.src}
          title={`${p.title} live preview`}
          loading="lazy"
          tabindex="-1"
          aria-hidden="true"
          class="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-surface"
          style={{
            width: `${PREVIEW_W}px`,
            height: `${PREVIEW_H}px`,
            transform: `scale(${previewScale(p.width, p.height)})`,
          }}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      </Show>
    </div>
  )
}
