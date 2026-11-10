import { For, Show, createMemo, createSignal } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, grid, hint, row, tile, tileOn, tonePill, type Tone } from '../ui/bits'
import { bucketize } from '../ui/chart-math'
import { BarList, Sparkline } from '../ui/charts'
import Segmented from '../ui/Segmented'
import { EmptyState, PanelHeader, PanelPage, PanelSection, StatStrip } from './PanelKit'
import { fmtBytes, fmtMs, fmtWhen } from './format'
import { shortUrl, statusTone } from './network-util'
import NetworkDetail from './NetworkDetail'
import { bool, createRuntimeFeed, num, percentile, str, type RuntimeEvent } from './runtimeFeed'

type Filter = 'all' | 'failed' | 'slow' | 'fetch' | 'xhr'

const FILTERS: Filter[] = ['all', 'failed', 'slow', 'fetch', 'xhr']
const BUCKET_TONES: Tone[] = ['ok', 'info', 'warn', 'bad']

export default function NetworkApp(p: { api: PanelApi }) {
  const feed = createRuntimeFeed(p.api, 'network', 300)
  const [filter, setFilter] = createSignal<Filter>('all')
  const [selected, setSelected] = createSignal<number>()

  const requests = createMemo(() => feed.events())

  const visible = createMemo(() => {
    const active = filter()
    return requests().filter((ev) => {
      if (active === 'failed') return !bool(ev.data, 'ok')
      if (active === 'slow') return bool(ev.data, 'slow')
      if (active === 'fetch' || active === 'xhr') return str(ev.data, 'transport') === active
      return true
    })
  })

  const current = createMemo<RuntimeEvent | undefined>(() => {
    const id = selected()
    return id === undefined ? requests()[0] : requests().find((ev) => ev.id === id)
  })

  const stats = createMemo(() => {
    const all = requests()
    const durations = all.map((ev) => num(ev.data, 'durationMs'))
    return {
      total: all.length,
      failed: all.filter((ev) => !bool(ev.data, 'ok')).length,
      slow: all.filter((ev) => bool(ev.data, 'slow')).length,
      fetch: all.filter((ev) => str(ev.data, 'transport') === 'fetch').length,
      xhr: all.filter((ev) => str(ev.data, 'transport') === 'xhr').length,
      p95: percentile(durations, 95),
    }
  })

  const buckets = createMemo(() =>
    bucketize(
      requests().map((ev) => num(ev.data, 'durationMs')),
      [100, 300, 1000],
    ),
  )

  const durationSpark = createMemo(() =>
    requests().slice(-60).map((ev) => num(ev.data, 'durationMs')),
  )

  const counts = createMemo(() => ({
    all: stats().total,
    failed: stats().failed,
    slow: stats().slow,
    fetch: stats().fetch,
    xhr: stats().xhr,
  }))

  return (
    <PanelPage>
      <PanelHeader
        title="Network"
        description="fetch + XHR the page actually made"
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
          { value: stats().total, label: 'requests' },
          { value: stats().failed, label: 'failed', tone: stats().failed > 0 ? 'text-bad-ink' : undefined },
          { value: stats().slow, label: 'slow > 300ms', tone: stats().slow > 0 ? 'text-warn-ink' : undefined },
          { value: fmtMs(stats().p95), label: 'p95 duration' },
        ]}
      />

      <div class={row}>
        <Segmented
          items={FILTERS.map((f) => ({ id: f, label: f, count: counts()[f] }))}
          value={filter()}
          onChange={(id) => setFilter(id as Filter)}
          ariaLabel="request filter"
        />
        <span class={`${hint} ml-auto`}>{feed.msg()}</span>
      </div>

      <Show when={requests().length === 0}>
        <EmptyState
          title="No requests captured yet"
          hint="Capture starts with the page: click around the app, then watch fetch/XHR calls land here every 2s."
        />
      </Show>

      <Show when={requests().length > 0 && visible().length === 0}>
        <EmptyState title={`No ${filter()} requests`} hint="Switch the filter, or trigger the matching traffic in the app." />
      </Show>

      <Show when={requests().length > 0}>
        <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <PanelSection label="duration buckets" hint="ms">
            <BarList
              items={buckets().map((b, i) => ({
                label: b.label,
                value: b.count,
                tone: BUCKET_TONES[Math.min(i, BUCKET_TONES.length - 1)],
              }))}
            />
          </PanelSection>
          <PanelSection label="duration over time" hint="last 60">
            <Sparkline values={durationSpark()} width={280} height={62} tone="info" label="request durations" />
            <span class={hint}>oldest → newest · p95 {fmtMs(stats().p95)}</span>
          </PanelSection>
        </div>
      </Show>

      <div class={grid}>
        <For each={visible().slice(0, 80)}>{(ev) => {
          const status = num(ev.data, 'status')
          return (
            <button class={`${tile} ${current()?.id === ev.id ? tileOn : ''}`} onClick={() => setSelected(ev.id)}>
              <div class={row}>
                <span class="font-mono text-[11px] font-semibold text-ink">{str(ev.data, 'method') || 'GET'}</span>
                <span class={tonePill(statusTone(status))}>{status === 0 ? 'ERR' : status}</span>
                <Show when={bool(ev.data, 'slow')}>
                  <span class={tonePill('warn')}>slow</span>
                </Show>
                <span class={`${hint} ml-auto tabular-nums`}>{fmtMs(num(ev.data, 'durationMs'))}</span>
              </div>
              <span class="truncate font-mono text-[11px] text-ink-muted" title={str(ev.data, 'url')}>
                {shortUrl(str(ev.data, 'url'))}
              </span>
              <div class={`${row} ${hint}`}>
                <span>{str(ev.data, 'transport')}</span>
                <span>·</span>
                <span>{fmtBytes(num(ev.data, 'bytes'))}</span>
                <span>·</span>
                <span>{fmtWhen(ev.at)}</span>
              </div>
            </button>
          )
        }}</For>
      </div>

      <Show when={current()}>
        {(ev) => <NetworkDetail api={p.api} ev={ev()} />}
      </Show>
    </PanelPage>
  )
}
