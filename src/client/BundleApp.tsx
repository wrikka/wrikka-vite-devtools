import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { chip, grid, hint, meter, row, tab, tabBar, tabOn, tile, tonePill } from '../ui/bits'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtBytes, pct, shortPath } from './format'

interface BundleModule {
  file: string
  size: number
  gzip?: number
  local: boolean
}

interface BundleReport {
  available: boolean
  reason?: string
  modules: number
  total: number
  localBytes: number
  depBytes: number
  top: BundleModule[]
  cycles: string[][]
}

type View = 'largest' | 'deps' | 'cycles'

const VIEWS: { key: View; label: string }[] = [
  { key: 'largest', label: 'largest modules' },
  { key: 'deps', label: 'node_modules' },
  { key: 'cycles', label: 'cycles' },
]

export interface BundlePanelProps {
  api: PanelApi
}

export default function BundleApp(p: BundlePanelProps) {
  const [report, setReport] = createSignal<BundleReport>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('reading the Vite module graph…')
  const [view, setView] = createSignal<View>('largest')

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('audit-bundle', {})) as BundleReport
      setReport(res)
      setMsg(
        res.available
          ? `${res.modules} transformed modules · ${fmtBytes(res.localBytes)} local · ${fmtBytes(res.depBytes)} dependencies`
          : (res.reason ?? 'module graph unavailable'),
      )
    } catch (err) {
      setMsg(`audit failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const rows = createMemo(() => {
    const all = report()?.top ?? []
    return view() === 'deps' ? all.filter((m) => !m.local) : view() === 'largest' ? all : []
  })
  const largest = createMemo(() => rows().reduce((max, m) => Math.max(max, m.size), 0) || 1)

  return (
    <PanelPage>
      <PanelHeader title="Bundle" description="what Vite actually transforms in this dev session" busy={busy()} refresh={() => void load()} refreshLabel="Re-read" />

      <StatStrip items={[
        { value: report()?.modules ?? 0, label: 'modules' },
        { value: fmtBytes(report()?.localBytes), label: 'your code' },
        { value: fmtBytes(report()?.depBytes), label: 'dependencies' },
        { value: report()?.cycles.length ?? 0, label: 'cycles', tone: (report()?.cycles.length ?? 0) > 0 ? 'text-warn-ink' : 'text-ink-faint' },
      ]} />

      <p class={hint}>{msg()}</p>

      <Show when={report() && !report()?.available}>
        <EmptyState title="Module graph unavailable" hint={report()?.reason} />
      </Show>

      <Show when={report()?.available}>
        <div class={tabBar} role="tablist" aria-label="Bundle views">
          <For each={VIEWS}>{(v) => (
            <button class={`${tab} ${view() === v.key ? tabOn : ''}`} role="tab" aria-selected={view() === v.key} onClick={() => setView(v.key)}>
              {v.label}
              <span class={hint}>
                {v.key === 'cycles' ? report()?.cycles.length ?? 0 : v.key === 'deps' ? (report()?.top ?? []).filter((m) => !m.local).length : report()?.top.length ?? 0}
              </span>
            </button>
          )}</For>
        </div>

        <Show when={view() !== 'cycles'}>
          <Show when={!busy() && rows().length === 0}>
            <EmptyState title="Nothing in this bucket" hint="No transformed module matches this filter yet — interact with the app, then re-read." />
          </Show>
          <div class="flex flex-col gap-1">
            <For each={rows()}>{(m) => (
              <div class="flex flex-col gap-1 rounded-lg border border-solid border-line bg-surface-raised px-2.5 py-1.5">
                <div class="flex items-center gap-2">
                  <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-ink" title={m.file}>{shortPath(m.file, 3)}</span>
                  <Show when={m.gzip != null}>
                    <span class={`${hint} shrink-0`}>gz {fmtBytes(m.gzip)}</span>
                  </Show>
                  <span class="shrink-0 text-[12px] font-semibold tabular-nums text-ink">{fmtBytes(m.size)}</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class={`${meter} flex-1`} role="presentation">
                    <div class={`h-full rounded-full ${m.local ? 'bg-accent' : 'bg-info'}`} style={{ width: `${Math.max(2, (m.size / largest()) * 100)}%` }} />
                  </div>
                  <span class={`${hint} w-10 text-right tabular-nums`}>{pct(m.size, report()?.total ?? 0)}</span>
                </div>
              </div>
            )}</For>
          </div>
        </Show>

        <Show when={view() === 'cycles'}>
          <Show when={!busy() && (report()?.cycles.length ?? 0) === 0}>
            <EmptyState title="No import cycles" hint="The transformed graph is acyclic — safe to split and reorder modules." />
          </Show>
          <div class={grid}>
            <For each={report()?.cycles ?? []}>{(cycle, index) => (
              <div class={tile}>
                <div class="flex items-center gap-2">
                  <span class={tonePill('warn')}>cycle {index() + 1}</span>
                  <span class={`${hint} ml-auto`}>{cycle.length} modules</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <For each={cycle}>{(file, i) => (
                    <span class="truncate font-mono text-[11px] text-ink-muted" title={file}>
                      {i() > 0 ? '↳ ' : ''}{shortPath(file, 3)}
                    </span>
                  )}</For>
                </div>
              </div>
            )}</For>
          </div>
        </Show>

        <div class={row}>
          <span class={hint}>totals exclude node_modules from “your code”</span>
          <span class={`${chip} ml-auto cursor-default`}>graph: dev server</span>
        </div>
      </Show>
    </PanelPage>
  )
}
