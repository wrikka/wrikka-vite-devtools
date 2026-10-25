import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, btnPrimary, chip, grid, hint, link, row, tile, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtMs } from './format'

interface TestFile {
  file: string
  matches: string[]
}

interface TestList {
  root: string
  tests: TestFile[]
  untested: string[]
  runner: string
}

interface RunResult {
  file: string
  runner: string
  ok: boolean
  code: number
  durationMs: number
  output: string
}

export interface TestsPanelProps {
  api: PanelApi
  root(): string
}

export default function TestsApp(p: TestsPanelProps) {
  const [list, setList] = createSignal<TestList>()
  const [busy, setBusy] = createSignal(true)
  const [running, setRunning] = createSignal<string>()
  const [result, setResult] = createSignal<RunResult>()
  const [msg, setMsg] = createSignal('looking for test files…')

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('list-tests', {})) as TestList
      setList(res)
      setMsg(`${res.tests.length} test files · ${res.untested.length} untested sources · runner: ${res.runner}`)
    } catch (err) {
      setMsg(`scan failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function run(file: string): Promise<void> {
    setRunning(file)
    setResult(undefined)
    try {
      const res = (await p.api.call('run-test', { file })) as RunResult
      setResult(res)
    } catch (err) {
      setResult({ file, runner: 'unknown', ok: false, code: 1, durationMs: 0, output: String(err) })
    } finally {
      setRunning(undefined)
    }
  }

  const covered = createMemo(() => new Set((list()?.tests ?? []).flatMap((t) => t.matches)).size)

  return (
    <PanelPage>
      <PanelHeader title="Tests" description="run a spec from the dock and hand failures to the agent" busy={busy()} refresh={() => void load()} refreshLabel="Rescan" />

      <StatStrip items={[
        { value: list()?.tests.length ?? 0, label: 'test files' },
        { value: covered(), label: 'sources covered' },
        { value: list()?.untested.length ?? 0, label: 'untested', tone: (list()?.untested.length ?? 0) > 0 ? 'text-warn-ink' : 'text-ink-faint' },
        { value: list()?.runner ?? '—', label: 'runner' },
      ]} />

      <p class={hint}>{msg()}</p>

      <Show when={!busy() && (list()?.tests.length ?? 0) === 0}>
        <EmptyState title="No test files" hint="Looked for *.test.* and *.spec.* under the project root." />
      </Show>

      <div class={grid}>
        <For each={list()?.tests ?? []}>{(t) => (
          <div class={tile}>
            <div class="flex items-start gap-2">
              <span class="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-ink" title={t.file}>{t.file}</span>
              <button class={`${btn} shrink-0`} disabled={running() === t.file} onClick={() => void run(t.file)}>
                {running() === t.file ? 'running…' : 'Run'}
              </button>
            </div>
            <div class={row}>
              <Show when={t.matches.length > 0} fallback={<span class={hint}>no obvious source match</span>}>
                <For each={t.matches}>{(m) => <span class={`${chip} cursor-default font-mono`} title={m}>{m.split('/').slice(-2).join('/')}</span>}</For>
              </Show>
            </div>
            <a class={`${link} w-fit text-[11px]`} href={`vscode://file/${p.root()}/${t.file}`}>open in editor</a>
          </div>
        )}</For>
      </div>

      <Show when={result()}>
        {(r) => (
          <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
            <div class="flex flex-wrap items-center gap-2">
              <span class={tonePill(r().ok ? 'ok' : 'bad')}>{r().ok ? 'passed' : 'failed'}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-ink" title={r().file}>{r().file}</span>
              <span class={hint}>{r().runner} · exit {r().code} · {fmtMs(r().durationMs)}</span>
            </div>
            <pre class="m-0 max-h-72 overflow-auto rounded-lg border border-solid border-line bg-surface-sunken p-2 font-mono text-[11px] leading-relaxed text-ink-muted">{r().output || '(no output)'}</pre>
            <Show when={!r().ok}>
              <SendToAgent
                api={p.api}
                page={r().file}
                selection={{ mode: 'page', cssPath: r().file }}
                placeholder={`e.g. fix the failing test in ${r().file}`}
              />
            </Show>
          </div>
        )}
      </Show>

      <Show when={(list()?.untested.length ?? 0) > 0}>
        <div class="flex flex-col gap-1.5 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
          <span class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">untested sources</span>
          <div class={row}>
            <For each={list()?.untested ?? []}>{(file) => <span class={`${chip} cursor-default font-mono`} title={file}>{file.split('/').slice(-2).join('/')}</span>}</For>
          </div>
        </div>
      </Show>
    </PanelPage>
  )
}
