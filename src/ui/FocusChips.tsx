import { For } from 'solid-js'
import { chip, chipOn } from './bits'

/** Focus areas the agent should optimise for — mirrors the `/improve uxui` dimensions. */
export const FOCUS_AREAS = ['ux', 'writing', 'display', 'layout', 'animation', 'motion', 'a11y', 'responsive'] as const
export type FocusArea = (typeof FOCUS_AREAS)[number]

export interface FocusChipsProps {
  selected: readonly FocusArea[]
  onToggle(area: FocusArea): void
}

export default function FocusChips(p: FocusChipsProps) {
  return (
    <div class="flex flex-wrap gap-1" role="group" aria-label="Focus the agent on these UX areas">
      <For each={FOCUS_AREAS}>
        {(area) => (
          <button
            class={`${chip} ${p.selected.includes(area) ? chipOn : ''}`}
            aria-pressed={p.selected.includes(area)}
            onClick={() => p.onToggle(area)}
          >
            {area}
          </button>
        )}
      </For>
    </div>
  )
}

/** Comment body prefix that routes the agent to the chosen areas; empty when none picked. */
export function focusPrefix(selected: readonly FocusArea[]): string {
  return selected.length === 0 ? '' : `improve uxui — ${selected.join(', ')}: `
}
