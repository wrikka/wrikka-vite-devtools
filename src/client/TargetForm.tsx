import { Show, createMemo, createSignal, type VoidProps } from 'solid-js'
import type { Selection } from '../protocol'
import { field, hint, row } from '../ui/bits'

export interface TargetFormProps {
  page(): string
  onPage(v: string): void
  mode(): Selection['mode']
  onMode(v: Selection['mode']): void
  cssPath(): string
  onCssPath(v: string): void
}

/**
 * Names the page and node a hub-side comment targets. The hub iframe url is a devtools
 * route, so the app url has to be typed rather than read from `window.location`.
 */
export default function TargetForm(p: VoidProps<TargetFormProps>) {
  const summary = createMemo(() => `${p.mode()} @ ${p.cssPath() || 'html'} — ${p.page()}`)

  return (
    <div class="flex flex-col gap-2">
      <input
        class={field}
        type="text"
        aria-label="Target page url"
        placeholder="https://localhost:5173/checkout"
        value={p.page()}
        onInput={(e) => p.onPage(e.currentTarget.value)}
      />
      <div class={row}>
        <select
          class={field}
          aria-label="Target mode"
          value={p.mode()}
          onChange={(e) => p.onMode(e.currentTarget.value as Selection['mode'])}
        >
          <option value="page">page</option>
          <option value="element">element</option>
          <option value="component">component</option>
        </select>
        <Show when={p.mode() !== 'page'}>
          <input
            class={field}
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
