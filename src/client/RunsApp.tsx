import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { Comment } from '../protocol'
import type { PanelApi } from '../ui/api'
import { btn, chip, chipOn, grid, hint, row, statusPill, tile } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtMs, fmtWhen } from './format'

interface RunnerInfo {
  preference: string
  driver: string | null
  available: string[]
}

type Filter = 'all' | 'queued' | 'running' | 'done' | 'failed'

const FILTERS: Filter[] = ['all', 'queued', 'running', 'done', 'failed']

export interface RunsAppProps {
  api: PanelApi
}

function durationOf(c: Comment): number | undefined {
  const start = c.startedAt ?? (c.status === 'queued' ? undefined : c.createdAt)
  if (!start) return undefined
  const end = c.finishedAt ? Date.parse(c.finishedAt) : Date.now()
  const ms = end - Date.parse(start)
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined
}

function targetOf(c: Comment): string {
  return c.selection.componentLabel ?? c.selection.tagName ?? c.selection.cssPath ?? c.selection.mode
}

export default function RunsApp(p: RunsAppProps) {
  const [items, setItems] = createSignal<Comment[]>([])
  const [info, setInfo] = createSignal<RunnerInfo>()
  const [filter, setFilter] = createSignal<Filter>('all')
  const [busy, setBusy] = createSignal(true)
  const [acting, setActing] = createSignal<string>()
  const [msg, setMsg] = createSignal('reading the run queue…')

  onMount(() => {
    void load()
    // Auto-refresh only while something is actually executing.
    const timer = setInterval(() => {
      if (items().some((c) => c.status === 'running')) void load(true)
    }, 2500)
    onCleanup(() => clearInterval(timer))
  })

  async function load(quiet = false): Promise<void> {
    if (!quiet) setBusy(true)
    try {
      const [list, runner] = await Promise.all([
        p.api.call('list-comments', {}),
        p.api.call('runner-info', {}),
      ])
      setItems(list.items as Comment[])
      setInfo(runner as RunnerInfo)
      const counts = countBy(list.items as Comment[])
      setMsg(`${counts.running} running · ${counts.queued} queued · driver: ${runner.driver ?? 'none'}`)
    } catch (err) {
      setMsg(`could not read the queue: ${String(err)}`)
    } finally {
      if (!quiet) setBusy(false)
    }
  }

  async function act(id: string, kind: 'run' | 'cancel'): Promise<void> {
    setActing(id)
    try {
      const res = (await p.api.call(kind === 'run' ? 'run-agent' : 'cancel-agent', { commentId: id })) as {
        started?: boolean
        cancelled?: boolean
        reason?: string
      }
      setMsg(kind === 'run' ? (res.started ? 'agent started' : (res.reason ?? 'did not start')) : res.cancelled ? 'cancelled' : 'nothing to cancel')
      await load(true)
    } catch (err) {
      setMsg(`${kind} failed: ${String(err)}`)
    } finally {
      setActing(undefined)
    }
  }

  const counts = createMemo(() => countBy(items()))
  const visible = createMemo(() => {
    const f = filter()
    return f === 'all' ? items() : items().filter((c) => c.status === f)
  })

  return (
    <PanelPage>
      <PanelHeader
        title="Runs & Queue"
        description="every instruction the overlay captured, with the agent run behind it"
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Refresh"
      />

      <StatStrip items={[
        { value: counts().queued, label: 'queued', tone: counts().queued > 0 ? 'text-warn-ink' : 'text-ink-faint' },
        { value: counts().running, label: 'running', tone: counts().running > 0 ? 'text-info-ink' : 'text-ink-faint' },
        { value: counts().done, label: 'done', tone: counts().done > 0 ? 'text-ok-ink' : 'text-ink-faint' },
        { value: counts().failed, label: 'failed', tone: counts().failed > 0 ? 'text-bad-ink' : 'text-ink-faint' },
      ]} />

      <div class={row}>
        <span class={hint}>{msg()}</span>
      </div>

      <div class={row}>
        <For each={FILTERS}>{(f) => (
          <button class={`${chip} ${filter() === f ? chipOn : ''}`} onClick={() => setFilter(f)}>
            {f} ({f === 'all' ? items().length : counts()[f]})
          </button>
        )}</For>
        <Show when={info()?.available.length}>
          <span class={`${hint} ml-auto`}>installed: {info()?.available.join(', ') || 'none'}</span>
        </Show>
      </div>

      <Show when={!busy() && visible().length === 0}>
        <EmptyState
          title={items().length === 0 ? 'No runs yet' : `Nothing ${filter()}`}
          hint={items().length === 0 ? 'Submit a comment from the overlay and it appears here with its agent run.' : 'Pick another filter to see the rest of the queue.'}
        />
      </Show>

      <div class={grid}>
        <For each={visible()}>{(c) => (
          <div class={tile}>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class={statusPill(c.status)}>{c.status}</span>
              <span class={hint}>{c.kind}</span>
              <span class={`${hint} ml-auto tabular-nums`}>{fmtWhen(c.createdAt)}</span>
            </div>

            <p class="m-0 line-clamp-3 whitespace-pre-wrap text-[12px] leading-snug text-ink">{c.body}</p>

            <div class={row}>
              <span class={`${chip} cursor-default font-mono`} title={c.page}>{c.page}</span>
              <span class={`${chip} cursor-default`} title={c.selection.cssPath}>{targetOf(c)}</span>
              <Show when={durationOf(c) != null}>
                <span class={hint}>{c.status === 'running' ? 'elapsed ' : ''}{fmtMs(durationOf(c))}</span>
              </Show>
            </div>

            <Show when={c.resultSummary}>
              <pre class="m-0 max-h-28 overflow-auto rounded-lg border border-solid border-line bg-surface-sunken p-2 font-mono text-[11px] leading-relaxed text-ink-muted">{c.resultSummary}</pre>
            </Show>

            <div class={row}>
              <Show when={c.status === 'running'} fallback={
                <button class={btn} disabled={acting() === c.id} onClick={() => void act(c.id, 'run')}>
                  {acting() === c.id ? 'starting…' : c.status === 'failed' ? 'Retry' : 'Run'}
                </button>
              }>
                <button class={btn} disabled={acting() === c.id} onClick={() => void act(c.id, 'cancel')}>
                  {acting() === c.id ? 'stopping…' : 'Cancel'}
                </button>
              </Show>
              <Show when={c.status === 'failed'}>
                <SendToAgent
                  api={p.api}
                  page={c.page}
                  selection={c.selection}
                  placeholder="e.g. what blocked this run, and fix it"
                />
              </Show>
            </div>
          </div>
        )}</For>
      </div>
    </PanelPage>
  )
}

function countBy(list: Comment[]): Record<Filter, number> {
  const out: Record<Filter, number> = { all: list.length, queued: 0, running: 0, done: 0, failed: 0 }
  for (const c of list) out[c.status] += 1
  return out
}
