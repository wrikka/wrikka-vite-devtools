import { For, Show } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { hint, row, sectionLabel, tonePill, type Tone } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { fmtWhen } from './format'
import type { StorageChange } from './state-storage'

export interface StateDiffData {
  local: StorageChange[]
  session: StorageChange[]
  routeFrom: string
  routeTo: string
  domFrom: number
  domTo: number
  heapFrom: number
  heapTo: number
  customFrom: string
  customTo: string
  changes: number
}

function changeTone(kind: StorageChange['kind']): Tone {
  if (kind === 'added') return 'ok'
  if (kind === 'removed') return 'bad'
  return 'warn'
}

function signed(from: number, to: number): string {
  const delta = to - from
  if (delta === 0) return 'no change'
  return `${delta > 0 ? '+' : ''}${delta}`
}

function heap(kb: number): string {
  return kb > 0 ? `${(kb / 1024).toFixed(1)} MB` : 'unavailable'
}

/** A/B comparison card: route, DOM, heap, and storage keys side by side. */
export default function StateDiff(p: { api: PanelApi; diff: StateDiffData; fromAt?: number; toAt?: number }) {
  return (
    <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
      <div class={row}>
        <span class={sectionLabel}>diff · A → B</span>
        <span class={`${hint} ml-auto`}>
          {fmtWhen(p.fromAt)} → {fmtWhen(p.toAt)}
        </span>
      </div>

      <div class={row}>
        <span class={`${hint} w-full`}>route</span>
        <span class="break-all font-mono text-[11px] text-ink">
          {p.diff.routeFrom || '/'} → {p.diff.routeTo || '/'}
        </span>
      </div>

      <div class={row}>
        <span class={`${hint} w-full`}>DOM nodes</span>
        <span class="font-mono text-[11px] text-ink">
          {p.diff.domFrom} → {p.diff.domTo} ({signed(p.diff.domFrom, p.diff.domTo)})
        </span>
      </div>

      <div class={row}>
        <span class={`${hint} w-full`}>heap</span>
        <span class="font-mono text-[11px] text-ink">
          {heap(p.diff.heapFrom)} → {heap(p.diff.heapTo)}
        </span>
      </div>

      <Show
        when={p.diff.changes > 0}
        fallback={<p class={`${hint} m-0`}>storage keys are identical between these two snapshots</p>}
      >
        <For each={[
          { area: 'localStorage', changes: p.diff.local },
          { area: 'sessionStorage', changes: p.diff.session },
        ]}>{(group) => (
          <Show when={group.changes.length > 0}>
            <div class="flex flex-col gap-1">
              <span class={`${hint} font-semibold`}>{group.area}</span>
              <For each={group.changes}>{(change) => (
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class={tonePill(changeTone(change.kind))}>{change.kind}</span>
                  <span class="font-mono text-[11px] text-ink">{change.key}</span>
                  <span class={`${hint} ml-auto tabular-nums`}>{change.from} → {change.to}</span>
                </div>
              )}</For>
            </div>
          </Show>
        )}</For>
      </Show>

      <Show when={p.diff.customFrom || p.diff.customTo}>
        <details class="text-[11px] text-ink-muted">
          <summary class="cursor-pointer text-ink-faint">window.__DEVTOOLS_STATE__</summary>
          <pre class="m-0 mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">
            A: {p.diff.customFrom || '(none)'}
            {'\n'}B: {p.diff.customTo || '(none)'}
          </pre>
        </details>
      </Show>

      <Show when={p.diff.changes > 0}>
        <SendToAgent
          api={p.api}
          page={p.diff.routeTo || 'state'}
          selection={{ mode: 'page', cssPath: p.diff.routeTo || 'state' }}
          placeholder="e.g. which of these storage keys are stale, and clean them up"
        />
      </Show>
    </div>
  )
}
