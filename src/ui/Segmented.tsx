import { For, Show } from 'solid-js'
import { tab, tabBar, tabOn } from './bits'

export interface SegmentItem {
  id: string
  label: string
  /** Optional count chip, e.g. the number of rows behind the segment. */
  count?: number
}

export interface SegmentedProps {
  items: SegmentItem[]
  value: string
  onChange(id: string): void
  ariaLabel?: string
}

/** The shared segmented control used as a panel's top-level filter. */
export default function Segmented(p: SegmentedProps) {
  return (
    <div class={tabBar} role="tablist" aria-label={p.ariaLabel}>
      <For each={p.items}>
        {(item) => (
          <button
            class={`${tab} ${p.value === item.id ? tabOn : ''}`}
            role="tab"
            aria-selected={p.value === item.id}
            onClick={() => p.onChange(item.id)}
          >
            {item.label}
            <Show when={item.count !== undefined}>
              <span class="rounded-full bg-control px-1.5 text-[10px] tabular-nums text-ink-muted">
                {item.count}
              </span>
            </Show>
          </button>
        )}
      </For>
    </div>
  )
}
