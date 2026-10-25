import { For, Show, createMemo, createResource } from 'solid-js'
import type { PanelApi } from '../ui/api'
import {
  card,
  hint,
  page,
  pageHead,
  sectionLabel,
  stat,
  statLabel,
  statRow,
  statValue,
  statusPill,
  title,
  tonePill,
} from '../ui/bits'

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

  const counts = createMemo(() => {
    const entries = scan.latest?.entries ?? []
    return {
      dirs: entries.filter((e) => e.kind === 'dir').length,
      files: entries.filter((e) => e.kind === 'file').length,
      other: entries.filter((e) => e.kind === 'other').length,
    }
  })

  return (
    <div class={page}>
      <div class={pageHead}>
        <h1 class={title}>Diagnostics</h1>
        <span class={`${hint} mr-auto`}>what this hub runs against</span>
        <Show when={meta.latest}>{(m) => <span class={statusPill('done')}>{`${m().tool} ${m().version}`}</span>}</Show>
      </div>

      <Show when={meta.error}>
        <div class={`${card} gap-1.5`}>
          <span class={statusPill('failed')}>backend unavailable</span>
          <span class={hint}>This is a static build, so there is no live dev server behind the panel.</span>
        </div>
      </Show>
      <Show when={meta.loading || runner.loading || scan.loading}>
        <span class={hint}>loading…</span>
      </Show>

      <Show when={scan.latest}>
        {(s) => (
          <div class={statRow}>
            <div class={stat}>
              <span class={statValue}>{s().entries.length}</span>
              <span class={statLabel}>entries</span>
            </div>
            <div class={stat}>
              <span class={statValue}>{counts().dirs}</span>
              <span class={statLabel}>folders</span>
            </div>
            <div class={stat}>
              <span class={statValue}>{counts().files}</span>
              <span class={statLabel}>files</span>
            </div>
            <div class={stat}>
              <span class={statValue}>{s().truncated ? '≤' : '='}</span>
              <span class={statLabel}>listing</span>
            </div>
          </div>
        )}
      </Show>

      <div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Show when={meta.latest}>
          {(m) => (
            <dl class={`${card} gap-1.5`}>
              <dt class={sectionLabel}>environment</dt>
              <Field label="tool" value={`${m().tool} ${m().version}`} />
              <Field label="platform" value={m().platform} />
              <Field label="cwd" value={m().cwd} />
              <Field label="generated at" value={m().generatedAt} />
            </dl>
          )}
        </Show>
        <Show when={runner.latest}>
          {(r) => (
            <dl class={`${card} gap-1.5`}>
              <dt class={sectionLabel}>comment runner</dt>
              <Field label="driver" value={r().driver ?? 'none'} />
              <div class="flex flex-wrap items-center gap-1">
                <span class={hint}>installed</span>
                <Show when={r().available.length > 0} fallback={<span class={hint}>none</span>}>
                  <For each={r().available}>{(name) => <span class={tonePill('info')}>{name}</span>}</For>
                </Show>
              </div>
            </dl>
          )}
        </Show>
      </div>

      <Show when={scan.latest}>
        {(s) => (
          <div class={card}>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class={sectionLabel}>project directory</span>
              <span class={`${hint} font-mono`}>{s().dir}</span>
              <span class={`${hint} mr-auto`}>
                {s().entries.length} entries{s().truncated ? ' (truncated)' : ''}
              </span>
            </div>
            <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
              <For each={s().entries}>
                {(e) => (
                  <li class="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-control">
                    <span class={tonePill(e.kind === 'dir' ? 'info' : e.kind === 'file' ? 'accent' : 'warn')}>
                      {e.kind}
                    </span>
                    <span class="truncate font-mono text-[11px] text-ink">{e.name}</span>
                    <Show when={e.size != null}>
                      <span class={`${hint} ml-auto shrink-0 tabular-nums`}>{`${e.size} B`}</span>
                    </Show>
                  </li>
                )}
              </For>
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
