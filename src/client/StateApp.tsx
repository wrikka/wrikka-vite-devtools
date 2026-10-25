import { For, Show, createMemo, createSignal } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, btnActive, grid, hint, row, sectionLabel, tile, tonePill, type Tone } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtWhen } from './format'
import { createRuntimeFeed, num, str, type RuntimeEvent } from './runtimeFeed'

interface StorageEntry {
  key: string
  type: string
  length: number
}

interface StorageChange {
  key: string
  kind: 'added' | 'removed' | 'changed'
  from: string
  to: string
}

function storageEntries(data: Record<string, unknown>, field: string): StorageEntry[] {
  const raw = data[field]
  if (!Array.isArray(raw)) return []
  const out: StorageEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const key = typeof rec.key === 'string' ? rec.key : ''
    if (!key) continue
    out.push({
      key,
      type: typeof rec.type === 'string' ? rec.type : 'text',
      length: typeof rec.length === 'number' ? rec.length : 0,
    })
  }
  return out
}

function describe(entry: StorageEntry): string {
  return `${entry.type} · ${entry.length} chars`
}

function diffStorage(before: StorageEntry[], after: StorageEntry[]): StorageChange[] {
  const left = new Map(before.map((entry) => [entry.key, entry]))
  const right = new Map(after.map((entry) => [entry.key, entry]))
  const out: StorageChange[] = []
  for (const [key, entry] of right) {
    const prev = left.get(key)
    if (!prev) out.push({ key, kind: 'added', from: '—', to: describe(entry) })
    else if (prev.length !== entry.length || prev.type !== entry.type) {
      out.push({ key, kind: 'changed', from: describe(prev), to: describe(entry) })
    }
  }
  for (const [key, entry] of left) {
    if (!right.has(key)) out.push({ key, kind: 'removed', from: describe(entry), to: '—' })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

function reasonTone(reason: string): Tone {
  if (reason === 'storage') return 'warn'
  if (reason === 'initial') return 'accent'
  return 'info'
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

/** Two snapshots of route, DOM size, and storage keys — compared without reading any value. */
export default function StateApp(p: { api: PanelApi }) {
  const feed = createRuntimeFeed(p.api, 'state', 50)
  const [a, setA] = createSignal<number>()
  const [b, setB] = createSignal<number>()

  const ordered = createMemo(() => [...feed.events()].sort((x, y) => y.at - x.at))

  const pair = createMemo<{ before?: RuntimeEvent; after?: RuntimeEvent }>(() => {
    const list = ordered()
    const after = list.find((ev) => ev.id === b()) ?? list[0]
    const picked = list.find((ev) => ev.id === a())
    const before =
      picked && picked.id !== after?.id ? picked : list.find((ev) => ev.id !== after?.id)
    return { before, after }
  })

  const diff = createMemo(() => {
    const { before, after } = pair()
    if (!before || !after) return undefined
    const local = diffStorage(storageEntries(before.data, 'localStorage'), storageEntries(after.data, 'localStorage'))
    const session = diffStorage(storageEntries(before.data, 'sessionStorage'), storageEntries(after.data, 'sessionStorage'))
    return {
      local,
      session,
      routeFrom: str(before.data, 'route'),
      routeTo: str(after.data, 'route'),
      domFrom: num(before.data, 'domNodes'),
      domTo: num(after.data, 'domNodes'),
      heapFrom: num(before.data, 'heapKb'),
      heapTo: num(after.data, 'heapKb'),
      customFrom: str(before.data, 'custom'),
      customTo: str(after.data, 'custom'),
      changes: local.length + session.length,
    }
  })

  const stats = createMemo(() => {
    const d = diff()
    return {
      snapshots: ordered().length,
      storage: d?.changes ?? 0,
      route: d && d.routeFrom !== d.routeTo ? 1 : 0,
    }
  })

  const domDelta = createMemo(() => {
    const d = diff()
    return d ? d.domTo - d.domFrom : 0
  })

  return (
    <PanelPage>
      <PanelHeader
        title="State Snapshots"
        description="route, DOM size, and storage keys captured every 5s"
        busy={feed.busy()}
        refresh={() => void feed.reload()}
        refreshLabel="Refresh"
      >
        <button class={btn} onClick={() => void feed.clear()}>
          Clear
        </button>
      </PanelHeader>

      <StatStrip
        items={[
          { value: stats().snapshots, label: 'snapshots' },
          {
            value: stats().storage,
            label: 'storage changes',
            tone: stats().storage > 0 ? 'text-warn-ink' : 'text-ink-faint',
          },
          {
            value: diff() ? signed(diff()?.domFrom ?? 0, diff()?.domTo ?? 0) : '—',
            label: 'DOM nodes',
            tone: domDelta() > 0 ? 'text-warn-ink' : undefined,
          },
          {
            value: stats().route,
            label: 'route changed',
            tone: stats().route > 0 ? 'text-info-ink' : 'text-ink-faint',
          },
        ]}
      />

      <p class={hint}>
        {feed.msg()} · pick A (before) and B (after) to compare; values are never read, only key, type, and length.
      </p>

      <Show when={ordered().length === 0}>
        <EmptyState
          title="No snapshots yet"
          hint="The overlay takes one on load, then every 5s and on storage events. Move around the app, then come back."
        />
      </Show>

      <Show when={ordered().length > 0 && ordered().length < 2}>
        <EmptyState title="Need two snapshots" hint="Wait ~5s for the next capture, then the diff appears here." />
      </Show>

      <div class={grid}>
        <For each={ordered().slice(0, 24)}>{(ev) => {
          const local = createMemo(() => storageEntries(ev.data, 'localStorage').length)
          const session = createMemo(() => storageEntries(ev.data, 'sessionStorage').length)
          const reason = str(ev.data, 'reason') || 'interval'
          return (
            <div class={tile}>
              <div class={row}>
                <span class={tonePill(reasonTone(reason))}>{reason}</span>
                <span class={`${hint} ml-auto tabular-nums`}>{fmtWhen(ev.at)}</span>
              </div>
              <span class="truncate font-mono text-[11px] text-ink" title={str(ev.data, 'route')}>
                {str(ev.data, 'route') || '/'}
              </span>
              <div class={`${row} ${hint}`}>
                <span>{num(ev.data, 'domNodes')} DOM</span>
                <span>·</span>
                <span>{local()} local</span>
                <span>·</span>
                <span>{session()} session</span>
                <Show when={num(ev.data, 'heapKb') > 0}>
                  <span>·</span>
                  <span>{(num(ev.data, 'heapKb') / 1024).toFixed(1)} MB heap</span>
                </Show>
              </div>
              <div class={row}>
                <button
                  class={`${btn} ${a() === ev.id ? btnActive : ''}`}
                  onClick={() => setA(ev.id)}
                  aria-pressed={a() === ev.id}
                >
                  A · before
                </button>
                <button
                  class={`${btn} ${b() === ev.id ? btnActive : ''}`}
                  onClick={() => setB(ev.id)}
                  aria-pressed={b() === ev.id}
                >
                  B · after
                </button>
              </div>
            </div>
          )
        }}</For>
      </div>

      <Show when={diff()}>
        {(d) => (
          <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
            <div class={row}>
              <span class={sectionLabel}>diff · A → B</span>
              <span class={`${hint} ml-auto`}>{fmtWhen(pair().before?.at)} → {fmtWhen(pair().after?.at)}</span>
            </div>

            <div class={row}>
              <span class={`${hint} w-full`}>route</span>
              <span class="break-all font-mono text-[11px] text-ink">
                {d().routeFrom || '/'} → {d().routeTo || '/'}
              </span>
            </div>

            <div class={row}>
              <span class={`${hint} w-full`}>DOM nodes</span>
              <span class="font-mono text-[11px] text-ink">
                {d().domFrom} → {d().domTo} ({signed(d().domFrom, d().domTo)})
              </span>
            </div>

            <div class={row}>
              <span class={`${hint} w-full`}>heap</span>
              <span class="font-mono text-[11px] text-ink">
                {d().heapFrom > 0 ? `${(d().heapFrom / 1024).toFixed(1)} MB` : 'unavailable'} →{' '}
                {d().heapTo > 0 ? `${(d().heapTo / 1024).toFixed(1)} MB` : 'unavailable'}
              </span>
            </div>

            <Show
              when={d().changes > 0}
              fallback={<p class={`${hint} m-0`}>storage keys are identical between these two snapshots</p>}
            >
              <For each={[
                { area: 'localStorage', changes: d().local },
                { area: 'sessionStorage', changes: d().session },
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

            <Show when={d().customFrom || d().customTo}>
              <details class="text-[11px] text-ink-muted">
                <summary class="cursor-pointer text-ink-faint">window.__DEVTOOLS_STATE__</summary>
                <pre class="m-0 mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">
                  A: {d().customFrom || '(none)'}
                  {'\n'}B: {d().customTo || '(none)'}
                </pre>
              </details>
            </Show>

            <Show when={d().changes > 0}>
              <SendToAgent
                api={p.api}
                page={d().routeTo || 'state'}
                selection={{ mode: 'page', cssPath: d().routeTo || 'state' }}
                placeholder="e.g. which of these storage keys are stale, and clean them up"
              />
            </Show>
          </div>
        )}
      </Show>
    </PanelPage>
  )
}
