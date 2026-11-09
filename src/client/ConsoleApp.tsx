import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, hint, kbd, panelCard, row, sectionLabel, tonePill } from '../ui/bits'
import { BarList } from '../ui/charts'
import Segmented from '../ui/Segmented'
import SendToAgent from '../ui/SendToAgent'
import ConsoleDetail, { type Line } from './ConsoleDetail'
import { FILTERS, LEVEL_BAR, LEVEL_TONE, asLevel, type Filter, type Level } from './console-levels'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtWhen } from './format'
import { createRuntimeFeed, str } from './runtimeFeed'

interface RunRow {
  id: string
  page: string
  status: string
  streamId?: string
}

const LEVELS: Level[] = ['error', 'warn', 'log', 'info', 'debug']

/** Page console traffic merges with the raw output of running agent CLIs, newest first. */
export default function ConsoleApp(p: { api: PanelApi }) {
  const feed = createRuntimeFeed(p.api, 'console', 500)
  const [filter, setFilter] = createSignal<Filter>('all')
  const [agentLines, setAgentLines] = createSignal<Line[]>([])
  const [agentMsg, setAgentMsg] = createSignal('no agent run is streaming right now')
  const [selected, setSelected] = createSignal<number>()

  const subscribed = new Set<string>()
  const tails = new Map<string, string>()

  onMount(() => {
    void scanAgents()
    // A run can start from any panel, so keep looking for live streams while this one is open.
    const timer = setInterval(() => void scanAgents(), 3000)
    onCleanup(() => clearInterval(timer))
  })

  async function scanAgents(): Promise<void> {
    try {
      const res = (await p.api.call('list-comments', {})) as { items: RunRow[] }
      const live = res.items.filter((row) => row.status === 'running' && row.streamId)
      for (const row of live) {
        const streamId = row.streamId
        if (!streamId || subscribed.has(streamId)) continue
        subscribed.add(streamId)
        void follow(streamId, row)
      }
      if (live.length > 0) {
        setAgentMsg(`${live.length} agent stream${live.length === 1 ? '' : 's'} live`)
      }
    } catch {
      // the run queue may not be readable yet; page console capture still works
    }
  }

  async function follow(streamId: string, row: RunRow): Promise<void> {
    try {
      for await (const chunk of p.api.subscribe('agent-logs', streamId)) {
        appendChunk(streamId, chunk)
      }
      appendChunk(streamId, '\n')
      appendLine(`[stream ${row.id} closed]`)
    } catch {
      appendLine(`[stream ${row.id} lost]`)
    } finally {
      subscribed.delete(streamId)
      tails.delete(streamId)
      void scanAgents()
    }
  }

  function appendChunk(streamId: string, chunk: string): void {
    const joined = (tails.get(streamId) ?? '') + chunk
    const parts = joined.split('\n')
    tails.set(streamId, parts.pop() ?? '')
    for (const text of parts) {
      const line = text.trimEnd()
      if (line) appendLine(line)
    }
  }

  function appendLine(text: string): void {
    const line: Line = { at: Date.now(), level: 'log', source: 'agent', text }
    setAgentLines((prev) => [...prev, line].slice(-400))
  }

  const pageLines = createMemo<Line[]>(() =>
    feed.events().map((ev) => ({
      id: ev.id,
      at: ev.at,
      level: asLevel(str(ev.data, 'level')),
      source: 'page',
      text: str(ev.data, 'message') || '(empty console call)',
      stack: str(ev.data, 'stack') || undefined,
    })),
  )

  const counts = createMemo(() => {
    const out: Record<Level, number> = { error: 0, warn: 0, log: 0, info: 0, debug: 0 }
    for (const line of pageLines()) out[line.level as Level] += 1
    return out
  })

  const timeline = createMemo<Line[]>(() =>
    [...pageLines(), ...agentLines()].sort((a, b) => b.at - a.at),
  )

  const visible = createMemo<Line[]>(() => {
    const active = filter()
    if (active === 'all') return timeline()
    return timeline().filter((line) => line.source === 'page' && line.level === active)
  })

  const stats = createMemo(() => ({
    errors: counts().error,
    warnings: counts().warn,
    logs: pageLines().length,
    agent: agentLines().length,
  }))

  const current = createMemo<Line | undefined>(() => {
    const id = selected()
    return id === undefined ? undefined : timeline().find((line) => line.id === id)
  })

  function clearAll(): void {
    void feed.clear()
    setAgentLines([])
    setSelected(undefined)
  }

  return (
    <PanelPage>
      <PanelHeader
        title="Console & Logs"
        description="page console calls and live agent output in one feed"
        busy={feed.busy()}
        refresh={() => void feed.reload()}
        refreshLabel="Refresh"
      >
        <button class={btn} onClick={clearAll}>
          Clear
        </button>
      </PanelHeader>

      <StatStrip
        items={[
          { value: stats().errors, label: 'errors', tone: stats().errors > 0 ? 'text-bad-ink' : 'text-ink-faint' },
          { value: stats().warnings, label: 'warnings', tone: stats().warnings > 0 ? 'text-warn-ink' : 'text-ink-faint' },
          { value: stats().logs, label: 'page logs' },
          { value: stats().agent, label: 'agent lines', tone: stats().agent > 0 ? 'text-info-ink' : 'text-ink-faint' },
        ]}
      />

      <div class={row}>
        <Segmented
          items={FILTERS.map((f) => ({
            id: f,
            label: f,
            count: f === 'all' ? pageLines().length : counts()[f as Level],
          }))}
          value={filter()}
          onChange={(id) => setFilter(id as Filter)}
          ariaLabel="console level"
        />
        <span class={`${hint} ml-auto`}>{agentMsg()}</span>
      </div>

      <p class={hint}>{feed.msg()}</p>

      <Show when={timeline().length === 0}>
        <EmptyState
          title="Nothing logged yet"
          hint="Use the app or start an agent run — page console calls and agent output collect here every half second."
        />
      </Show>

      <Show when={timeline().length > 0 && visible().length === 0}>
        <EmptyState
          title={`No ${filter()} lines`}
          hint="Agent output is raw text, so it only shows under the all filter."
        />
      </Show>

      <Show when={pageLines().length > 0}>
        <div class={panelCard}>
          <div class={row}>
            <span class={sectionLabel}>lines by level</span>
            <span class={`${hint} ml-auto`}>page only · agent output stays raw</span>
          </div>
          <BarList
            items={LEVELS.map((level) => ({ label: level, value: counts()[level], tone: LEVEL_TONE[level] }))}
          />
        </div>
      </Show>

      <Show when={visible().length > 0}>
        <div class="flex max-h-96 flex-col overflow-auto rounded-xl border border-solid border-line bg-surface-raised p-1">
          <For each={visible().slice(0, 400)}>{(line) => (
            <button
              class={`flex w-full items-stretch gap-2 rounded-md px-2 py-1 text-left hover:bg-control ${current()?.id === line.id ? 'bg-control' : ''}`}
              onClick={() => setSelected(line.id)}
            >
              <span class={`my-0.5 w-0.5 shrink-0 rounded-full ${LEVEL_BAR[line.level as Level]}`} aria-hidden />
              <span class={`${tonePill(line.source === 'agent' ? 'info' : LEVEL_TONE[line.level])} mt-0.5 shrink-0`}>
                {line.source === 'agent' ? 'agent' : line.level}
              </span>
              <span class="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-ink">
                {line.text}
              </span>
              <span class={`${hint} mt-0.5 shrink-0 tabular-nums`}>{fmtWhen(line.at)}</span>
            </button>
          )}</For>
        </div>
      </Show>

      <Show when={current()}>
        {(line) => <ConsoleDetail line={line()} />}
      </Show>

      <div class={`${row} ${hint}`}>
        <kbd>click</kbd>
        <span>a line for its full text and stack</span>
      </div>

      <Show when={stats().errors > 0}>
        <SendToAgent
          api={p.api}
          page="console"
          selection={{ mode: 'page', cssPath: 'console' }}
          placeholder="e.g. trace the console errors above to their source and fix them"
        />
      </Show>
    </PanelPage>
  )
}
