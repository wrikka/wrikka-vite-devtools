import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btnPrimary, field, grid, hint, row, sectionLabel, tile, tonePill, type Tone } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtMs } from './format'

type CheckStatus = 'ok' | 'warn' | 'missing' | 'info'

interface HeaderCheck {
  name: string
  header: string
  value?: string
  status: CheckStatus
  weight: number
  detail: string
}

interface AuditReport {
  ok: boolean
  url: string
  status: number
  durationMs: number
  score: number
  error?: string
  checks: HeaderCheck[]
  headers: { name: string; value: string }[]
}

export interface SecurityAppProps {
  api: PanelApi
}

const toneOf: Record<CheckStatus, Tone> = { ok: 'ok', warn: 'warn', missing: 'bad', info: 'info' }

function scoreTone(score: number): string {
  if (score >= 85) return 'text-ok-ink'
  if (score >= 60) return 'text-warn-ink'
  return 'text-bad-ink'
}

export default function SecurityApp(p: SecurityAppProps) {
  const [report, setReport] = createSignal<AuditReport>()
  const [target, setTarget] = createSignal('')
  const [busy, setBusy] = createSignal(true)

  onMount(() => void scan())

  async function scan(): Promise<void> {
    setBusy(true)
    try {
      const url = target().trim()
      const res = (await p.api.call('audit-headers', url ? { url } : {})) as AuditReport
      setReport(res)
    } catch (err) {
      setReport({
        ok: false,
        url: target(),
        status: 0,
        durationMs: 0,
        score: 0,
        error: String(err),
        checks: [],
        headers: [],
      })
    } finally {
      setBusy(false)
    }
  }

  const counts = createMemo(() => {
    const acc = { ok: 0, warn: 0, missing: 0, info: 0 }
    for (const c of report()?.checks ?? []) acc[c.status] += 1
    return acc
  })

  const score = createMemo(() => report()?.score ?? 0)

  return (
    <PanelPage>
      <PanelHeader
        title="Security Headers"
        description="grade the response headers a browser actually receives on this dev origin"
        busy={busy()}
        refresh={() => void scan()}
        refreshLabel="Audit again"
      />

      <div class={row}>
        <input
          class={`${field} max-w-80 flex-1 font-mono`}
          placeholder="path or full local URL — default: app root"
          value={target()}
          onInput={(e) => setTarget(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void scan()
          }}
        />
        <button class={btnPrimary} disabled={busy()} onClick={() => void scan()}>
          Audit
        </button>
      </div>

      <Show when={report()}>
        {(r) => (
          <>
            <StatStrip items={[
              { value: r().score, label: 'score / 100', tone: scoreTone(score()) },
              { value: r().status || '—', label: 'http status' },
              { value: fmtMs(r().durationMs), label: 'round trip' },
              { value: r().headers.length, label: 'headers seen' },
            ]} />

            <div class={row}>
              <span class={tonePill('ok')}>{counts().ok} ok</span>
              <span class={tonePill('warn')}>{counts().warn} weak</span>
              <span class={tonePill('bad')}>{counts().missing} missing</span>
              <span class={tonePill('info')}>{counts().info} n/a</span>
              <span class={`${hint} break-all`}>{r().url || target() || 'app root'}</span>
            </div>

            <Show when={r().error}>
              {(err) => <EmptyState title="Audit failed" hint={err()} />}
            </Show>

            <Show when={r().ok && r().checks.length > 0}>
              <div class={grid}>
                <For each={r().checks}>{(check) => (
                  <div class={tile}>
                    <div class={row}>
                      <span class={tonePill(toneOf[check.status])}>{check.status}</span>
                      <span class="ml-auto text-[10px] text-ink-faint">w{check.weight}</span>
                    </div>
                    <span class="text-[12px] font-semibold text-ink">{check.name}</span>
                    <span class="truncate font-mono text-[10px] text-ink-muted" title={check.value ?? check.header}>
                      {check.value ?? check.header}
                    </span>
                    <span class="text-[11px] leading-snug text-ink-muted">{check.detail}</span>
                  </div>
                )}</For>
              </div>
            </Show>

            <Show when={r().headers.length > 0}>
              <details class="rounded-xl border border-solid border-line bg-surface-raised p-3">
                <summary class={`${sectionLabel} cursor-pointer`}>raw response headers ({r().headers.length})</summary>
                <div class="mt-2 flex flex-col gap-1">
                  <For each={r().headers}>{(h) => (
                    <div class="flex gap-2 font-mono text-[11px]">
                      <span class="shrink-0 text-accent-ink">{h.name}</span>
                      <span class="break-all text-ink-muted">{h.value}</span>
                    </div>
                  )}</For>
                </div>
              </details>
            </Show>

            <Show when={r().ok && r().score < 85}>
              <SendToAgent
                api={p.api}
                page={`security:${r().url || target() || 'root'}`}
                selection={{ mode: 'page', cssPath: r().url || '/' }}
                placeholder="e.g. add CSP and COOP headers to the Vite dev server"
              />
            </Show>
          </>
        )}
      </Show>
    </PanelPage>
  )
}
