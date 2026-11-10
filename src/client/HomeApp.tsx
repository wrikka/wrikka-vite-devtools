import { createMemo, createSignal, onMount } from 'solid-js'
import type { Comment } from '../protocol'
import type { PanelApi } from '../ui/api'
import HomeDashboard, { type GlanceItem } from './HomeDashboard'
import HomeInstall from './HomeInstall'
import HomePanels from './HomePanels'
import HomeStats, { CommentPipeline } from './HomeStats'
import HomeSteps from './HomeSteps'
import { PanelHeader, PanelPage } from './PanelKit'
import { fetchHubJson, openDock, type HubConnection, type HubIndex } from './hub-link'
import { PANELS } from './panel-catalog'

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
  const docks = createMemo(() => index()?.frames.length ?? PANELS.length)

  const glance = createMemo<GlanceItem[]>(() => [
    {
      label: 'MCP endpoint',
      value: mcp() ? (mcp()!.ok ? `${mcp()!.tools.length} tools reachable` : (mcp()!.error ?? 'unreachable')) : 'probing…',
      tone: mcp() ? (mcp()!.ok ? 'ok' : 'bad') : 'muted',
    },
    {
      label: 'Agent CLI',
      value: runner() ? (driver() ?? 'none installed') : 'probing installed CLIs…',
      tone: driver() ? 'ok' : runner() ? 'warn' : 'muted',
    },
    {
      label: 'Routes',
      value: routes() ? `${routes()!.routes.length} routes · ${routes()!.detected}` : 'scanning…',
      tone: routes() ? (routes()!.detected === 'none' ? 'warn' : 'ok') : 'muted',
    },
    {
      label: 'Comments',
      value: `${comments().length} captured · ${openCount()} open`,
      tone: openCount() > 0 ? 'warn' : comments().length > 0 ? 'ok' : 'muted',
    },
  ])

  const steps = createMemo(() => [
    {
      label: 'Hub mounted',
      detail: index() ? `${index()!.frames.length} docks · ${conn()?.backend ?? 'backend'}` : 'no __index.json yet',
      done: Boolean(index()),
      pending: !index(),
    },
    {
      label: 'Aggregated MCP',
      detail: mcp()?.ok ? `${mcp()!.tools.length} tools reachable` : (mcp()?.error ?? 'endpoint down'),
      done: Boolean(mcp()?.ok),
      pending: !mcp(),
      act: () => void openDock('mcp-playground', 'mcp-playground'),
      actLabel: 'playground',
    },
    {
      label: 'Routes scanned',
      detail: routes() ? `${routes()!.routes.length} routes · ${routes()!.detected}` : 'scanning…',
      done: Boolean(routes() && routes()!.detected !== 'none'),
      pending: !routes(),
      act: () => void openDock('routes', 'routes'),
      actLabel: 'routes',
    },
    {
      label: 'Agent CLI',
      detail: runner() ? (driver() ?? 'none installed — install claude, codex or opencode') : 'probing installed CLIs…',
      done: Boolean(driver()),
      pending: !runner(),
      act: () => void openDock('runs', 'runs'),
      actLabel: 'runs',
    },
  ])

  return (
    <PanelPage>
      <PanelHeader
        title="Home"
        description={meta() ? `${meta()!.tool} · v${meta()!.version} · ${meta()!.platform}` : WORKSPACE}
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Refresh"
      />

      <HomeDashboard
        role={meta()?.role}
        conn={conn()}
        docks={docks()}
        glance={glance()}
        endpoint={mcp()?.endpoint}
      />

      <HomeStats
        docks={docks()}
        backend={conn()?.backend}
        mcpTools={mcp()?.tools.length}
        mcpOk={mcp()?.ok}
        routes={routes()?.routes.length}
        routesDetected={routes()?.detected}
        comments={comments()}
        openCount={openCount()}
      />

      <div class="grid grid-cols-1 gap-2 lg:grid-cols-5">
        <div class="lg:col-span-3">
          <HomeInstall endpoint={mcp()?.endpoint} />
        </div>
        <div class="flex flex-col gap-2 lg:col-span-2">
          <HomeSteps steps={steps()} cwd={meta()?.cwd} />
          <CommentPipeline comments={comments()} />
        </div>
      </div>

      <HomePanels />
    </PanelPage>
  )
}
