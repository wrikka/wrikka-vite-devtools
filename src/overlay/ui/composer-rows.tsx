import { For } from 'solid-js'
import { chip, hint, row } from '../../ui/bits'
import type { RouteHit } from './routes'

export type { RouteHit }

const QUICK_STARTS = ['Improve the UX/UI here: ', 'Fix a bug here: ', 'Add tests for this page: ']

/** `@`-mention dropdown — the composer owns cursor/mention state, this only renders. */
export function MentionList(p: { items: RouteHit[]; cursor: number; onPick(path: string): void }) {
  return (
    <div class="flex max-h-36 flex-col overflow-auto rounded-lg border border-solid border-line bg-surface p-1" role="listbox" aria-label="Route suggestions">
      <For each={p.items}>
        {(r, i) => (
          <button
            class={`flex cursor-pointer items-center gap-2 rounded-md border border-solid border-transparent px-2 py-1 text-left text-[11px] ${
              i() === p.cursor ? 'border-line-strong bg-control text-ink' : 'text-ink-muted hover:bg-control'
            }`}
            role="option"
            aria-selected={i() === p.cursor}
            onMouseDown={(e) => {
              e.preventDefault()
              p.onPick(r.path)
            }}
          >
            <span class="font-mono">{r.path}</span>
            {r.kind ? <span class={`${hint} ml-auto uppercase`}>{r.kind}</span> : null}
          </button>
        )}
      </For>
    </div>
  )
}

/** Route chips that insert an `@mention` — the parent owns the textarea cursor math. */
export function RouteChips(p: { paths: string[]; onPick(path: string): void }) {
  return (
    <div class={row}>
      <span class={hint}>suggestions</span>
      <For each={p.paths}>
        {(path) => (
          <button class={chip} onClick={() => p.onPick(path)} title={`Mention ${path}`}>
            @{path}
          </button>
        )}
      </For>
    </div>
  )
}

/** Prompt starters that append a canned instruction to the draft. */
export function StarterChips(p: { onPick(prompt: string): void }) {
  return (
    <div class={row}>
      <For each={QUICK_STARTS}>
        {(s) => (
          <button class={chip} onClick={() => p.onPick(s)} title="Add this prompt">
            {s.replace(/:\s*$/, '')}
          </button>
        )}
      </For>
    </div>
  )
}
