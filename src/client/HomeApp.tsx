import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { Comment } from '../protocol'
import type { PanelApi } from '../ui/api'
import { btn, btnPrimary, hero, hint, row, sectionLabel, tonePill } from '../ui/bits'
import { copyText, showToast } from '../ui/toast'
import HomeInstall from './HomeInstall'
import HomePanels from './HomePanels'
import HomeSteps from './HomeSteps'
import { PanelHeader, StatStrip } from './PanelKit'
import { fetchHubJson, openDock, type HubConnection, type HubIndex } from './hub-link'
import { PANELS, hubBase } from './panel-catalog'

interface Meta {
  tool: string
  version: string
  platform: string
  cwd: string
  role?: 'operator' | 'viewer'
  capabilities?: string[]
}

interface ToolList {
  ok: boolean
  endpoint: string
  error?: string
  tools: { name: string }[]
}

interface RunnerInfo {
  preference: string
  driver: string | null
  available: string[]
}

interface RoutesReport {
  routes: { path: string }[]
  detected: 'tanstack-router' | 'file-based' | 'none'
  root: string
}

export interface HomeAppProps {
  api: PanelApi
}

const WORKSPACE = 'wrikka-vite-devtools'

/** Paint each panel as its call lands instead of waiting for the slowest one. */
function fill<T>(task: Promise<T | undefined>, apply: (value: T) => void): Promise<void> {
  return task.then(
    (value) => {
      if (value !== undefined) apply(value)
    },
    () => undefined,
  )
}

export default function HomeApp(p: HomeAppProps) {
  const [meta, setMeta] = createSignal<Meta>()
  const [mcp, setMcp] = createSignal<ToolList>()
  const [runner, setRunner] = createSignal<RunnerInfo>()
  const [routes, setRoutes] = createSignal<RoutesReport>()
  const [comments, setComments] = createSignal<Comment[]>([])
  const [index, setIndex] = createSignal<HubIndex>()
  const [conn, setConn] = createSignal<HubConnection>()
  const [busy, setBusy] = createSignal(true)

  onMount(() => void load())

  async function load(): Promise<void> {
    setBusy(true)
    const runnerCall = fill(p.api.call('runner-info', {}) as Promise<RunnerInfo>, setRunner)
    await Promise.all([
      fill(p.api.call('get-meta', {}) as Promise<Meta>, setMeta),
      fill(p.api.call('list-mcp-tools', {}) as Promise<ToolList>, setMcp),
      fill(p.api.call('list-routes', {}) as Promise<RoutesReport>, setRoutes),
      fill(p.api.call('list-comments', {}) as Promise<{ items: Comment[] }>, (list) => setComments(list.items)),
      fill(fetchHubJson<HubIndex>('__index.json'), setIndex),
      fill(fetchHubJson<HubConnection>('__connection.json'), setConn),
    ])
    setBusy(false)
    await runnerCall
  }

  const openCount = createMemo(() => comments().filter((c) => c.status !== 'done').length)
  const driver = createMemo(() => runner()?.driver ?? runner()?.available[0])

  const steps = createMemo(() => [
    {
      label: 'Hub mounted',
      detail: index() ? `${index()!.frames.length} docks · ${conn()?.backend ?? 'backend'}` : 'no __index.json yet',
      done: Boolean(index()),
    },
    {
      label: 'Aggregated MCP',
      detail: mcp()?.ok ? `${mcp()!.tools.length} tools reachable` : (mcp()?.error ?? 'endpoint down'),
      done: Boolean(mcp()?.ok),
      act: () => void openDock('mcp-playground', 'mcp-playground'),
      actLabel: 'playground',
    },
    {
      label: 'Routes scanned',
      detail: routes() ? `${routes()!.routes.length} routes · ${routes()!.detected}` : 'scanning…',
      done: Boolean(routes() && routes()!.detected !== 'none'),
      act: () => void openDock('routes', 'routes'),
      actLabel: 'routes',
    },
    {
      label: 'Agent CLI',
      detail: runner() ? (driver() ?? 'none installed — install claude, codex or opencode') : 'probing installed CLIs…',
      done: Boolean(driver()),
      act: () => void openDock('runs', 'runs'),
      actLabel: 'runs',
    },
  ])

  async function copyEndpoint(): Promise<void> {
    const endpoint = mcp()?.endpoint ?? `${hubBase()}__mcp`
    const ok = await copyText(endpoint)
    showToast(ok ? 'MCP endpoint copied' : 'could not copy the endpoint', ok ? 'ok' : 'bad')
  }

  return (
    <div class="flex flex-col gap-3 p-4">
      <PanelHeader
        title="Home"
        description={meta() ? `${meta()!.tool} · v${meta()!.version} · ${meta()!.platform}` : WORKSPACE}
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Refresh"
        actions={
          <>
            <Show when={meta()?.role}>
              {(role) => (
                <span
                  class={tonePill(role() === 'operator' ? 'ok' : 'warn')}
                  title={
                    role() === 'operator'
                      ? 'this session can run agents and edit comments'
                      : 'read-only session'
                  }
                >
                  {role()} role
                </span>
              )}
            </Show>
            <a class={`${btn} no-underline`} href={hubBase()} target="_blank" rel="noreferrer">
              Open hub
            </a>
          </>
        }
      />

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
              <button class={btnPrimary} onClick={() => void openDock('wrikka-vite-devtools', '')}>
                Open comments
              </button>
              <button class={btn} onClick={() => void openDock('mcp-playground', 'mcp-playground')}>
                MCP playground
              </button>
              <button class={btn} onClick={() => void copyEndpoint()}>
                Copy MCP endpoint
              </button>
            </div>
          </div>

          <ol class="m-0 flex list-none flex-col gap-1.5 p-0 lg:col-span-2">
            <For each={['Install the plugin', 'Open /__devtools/', 'Comment, or type @route']}>
              {(text, i) => (
                <li class="flex items-center gap-2 rounded-lg border border-solid border-line bg-surface-raised/80 px-2.5 py-1.5">
                  <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent-ink">
                    {i() + 1}
                  </span>
                  <span class="text-[11px] text-ink">{text}</span>
                </li>
              )}
            </For>
            <li class={`${hint} px-1`}>{conn()?.backend ? `backend: ${conn()!.backend}` : 'waiting for the hub'}</li>
          </ol>
        </div>
      </section>

      <StatStrip
        items={[
          { value: index()?.frames.length ?? PANELS.length, label: 'docks', hint: conn()?.backend },
          {
            value: mcp()?.tools.length ?? '—',
            label: 'MCP tools',
            hint: mcp()?.ok ? 'reachable' : 'endpoint down',
            tone: mcp()?.ok ? undefined : 'text-bad-ink',
          },
          {
            value: routes()?.routes.length ?? '—',
            label: 'routes',
            hint: routes()?.detected === 'none' ? 'no router detected' : routes()?.detected,
            tone: routes()?.detected === 'none' ? 'text-ink-faint' : undefined,
          },
          {
            value: comments().length,
            label: openCount() > 0 ? `${openCount()} open` : 'comments',
            tone: openCount() > 0 ? 'text-warn-ink' : undefined,
          },
        ]}
      />

      <div class="grid grid-cols-1 gap-2 lg:grid-cols-5">
        <div class="lg:col-span-3">
          <HomeInstall endpoint={mcp()?.endpoint} />
        </div>
        <HomeSteps steps={steps()} cwd={meta()?.cwd} />
      </div>

      <HomePanels />
    </div>
  )
}
