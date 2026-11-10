import { Show } from 'solid-js'
import { btn, btnPrimary, hero, hint, row } from '../ui/bits'
import { copyText, showToast } from '../ui/toast'
import { hubBase } from './panel-catalog'
import { openDock, type HubConnection } from './hub-link'

export interface HomeDashboardProps {
  role?: string
  conn?: HubConnection
  docks: number
  /** MCP endpoint the hub advertises; falls back to the conventional local path. */
  endpoint?: string
}

/** Hero band: the product line, live hub status, and the primary actions. */
export default function HomeDashboard(p: HomeDashboardProps) {
  const connected = () => Boolean(p.conn)

  async function copyEndpoint(): Promise<void> {
    const endpoint = p.endpoint ?? `${hubBase()}__mcp`
    const ok = await copyText(endpoint)
    showToast(ok ? 'MCP endpoint copied' : 'could not copy the endpoint', ok ? 'ok' : 'bad')
  }

  return (
    <section class={hero}>
      <h2 class="m-0 max-w-xl text-[22px] font-semibold leading-tight tracking-tight text-ink">
        Every devtool your app needs, docked on the left.
      </h2>
      <p class={`${hint} max-w-xl`}>
        Panels read the running dev server, the overlay turns a page click into an agent task, and the hub serves one
        aggregated MCP endpoint.
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
          {(role) => (
            <span class={`${hint} rounded-full border border-solid border-line px-2 py-0.5`}>
              {role()} role
            </span>
          )}
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
    </section>
  )
}
