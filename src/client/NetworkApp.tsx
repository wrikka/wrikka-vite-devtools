import { For, Show, createMemo, createSignal } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, chip, chipOn, grid, hint, row, sectionLabel, tile, tileOn, tonePill, type Tone } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtBytes, fmtMs, fmtWhen } from './format'
import { bool, createRuntimeFeed, num, percentile, str, type RuntimeEvent } from './runtimeFeed'

type Filter = 'all' | 'failed' | 'slow' | 'fetch' | 'xhr'

const FILTERS: Filter[] = ['all', 'failed', 'slow', 'fetch', 'xhr']

interface ReplayResult {
  ok: boolean
  status: number
  durationMs: number
  headers: { name: string; value: string }[]
  body: string
  truncated: boolean
  error?: string
}

function statusTone(status: number): Tone {
  if (status === 0) return 'bad'
  if (status >= 500) return 'bad'
  if (status >= 400) return 'warn'
  return 'ok'
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url, location.origin)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

export default function NetworkApp(p: { api: PanelApi }) {
  const feed = createRuntimeFeed(p.api, 'network', 300)
  const [filter, setFilter] = createSignal<Filter>('all')
  const [selected, setSelected] = createSignal<number>()
  const [replaying, setReplaying] = createSignal(false)
  const [replay, setReplay] = createSignal<ReplayResult>()

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
      p95: percentile(durations, 95),
    }
  })

  function select(ev: RuntimeEvent): void {
    setSelected(ev.id)
    setReplay(undefined)
  }

  async function replayRequest(ev: RuntimeEvent): Promise<void> {
    const raw = str(ev.data, 'url')
    if (!raw) return
    setReplaying(true)
    setReplay(undefined)
    try {
      let absolute = raw
      try {
        absolute = new URL(raw, location.origin).toString()
      } catch {
        // keep the original and let the server reject it with a readable message
      }
      const res = (await p.api.call('replay-request', {
        url: absolute,
        method: str(ev.data, 'method') || 'GET',
      })) as ReplayResult
      setReplay(res)
    } catch (err) {
      setReplay({ ok: false, status: 0, durationMs: 0, headers: [], body: '', truncated: false, error: String(err) })
    } finally {
      setReplaying(false)
    }
  }

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
        <For each={FILTERS}>{(f) => (
          <button class={`${chip} ${filter() === f ? chipOn : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        )}</For>
      </div>

      <p class={hint}>{feed.msg()}</p>

      <Show when={requests().length === 0}>
        <EmptyState
          title="No requests captured yet"
          hint="Capture starts with the page: click around the app, then watch fetch/XHR calls land here every 2s."
        />
      </Show>

      <Show when={requests().length > 0 && visible().length === 0}>
        <EmptyState title={`No ${filter()} requests`} hint="Switch the filter, or trigger the matching traffic in the app." />
      </Show>

      <div class={grid}>
        <For each={visible().slice(0, 80)}>{(ev) => {
          const status = num(ev.data, 'status')
          return (
            <button class={`${tile} ${current()?.id === ev.id ? tileOn : ''}`} onClick={() => select(ev)}>
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
        {(ev) => (
          <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
            <div class={row}>
              <span class={sectionLabel}>request detail</span>
              <span class={`${hint} ml-auto`}>{fmtWhen(ev().at)}</span>
            </div>
            <div class="break-all font-mono text-[11px] text-ink">
              {str(ev().data, 'method') || 'GET'} {str(ev().data, 'url')}
            </div>
            <div class={row}>
              <span class={tonePill(statusTone(num(ev().data, 'status')))}>
                {num(ev().data, 'status') === 0 ? 'network error' : num(ev().data, 'status')}
              </span>
              <span class={`${chip} cursor-default`}>{fmtMs(num(ev().data, 'durationMs'))}</span>
              <span class={`${chip} cursor-default`}>{fmtBytes(num(ev().data, 'bytes'))}</span>
              <Show when={str(ev().data, 'contentType')}>
                <span class={`${chip} cursor-default truncate`} title={str(ev().data, 'contentType')}>
                  {str(ev().data, 'contentType').split(';')[0]}
                </span>
              </Show>
              <button
                class={`${btn} ml-auto`}
                disabled={replaying()}
                onClick={() => void replayRequest(ev())}
              >
                {replaying() ? 'replaying…' : 'Replay'}
              </button>
            </div>
            <Show when={str(ev().data, 'error')}>
              <p class="m-0 font-mono text-[11px] text-bad-ink">{str(ev().data, 'error')}</p>
            </Show>

            <Show when={replay()}>
              {(r) => (
                <div class="flex flex-col gap-1.5 rounded-lg border border-solid border-line bg-surface-sunken p-2">
                  <div class={row}>
                    <span class={sectionLabel}>replay result</span>
                    <Show when={r().error} fallback={
                      <span class={`${tonePill(statusTone(r().status))} ml-auto`}>{r().status}</span>
                    }>
                      <span class={`${tonePill('bad')} ml-auto`}>error</span>
                    </Show>
                    <span class={`${hint} tabular-nums`}>{fmtMs(r().durationMs)}</span>
                  </div>
                  <Show when={r().error}>
                    <p class="m-0 font-mono text-[11px] text-bad-ink">{r().error}</p>
                  </Show>
                  <pre class="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-ink-muted">
                    {r().body || '(empty body)'}
                  </pre>
                  <Show when={r().truncated}>
                    <span class={hint}>body truncated at 4 KB</span>
                  </Show>
                  <details class="text-[11px] text-ink-muted">
                    <summary class="cursor-pointer text-ink-faint">{r().headers.length} response headers</summary>
                    <For each={r().headers}>{(h) => (
                      <div class="flex gap-1.5 break-all">
                        <span class="text-accent-ink">{h.name}</span>
                        <span>{h.value}</span>
                      </div>
                    )}</For>
                  </details>
                </div>
              )}
            </Show>

            <Show when={!bool(ev().data, 'ok') || num(ev().data, 'status') >= 400}>
              <SendToAgent
                api={p.api}
                page={shortUrl(str(ev().data, 'url'))}
                selection={{ mode: 'page', cssPath: shortUrl(str(ev().data, 'url')) }}
                placeholder="e.g. why does this request fail — trace it and propose a fix"
              />
            </Show>
          </div>
        )}
      </Show>
    </PanelPage>
  )
}
