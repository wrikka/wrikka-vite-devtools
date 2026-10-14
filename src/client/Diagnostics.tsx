import { For, Show, createResource } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { card, hint, statusPill } from '../ui/bits'

interface Meta {
  tool: string
  version: string
  platform: string
  cwd: string
  generatedAt: string
}

interface RunnerInfo {
  driver: string | null
  available: string[]
}

interface ScanResult {
  dir: string
  entries: { name: string; kind: 'file' | 'dir' | 'other'; size: number | null }[]
  truncated: boolean
}

export default function Diagnostics(p: { api: PanelApi }) {
  const [meta] = createResource(() => p.api.call('get-meta') as Promise<Meta>)
  const [runner] = createResource(() => p.api.call('runner-info') as Promise<RunnerInfo>)
  const [scan] = createResource(() => p.api.call('scan-dir', { path: '.', limit: 30 }) as Promise<ScanResult>)

  return (
    <div class="flex flex-col gap-2">
      <Show when={meta.error}>
        <div class={statusPill('failed')}>backend unavailable — static build has no live dev server</div>
      </Show>
      <Show when={meta.loading || runner.loading || scan.loading}>
        <span class={hint}>loading…</span>
      </Show>
      <Show when={meta.latest}>
        {(m) => (
          <dl class={card}>
            <Field label="tool" value={`${m().tool} ${m().version}`} />
            <Field label="platform" value={m().platform} />
            <Field label="cwd" value={m().cwd} />
            <Field label="generated at" value={m().generatedAt} />
          </dl>
        )}
      </Show>
      <Show when={runner.latest}>
        {(r) => (
          <dl class={card}>
            <Field label="driver" value={r().driver ?? 'none'} />
            <Field label="installed" value={r().available.join(', ') || 'none'} />
          </dl>
        )}
      </Show>
      <Show when={scan.latest}>
        {(s) => (
          <div class={card}>
            <span class={hint}>{`${s().dir} — ${s().entries.length} entries${s().truncated ? ' (truncated)' : ''}`}</span>
            <ul class="m-0 list-disc pl-5 text-[12px]">
              <For each={s().entries}>{(e) => <li>{`${e.kind === 'dir' ? '[d]' : '[f]'} ${e.name}${e.size != null ? ` (${e.size} B)` : ''}`}</li>}</For>
            </ul>
          </div>
        )}
      </Show>
    </div>
  )
}

function Field(p: { label: string; value: string }) {
  return (
    <div class="flex flex-wrap gap-1">
      <dt class={hint}>{p.label}</dt>
      <dd class="m-0 font-mono text-[12px] break-all">{p.value}</dd>
    </div>
  )
}
