import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { chip, grid, hint, link, row, tab, tabBar, tabOn, tile, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { shortPath } from './format'

interface EnvRef {
  name: string
  files: string[]
  definedIn: string[]
  publicVar: boolean
  secret: boolean
  status: 'ok' | 'missing'
}

interface EnvReport {
  root: string
  scanned: number
  envFiles: { file: string; keys: string[] }[]
  refs: EnvRef[]
  unused: { name: string; definedIn: string[] }[]
  totals: { refs: number; defined: number; missing: number; unused: number }
}

type View = 'refs' | 'unused' | 'files'

const VIEWS: { key: View; label: string }[] = [
  { key: 'refs', label: 'referenced' },
  { key: 'unused', label: 'unused' },
  { key: 'files', label: '.env files' },
]

export interface EnvPanelProps {
  api: PanelApi
  root(): string
}

export default function EnvApp(p: EnvPanelProps) {
  const [report, setReport] = createSignal<EnvReport>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('reading env usage…')
  const [view, setView] = createSignal<View>('refs')
  const [problemsOnly, setProblemsOnly] = createSignal(true)

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('audit-env', {})) as EnvReport
      setReport(res)
      setMsg(`${res.totals.refs} referenced · ${res.totals.defined} defined · ${res.totals.missing} missing · ${res.envFiles.length} env files`)
    } catch (err) {
      setMsg(`audit failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const refs = createMemo(() => {
    const all = report()?.refs ?? []
    return problemsOnly() ? all.filter((r) => r.status === 'missing' || r.secret) : all
  })

  return (
    <PanelPage>
      <PanelHeader
        title="Env & config"
        description="variables referenced in code vs what `.env` defines — names only, values never leave the server"
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Re-audit"
      />

      <StatStrip items={[
        { value: report()?.totals.refs ?? 0, label: 'referenced' },
        { value: report()?.totals.defined ?? 0, label: 'defined' },
        { value: report()?.totals.missing ?? 0, label: 'missing', tone: (report()?.totals.missing ?? 0) > 0 ? 'text-bad-ink' : 'text-ink-faint' },
        { value: report()?.totals.unused ?? 0, label: 'unused', tone: (report()?.totals.unused ?? 0) > 0 ? 'text-warn-ink' : 'text-ink-faint' },
      ]} />

      <p class={hint}>{msg()}</p>

      <div class={tabBar} role="tablist" aria-label="Env views">
        <For each={VIEWS}>{(v) => (
          <button class={`${tab} ${view() === v.key ? tabOn : ''}`} role="tab" aria-selected={view() === v.key} onClick={() => setView(v.key)}>
            {v.label}
            <span class={hint}>
              {v.key === 'refs' ? report()?.totals.refs ?? 0 : v.key === 'unused' ? report()?.unused.length ?? 0 : report()?.envFiles.length ?? 0}
            </span>
          </button>
        )}</For>
        <Show when={view() === 'refs'}>
          <button
            class={`${chip} ml-auto`}
            aria-pressed={problemsOnly()}
            onClick={() => setProblemsOnly(!problemsOnly())}
          >
            {problemsOnly() ? 'problems only' : 'show all'}
          </button>
        </Show>
      </div>

      <Show when={view() === 'refs'}>
        <Show when={!busy() && refs().length === 0}>
          <EmptyState
            title={problemsOnly() ? 'Nothing needs attention' : 'No env references found'}
            hint={problemsOnly() ? 'Every referenced variable is defined and none looks sensitive.' : 'Code does not read `import.meta.env` or `process.env`.'}
          />
        </Show>
        <div class={grid}>
          <For each={refs()}>{(r) => (
            <div class={tile}>
              <div class="flex items-start gap-2">
                <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-ink" title={r.name}>{r.name}</span>
                <span class={tonePill(r.status === 'ok' ? 'ok' : 'bad')}>{r.status}</span>
              </div>
              <div class={row}>
                <Show when={r.publicVar} fallback={<span class={tonePill('info')}>server</span>}>
                  <span class={tonePill('accent')}>public</span>
                </Show>
                <Show when={r.secret}>
                  <span class={tonePill('warn')}>sensitive name</span>
                </Show>
                <span class={`${hint} ml-auto`}>{r.files.length} file{r.files.length === 1 ? '' : 's'}</span>
              </div>
              <p class={`${hint} m-0 font-mono`} title={r.files.join('\n')}>
                {r.files.slice(0, 2).map((f) => shortPath(f, 2)).join(', ')}
                {r.files.length > 2 ? ` +${r.files.length - 2}` : ''}
              </p>
              <Show when={r.status === 'missing'}>
                <div class="flex flex-col gap-1 border-t border-solid border-line pt-2">
                  <p class={`${hint} m-0`}>Not defined in any env file the audit could read.</p>
                  <div class={row}>
                    <span class={`${chip} cursor-default`}>{r.name}=</span>
                    <span class={hint}>add to .env.example</span>
                  </div>
                  <SendToAgent
                    api={p.api}
                    page={'.env.example'}
                    selection={{ mode: 'page', cssPath: r.files[0] }}
                    placeholder={`e.g. add ${r.name} to .env.example and the config schema`}
                  />
                </div>
              </Show>
              <Show when={r.status === 'ok' && r.definedIn.length > 0}>
                <div class={row}>
                  <For each={r.definedIn.slice(0, 4)}>{(f) => <span class={`${chip} cursor-default font-mono`}>{f}</span>}</For>
                </div>
              </Show>
            </div>
          )}</For>
        </div>
      </Show>

      <Show when={view() === 'unused'}>
        <Show when={!busy() && (report()?.unused.length ?? 0) === 0}>
          <EmptyState title="No unused variables" hint="Every key declared in an env file is read somewhere in the code." />
        </Show>
        <div class={grid}>
          <For each={report()?.unused ?? []}>{(u) => (
            <div class={tile}>
              <span class="truncate font-mono text-[13px] font-semibold text-ink" title={u.name}>{u.name}</span>
              <div class={row}>
                <span class={tonePill('warn')}>unused</span>
                <span class={`${hint} ml-auto`}>declared in {u.definedIn.join(', ')}</span>
              </div>
              <SendToAgent
                api={p.api}
                page={u.definedIn[0] ?? '.env.example'}
                selection={{ mode: 'page' }}
                placeholder={`e.g. drop ${u.name} or wire it into the app`}
              />
            </div>
          )}</For>
        </div>
      </Show>

      <Show when={view() === 'files'}>
        <Show when={!busy() && (report()?.envFiles.length ?? 0) === 0}>
          <EmptyState title="No env files found" hint="Looked for .env, .env.local, .env.development, .env.production and .env.example." />
        </Show>
        <div class={grid}>
          <For each={report()?.envFiles ?? []}>{(f) => (
            <div class={tile}>
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-ink">{f.file}</span>
                <span class={`${hint} shrink-0`}>{f.keys.length} keys</span>
              </div>
              <div class={row}>
                <For each={f.keys.slice(0, 12)}>{(k) => <span class={`${chip} cursor-default font-mono`}>{k}</span>}</For>
                <Show when={f.keys.length > 12}>
                  <span class={hint}>+{f.keys.length - 12} more</span>
                </Show>
              </div>
              <a class={`${link} w-fit text-[11px]`} href={`vscode://file/${p.root()}/${f.file}`}>open in editor</a>
            </div>
          )}</For>
        </div>
      </Show>
    </PanelPage>
  )
}
