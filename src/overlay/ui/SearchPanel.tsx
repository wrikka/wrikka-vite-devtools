import { For, Show, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../../ui/api'
import type { SearchMatch } from '../api'
import { card, field, hint, link, chip, chipOn, row } from '../../ui/bits'

export type SearchScope = 'local' | 'components' | 'routes'

export interface SearchPanelProps {
  api: PanelApi
  /** Initial query derived from the picked element — editable before re-running. */
  query: string
  scope: SearchScope
  onScope(s: SearchScope): void
}

const SCOPES: SearchScope[] = ['local', 'components', 'routes']

/** Results list for `search-source`; re-queries when the scope chip or edited query changes. */
export default function SearchPanel(p: SearchPanelProps) {
  const [draft, setDraft] = createSignal(p.query)
  const [matches, setMatches] = createSignal<SearchMatch[]>([])
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('')

  onMount(() => {
    void search(draft(), p.scope)
  })

  async function search(query: string, scope: SearchScope): Promise<void> {
    if (!query.trim()) {
      setMsg('empty query')
      return
    }
    setBusy(true)
    try {
      const res = (await p.api.call('search-source', { query, scope })) as {
        matches: SearchMatch[]
        truncated: boolean
      }
      setMatches(res.matches)
      setMsg(
        res.matches.length === 0
          ? `no match for “${query}” in ${scope}`
          : `${res.matches.length} matches${res.truncated ? ' (truncated)' : ''}`,
      )
    } catch (err) {
      setMsg(`search failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        class={`${field} font-mono`}
        value={draft()}
        aria-label="Search query"
        onInput={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy()) void search(draft(), p.scope)
        }}
      />
      <div class={row}>
        <For each={SCOPES}>{(s) => (
          <button
            class={`${chip} ${p.scope === s ? chipOn : ''}`}
            aria-pressed={p.scope === s}
            onClick={() => {
              if (p.scope === s) return
              p.onScope(s)
              void search(draft(), s)
            }}
          >
            {s}
          </button>
        )}</For>
        <span class={hint} role="status">{busy() ? 'searching…' : msg()}</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <For each={matches()}>{(m) => (
          <div class={card}>
            <div class={hint} title={m.file}>{`${m.file}:${m.line}`}</div>
            <div class="break-all font-mono text-[11px] text-ink">{m.snippet}</div>
            <a
              class={`${link} w-fit text-[11px]`}
              href={`vscode://file/${m.file}:${m.line}`}
              aria-label={`Open ${m.file} line ${m.line} in the editor`}
            >
              open in editor
            </a>
          </div>
        )}</For>
      </div>
      <Show when={!busy() && matches().length === 0}>
        <p class={hint}>try a shorter query — class name, testid, or component label</p>
      </Show>
    </>
  )
}
