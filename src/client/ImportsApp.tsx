import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { chip, grid, hint, link, row, tab, tabBar, tabOn, tile, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'

interface ImportFile {
  file: string
  importers: string[]
  imports: string[]
}

interface ImportReport {
  root: string
  scanned: number
  truncated: boolean
  edges: number
  files: ImportFile[]
  unused: { file: string; name: string }[]
  unresolved: { file: string; specifier: string }[]
}

type View = 'isolated' | 'unused' | 'unresolved'

const VIEWS: { key: View; label: string }[] = [
  { key: 'isolated', label: 'entry & isolated' },
  { key: 'unused', label: 'unused exports' },
  { key: 'unresolved', label: 'unresolved' },
]

export interface ImportsPanelProps {
  api: PanelApi
  root(): string
}

export default function ImportsApp(p: ImportsPanelProps) {
  const [report, setReport] = createSignal<ImportReport>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('walking imports…')
  const [view, setView] = createSignal<View>('isolated')
  const [open, setOpen] = createSignal<string>()

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('audit-imports', {})) as ImportReport
      setReport(res)
      setMsg(`${res.scanned} files · ${res.edges} relative edges · ${res.unused.length} unused exports · ${res.unresolved.length} unresolved`)
    } catch (err) {
      setMsg(`audit failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const files = createMemo(() => report()?.files ?? [])

  return (
    <PanelPage>
      <PanelHeader title="Import graph" description="who imports what — and what nothing imports" busy={busy()} refresh={() => void load()} refreshLabel="Re-walk" />

      <StatStrip items={[
        { value: report()?.scanned ?? 0, label: 'files' },
        { value: report()?.edges ?? 0, label: 'relative edges' },
        { value: report()?.unused.length ?? 0, label: 'unused exports', tone: (report()?.unused.length ?? 0) > 0 ? 'text-warn-ink' : 'text-ink-faint' },
        { value: report()?.unresolved.length ?? 0, label: 'unresolved', tone: (report()?.unresolved.length ?? 0) > 0 ? 'text-bad-ink' : 'text-ink-faint' },
      ]} />

      <p class={hint}>{msg()}</p>

      <div class={tabBar} role="tablist" aria-label="Import views">
        <For each={VIEWS}>{(v) => (
          <button class={`${tab} ${view() === v.key ? tabOn : ''}`} role="tab" aria-selected={view() === v.key} onClick={() => setView(v.key)}>
            {v.label}
            <span class={hint}>
              {v.key === 'isolated' ? files().length : v.key === 'unused' ? report()?.unused.length ?? 0 : report()?.unresolved.length ?? 0}
            </span>
          </button>
        )}</For>
      </div>

      <Show when={report()?.truncated}>
        <p class={hint}>scan stopped at the file cap — the graph is partial.</p>
      </Show>

      <Show when={view() === 'isolated'}>
        <Show when={!busy() && files().length === 0}>
          <EmptyState title="No source files found" hint="The walk found no .ts/.tsx/.js/.jsx files under the project root." />
        </Show>
        <div class={grid}>
          <For each={files()}>{(f) => {
            const expanded = () => open() === f.file
            return (
              <div class={`${tile} ${expanded() ? 'border-accent' : ''}`}>
                <button
                  class="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-0 text-left"
                  aria-expanded={expanded()}
                  onClick={() => setOpen(expanded() ? undefined : f.file)}
                >
                  <div class="flex items-start gap-2">
                    <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-ink" title={f.file}>{f.file}</span>
                    <Show when={f.importers.length === 0}>
                      <span class={tonePill('warn')}>no importers</span>
                    </Show>
                  </div>
                  <div class={row}>
                    <span class={hint}>{f.importers.length} importer{f.importers.length === 1 ? '' : 's'}</span>
                    <span class={hint}>·</span>
                    <span class={hint}>{f.imports.length} import{f.imports.length === 1 ? '' : 's'}</span>
                  </div>
                </button>
                <Show when={expanded()}>
                  <div class="flex flex-col gap-1.5 border-t border-solid border-line pt-2">
                    <span class={hint}>imported by</span>
                    <div class={row}>
                      <Show when={f.importers.length > 0} fallback={<span class={hint}>nothing — likely an entry point</span>}>
                        <For each={f.importers.slice(0, 8)}>{(i) => <span class={`${chip} cursor-default font-mono`} title={i}>{i.split('/').slice(-2).join('/')}</span>}</For>
                      </Show>
                    </div>
                    <span class={hint}>imports</span>
                    <div class={row}>
                      <Show when={f.imports.length > 0} fallback={<span class={hint}>none</span>}>
                        <For each={f.imports.slice(0, 8)}>{(i) => <span class={`${chip} cursor-default font-mono`} title={i}>{i.split('/').slice(-2).join('/')}</span>}</For>
                      </Show>
                    </div>
                    <a class={`${link} w-fit text-[11px]`} href={`vscode://file/${p.root()}/${f.file}`}>open in editor</a>
                  </div>
                </Show>
              </div>
            )
          }}</For>
        </div>
      </Show>

      <Show when={view() === 'unused'}>
        <Show when={!busy() && (report()?.unused.length ?? 0) === 0}>
          <EmptyState title="No unused exports" hint="Every named export is referenced by another file in the scan." />
        </Show>
        <div class={grid}>
          <For each={report()?.unused ?? []}>{(u) => (
            <div class={tile}>
              <div class="flex items-start gap-2">
                <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-ink">{u.name}</span>
                <span class={tonePill('warn')}>unused</span>
              </div>
              <p class={`${hint} m-0 truncate font-mono`} title={u.file}>{u.file}</p>
              <SendToAgent
                api={p.api}
                page={u.file}
                selection={{ mode: 'component', componentLabel: u.name, cssPath: u.file }}
                placeholder={`e.g. remove ${u.name} or use it`}
              />
            </div>
          )}</For>
        </div>
      </Show>

      <Show when={view() === 'unresolved'}>
        <Show when={!busy() && (report()?.unresolved.length ?? 0) === 0}>
          <EmptyState title="Every relative import resolves" hint="No specifier points at a file the scan could not find." />
        </Show>
        <div class={grid}>
          <For each={report()?.unresolved ?? []}>{(u) => (
            <div class={tile}>
              <span class="truncate font-mono text-[13px] font-semibold text-bad-ink" title={u.specifier}>{u.specifier}</span>
              <p class={`${hint} m-0 truncate font-mono`} title={u.file}>from {u.file}</p>
              <a class={`${link} w-fit text-[11px]`} href={`vscode://file/${p.root()}/${u.file}`}>open in editor</a>
            </div>
          )}</For>
        </div>
      </Show>
    </PanelPage>
  )
}
