import { For, Show, createEffect, createSignal } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, chip, hint, row, sectionLabel, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { fmtBytes, fmtMs, fmtWhen } from './format'
import { shortUrl, statusTone } from './network-util'
import { bool, num, str, type RuntimeEvent } from './runtimeFeed'

interface ReplayResult {
  ok: boolean
  status: number
  durationMs: number
  headers: { name: string; value: string }[]
  body: string
  truncated: boolean
  error?: string
}

/** One captured request plus a server-side replay of the same method and URL. */
export default function NetworkDetail(p: { api: PanelApi; ev: RuntimeEvent }) {
  const [replaying, setReplaying] = createSignal(false)
  const [replay, setReplay] = createSignal<ReplayResult>()

  createEffect(() => {
    p.ev.id
    setReplay(undefined)
    setReplaying(false)
  })

  async function replayRequest(): Promise<void> {
    const raw = str(p.ev.data, 'url')
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
        method: str(p.ev.data, 'method') || 'GET',
      })) as ReplayResult
      setReplay(res)
    } catch (err) {
      setReplay({ ok: false, status: 0, durationMs: 0, headers: [], body: '', truncated: false, error: String(err) })
    } finally {
      setReplaying(false)
    }
  }

  return (
    <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
      <div class={row}>
        <span class={sectionLabel}>request detail</span>
        <span class={`${hint} ml-auto`}>{fmtWhen(p.ev.at)}</span>
      </div>
      <div class="break-all font-mono text-[11px] text-ink">
        {str(p.ev.data, 'method') || 'GET'} {str(p.ev.data, 'url')}
      </div>
      <div class={row}>
        <span class={tonePill(statusTone(num(p.ev.data, 'status')))}>
          {num(p.ev.data, 'status') === 0 ? 'network error' : num(p.ev.data, 'status')}
        </span>
        <span class={`${chip} cursor-default`}>{fmtMs(num(p.ev.data, 'durationMs'))}</span>
        <span class={`${chip} cursor-default`}>{fmtBytes(num(p.ev.data, 'bytes'))}</span>
        <Show when={str(p.ev.data, 'contentType')}>
          <span class={`${chip} cursor-default truncate`} title={str(p.ev.data, 'contentType')}>
            {str(p.ev.data, 'contentType').split(';')[0]}
          </span>
        </Show>
        <button class={`${btn} ml-auto`} disabled={replaying()} onClick={() => void replayRequest()}>
          {replaying() ? 'replaying…' : 'Replay'}
        </button>
      </div>
      <Show when={str(p.ev.data, 'error')}>
        <p class="m-0 font-mono text-[11px] text-bad-ink">{str(p.ev.data, 'error')}</p>
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

      <Show when={!bool(p.ev.data, 'ok') || num(p.ev.data, 'status') >= 400}>
        <SendToAgent
          api={p.api}
          page={shortUrl(str(p.ev.data, 'url'))}
          selection={{ mode: 'page', cssPath: shortUrl(str(p.ev.data, 'url')) }}
          placeholder="e.g. why does this request fail — trace it and propose a fix"
        />
      </Show>
    </div>
  )
}
