import { For, Show, createMemo, type VoidProps } from 'solid-js'
import type { Selection } from '../protocol'
import { card, field, hint, row, sectionLabel, tab, tabBar, tabOn } from '../ui/bits'

export interface TargetFormProps {
  page(): string
  onPage(v: string): void
  mode(): Selection['mode']
  onMode(v: Selection['mode']): void
  cssPath(): string
  onCssPath(v: string): void
}

const MODES: Selection['mode'][] = ['page', 'element', 'component']

/**
 * Names the page and node a hub-side comment targets. The hub iframe url is a devtools
 * route, so the app url has to be typed rather than read from `window.location`.
 */
export default function TargetForm(p: VoidProps<TargetFormProps>) {
  const summary = createMemo(() => `${p.mode()} @ ${p.cssPath() || 'html'} — ${p.page()}`)

  return (
    <div class={`${card} gap-2`}>
      <span class={sectionLabel}>target</span>
      <input
        class={field}
        type="text"
        aria-label="Target page url"
        placeholder="https://localhost:5173/checkout"
        value={p.page()}
        onInput={(e) => p.onPage(e.currentTarget.value)}
      />
      <div class={row}>
        <div class={tabBar} role="group" aria-label="Target mode">
          <For each={MODES}>
            {(m) => (
              <button class={`${tab} ${p.mode() === m ? tabOn : ''}`} aria-pressed={p.mode() === m} onClick={() => p.onMode(m)}>
                {m}
              </button>
            )}
          </For>
        </div>
        <Show when={p.mode() !== 'page'}>
          <input
            class={`${field} flex-1 font-mono`}
            type="text"
            aria-label="CSS path"
            placeholder="main > div.card"
            value={p.cssPath()}
            onInput={(e) => p.onCssPath(e.currentTarget.value)}
          />
        </Show>
      </div>
      <span class={hint}>{summary()}</span>
    </div>
  )
}
