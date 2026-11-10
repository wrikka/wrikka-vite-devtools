import { For, Show } from 'solid-js'
import { btn, btnPrimary, hero, hint, row, sectionLabel, tonePill, type Tone } from '../ui/bits'
import { copyText, showToast } from '../ui/toast'
import { hubBase } from './panel-catalog'
import { openDock, type HubConnection } from './hub-link'

export interface GlanceItem {
  label: string
  value: string
  tone?: Tone | 'muted'
}

export interface HomeDashboardProps {
  role?: string
  conn?: HubConnection
  docks: number
  /** One-line readiness readout per subsystem, computed from data Home already fetches. */
  glance: GlanceItem[]
  /** MCP endpoint the hub advertises; falls back to the conventional local path. */
  endpoint?: string
}

const DOT: Record<string, string> = {
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  info: 'bg-info',
  bad: 'bg-bad',
  muted: 'bg-line-strong',
}

function dot(tone: GlanceItem['tone']): string {
  return DOT[tone ?? 'muted'] ?? 'bg-line-strong'
}

/** Hero band: hub status, quick actions, and the at-a-glance subsystem readout. */
export default function HomeDashboard(p: HomeDashboardProps) {
  const connected = () => Boolean(p.conn)

  async function copyEndpoint(): Promise<void> {
    const endpoint = p.endpoint ?? `${hubBase()}__mcp`
    const ok = await copyText(endpoint)
    showToast(ok ? 'MCP endpoint copied' : 'could not copy the endpoint', ok ? 'ok' : 'bad')
  }

  return (
    <section class={hero}>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div class="flex flex-col gap-2 lg:col-span-3">
          <span class={sectionLabel}>devtools hub</span>
          <h2 class="m-0 max-w-xl text-[24px] font-semibold leading-tight tracking-tight text-ink">
            Every devtool your app needs, docked on the left.
          </h2>
          <p class={`${hint} max-w-xl`}>
            Panels read the running dev server, comment capture drives an agent CLI, and the hub advertises one
            aggregated MCP endpoint for any client.
          </p>
          <div class={row}>
            <span
              class={`inline-flex items-center gap-1.5 rounded-full border border-solid px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                connected() ? 'border-ok/50 bg-ok/20 text-ok-ink' : 'border-warn/50 bg-warn/20 text-warn-ink'
              }`}
              title={connected() ? `hub backend: ${p.conn!.backend}` : 'waiting for __connection.json'}
            >
              <span class={`size-1.5 rounded-full ${connected() ? 'bg-ok' : 'bg-warn'}`} aria-hidden />
              {connected() ? (p.conn!.backend || 'connected') : 'connecting'}
            </span>
            <span class={`${hint} tabular-nums`}>{p.docks} docks mounted</span>
            <Show when={p.role}>
              {(role) => <span class={tonePill(role() === 'operator' ? 'ok' : 'warn')}>{role()} role</span>}
            </Show>
          </div>
          <div class={row}>
            <button class={btnPrimary} onClick={() => void openDock('wrikka-vite-devtools', '')}>
              Open comments
            </button>
            <button class={btn} onClick={() => void openDock('mcp-playground', 'mcp-playground')}>
              MCP playground
            </button>
            <button class={btn} onClick={() => void copyEndpoint()}>
              Copy MCP endpoint
            </button>
            <a class={`${btn} no-underline`} href={hubBase()} target="_blank" rel="noreferrer">
              Open hub ↗
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 rounded-xl border border-solid border-line bg-surface-raised/80 p-2.5 lg:col-span-2">
          <span class={sectionLabel}>at a glance</span>
          <For each={p.glance}>
            {(g) => (
              <div class="flex items-center gap-2 rounded-lg px-1.5 py-1">
                <span class={`size-1.5 shrink-0 rounded-full ${dot(g.tone)}`} aria-hidden />
                <span class="text-[11px] text-ink-muted">{g.label}</span>
                <span class="ml-auto truncate text-[11px] font-medium text-ink" title={g.value}>
                  {g.value}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  )
}
