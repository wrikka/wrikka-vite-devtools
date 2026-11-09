import { For, Show, createMemo, createSignal } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, grid, hint, row, sectionLabel, tile, tileOn, tonePill, type Tone } from '../ui/bits'
import Segmented from '../ui/Segmented'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtWhen } from './format'
import { createRuntimeFeed, num, str, type RuntimeEvent } from './runtimeFeed'
import StateDiff, { type StateDiffData } from './StateDiff'
import { diffStorage, storageEntries } from './state-storage'

type Slot = 'a' | 'b'

function reasonTone(reason: string): Tone {
  if (reason === 'storage') return 'warn'
  if (reason === 'initial') return 'accent'
  return 'info'
}

function mb(kb: number): string {
  return kb > 0 ? (kb / 1024).toFixed(1) : '—'
}

/** Two snapshots of route, DOM size, and storage keys — compared without reading any value. */
export default function StateApp(p: { api: PanelApi }) {
  const feed = createRuntimeFeed(p.api, 'state', 50)
  const [slot, setSlot] = createSignal<Slot>('a')
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

  const diff = createMemo<StateDiffData | undefined>(() => {
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

  const domSpark = createMemo(() =>
    ordered().slice(0, 24).map((ev) => num(ev.data, 'domNodes')).reverse(),
  )
  const heapSpark = createMemo(() =>
    ordered().slice(0, 24).map((ev) => num(ev.data, 'heapKb')).reverse(),
  )
  const latestReason = createMemo(() => {
    const ev = ordered()[0]
    return ev ? str(ev.data, 'reason') || 'interval' : undefined
  })
  const latestDom = createMemo(() => {
    const ev = ordered()[0]
    return ev ? num(ev.data, 'domNodes') : '—'
  })

  const domDelta = createMemo(() => {
    const d = diff()
    if (!d) return 0
    return d.domTo - d.domFrom
  })

  function assign(ev: RuntimeEvent): void {
    if (slot() === 'a') {
      setA(ev.id)
      if (b() === ev.id) setB(undefined)
      setSlot('b')
    } else {
      setB(ev.id)
      if (a() === ev.id) setA(undefined)
      setSlot('a')
    }
  }

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
          {
            value: ordered().length,
            label: 'snapshots',
            hint: latestReason(),
          },
          {
            value: diff()?.changes ?? 0,
            label: 'storage changes',
            tone: (diff()?.changes ?? 0) > 0 ? 'text-warn-ink' : 'text-ink-faint',
          },
          {
            value: diff()?.domTo ?? latestDom(),
            label: 'DOM nodes',
            spark: domSpark(),
            delta: diff()
              ? {
                  value: domDelta() === 0 ? 'flat' : `${domDelta() > 0 ? '+' : ''}${domDelta()}`,
                  tone: domDelta() > 0 ? 'bad' : domDelta() < 0 ? 'ok' : 'muted',
                }
              : undefined,
          },
          {
            value: mb(diff()?.heapTo ?? 0),
            label: 'heap MB',
            spark: heapSpark(),
            tone: (diff()?.heapTo ?? 0) > 0 ? undefined : 'text-ink-faint',
          },
          {
            value: diff() && diff()!.routeFrom !== diff()!.routeTo ? 'yes' : 'no',
            label: 'route changed',
            tone: diff() && diff()!.routeFrom !== diff()!.routeTo ? 'text-info-ink' : 'text-ink-faint',
          },
        ]}
      />

      <div class={row}>
        <span class={hint}>{feed.msg()}</span>
        <span class={`${hint} ml-auto`}>values are never read — only key, type, and length</span>
      </div>

      <Show when={ordered().length === 0}>
        <EmptyState
          title="No snapshots yet"
          hint="The overlay takes one on load, then every 5s and on storage events. Move around the app, then come back."
        />
      </Show>

      <Show when={ordered().length > 0 && ordered().length < 2}>
        <EmptyState title="Need two snapshots" hint="Wait ~5s for the next capture, then the diff appears here." />
      </Show>

      <Show when={ordered().length > 1}>
        <div class={row}>
          <span class={sectionLabel}>pin</span>
          <Segmented
            items={[
              { id: 'a', label: 'A · before' },
              { id: 'b', label: 'B · after' },
            ]}
            value={slot()}
            onChange={(id) => setSlot(id as Slot)}
            ariaLabel="snapshot slot to pin"
          />
          <span class={`${hint} ml-auto`}>pick a slot, then click a snapshot · newest two are compared by default</span>
        </div>
      </Show>

      <div class={grid}>
        <For each={ordered().slice(0, 24)}>{(ev) => {
          const isA = createMemo(() => a() === ev.id)
          const isB = createMemo(() => b() === ev.id)
          const local = createMemo(() => storageEntries(ev.data, 'localStorage').length)
          const session = createMemo(() => storageEntries(ev.data, 'sessionStorage').length)
          const reason = str(ev.data, 'reason') || 'interval'
          return (
            <button
              class={`${tile} ${isA() || isB() ? tileOn : ''}`}
              onClick={() => assign(ev)}
              aria-pressed={isA() || isB()}
            >
              <div class={row}>
                <span class={tonePill(reasonTone(reason))}>{reason}</span>
                <Show when={isA()}>
                  <span class={tonePill('accent')}>A</span>
                </Show>
                <Show when={isB()}>
                  <span class={tonePill('info')}>B</span>
                </Show>
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
                  <span>{mb(num(ev.data, 'heapKb'))} MB heap</span>
                </Show>
              </div>
            </button>
          )
        }}</For>
      </div>

      <Show when={diff()}>
        {(d) => (
          <StateDiff api={p.api} diff={d()} fromAt={pair().before?.at} toAt={pair().after?.at} />
        )}
      </Show>
    </PanelPage>
  )
}
