import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, btnPrimary, chip, field, grid, hint, row, sectionLabel, tile, tileOn, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { useAccess } from '../ui/access-store'
import { copyText, showToast } from '../ui/toast'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtMs } from './format'

interface PropSchema {
  type?: string
  description?: string
  enum?: unknown[]
}

interface ToolSchema {
  properties?: Record<string, PropSchema>
  required?: string[]
}

interface McpTool {
  name: string
  description?: string
  inputSchema?: ToolSchema
}

interface ToolList {
  ok: boolean
  endpoint: string
  error?: string
  tools: McpTool[]
}

interface CallResult {
  ok: boolean
  isError: boolean
  durationMs: number
  result: string
  error?: string
}

interface Group {
  key: string
  label: string
  ico: string
  tools: McpTool[]
}

export interface McpAppProps {
  api: PanelApi
}

function propsOf(tool: McpTool | undefined): [string, PropSchema][] {
  if (!tool) return []
  return Object.entries(tool.inputSchema?.properties ?? {})
}

/** Prefill only what the schema marks required, so a call fails loudly instead of silently. */
function defaultArgs(tool: McpTool | undefined): string {
  if (!tool) return '{}'
  const schema = tool.inputSchema ?? {}
  const required = schema.required ?? []
  const out: Record<string, unknown> = {}
  for (const key of required) {
    const prop = schema.properties?.[key]
    if (!prop) out[key] = ''
    else if (prop.enum?.length) out[key] = prop.enum[0]
    else if (prop.type === 'number' || prop.type === 'integer') out[key] = 0
    else if (prop.type === 'boolean') out[key] = false
    else if (prop.type === 'array') out[key] = []
    else if (prop.type === 'object') out[key] = {}
    else out[key] = ''
  }
  return JSON.stringify(out, null, 2)
}

/** Aggregate view: one group per owner so 60+ tools stay scannable. */
function groupTools(tools: McpTool[], appName: string): Group[] {
  const map = new Map<string, Group>()
  const push = (key: string, label: string, ico: string, tool: McpTool) => {
    const g = map.get(key) ?? { key, label, ico, tools: [] }
    g.tools.push(tool)
    map.set(key, g)
  }
  for (const tool of tools) {
    const svc = /^devframes_service_([a-z0-9-]+)_/i.exec(tool.name)
    if (svc) {
      push(`service:${svc[1]}`, `service · ${svc[1]}`, 'service', tool)
      continue
    }
    if (tool.name.startsWith('devframe_')) {
      push('hub', 'hub', 'hub', tool)
      continue
    }
    if (appName && tool.name.startsWith(`${appName}_`)) {
      push('app', appName, 'app', tool)
      continue
    }
    const at = tool.name.indexOf('_')
    const owner = at > 0 ? tool.name.slice(0, at) : 'other'
    push(`owner:${owner}`, owner, 'app', tool)
  }
  const order = (g: Group): number => (g.key === 'app' ? 0 : g.key === 'hub' ? 1 : 2)
  return [...map.values()].sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label))
}

export default function McpApp(p: McpAppProps) {
  const [list, setList] = createSignal<ToolList>()
  const [appName, setAppName] = createSignal('')
  const [selected, setSelected] = createSignal<string>()
  const [argsText, setArgsText] = createSignal('{}')
  const [result, setResult] = createSignal<CallResult>()
  const [calls, setCalls] = createSignal(0)
  const [busy, setBusy] = createSignal(true)
  const [calling, setCalling] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const [collapsed, setCollapsed] = createSignal<Record<string, boolean>>({})
  const [msg, setMsg] = createSignal('opening the MCP endpoint…')
  const access = useAccess(p.api)

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const [res, meta] = await Promise.all([
        p.api.call('list-mcp-tools', {}) as Promise<ToolList>,
        p.api.call('get-meta', {}).catch(() => undefined) as Promise<{ tool?: string } | undefined>,
      ])
      setAppName(meta?.tool ?? '')
      setList(res)
      setMsg(res.ok ? `${res.tools.length} tools exposed at ${res.endpoint}` : (res.error ?? 'endpoint unavailable'))
      const match = res.tools.find((t) => t.name === selected())
      const first = res.tools[0]
      if (!match && first) pick(first)
    } catch (err) {
      setMsg(`tools/list failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  function pick(tool: McpTool): void {
    setSelected(tool.name)
    setResult(undefined)
    setArgsText(defaultArgs(tool))
  }

  async function call(): Promise<void> {
    const tool = current()
    if (!tool) {
      setMsg('pick a tool first')
      return
    }
    if (!access.can('mcp:call')) {
      showToast('read-only session — MCP calls are disabled', 'warn')
      return
    }
    setCalling(true)
    setResult(undefined)
    try {
      const res = (await p.api.call('call-mcp-tool', { name: tool.name, args: argsText() })) as CallResult
      setResult(res)
      setCalls((n) => n + 1)
      showToast(res.ok && !res.isError ? `${tool.name} ok` : `${tool.name} failed`, res.ok && !res.isError ? 'ok' : 'bad')
    } catch (err) {
      setResult({ ok: false, isError: true, durationMs: 0, result: '', error: String(err) })
      showToast(`call failed: ${String(err)}`, 'bad')
    } finally {
      setCalling(false)
    }
  }

  const tools = createMemo(() => list()?.tools ?? [])
  const groups = createMemo(() => groupTools(tools(), appName()))
  const current = createMemo(() => tools().find((t) => t.name === selected()))
  const schemaProps = createMemo(() => propsOf(current()))
  const visible = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return groups()
    return groups()
      .map((g) => ({
        ...g,
        tools: g.tools.filter(
          (t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.tools.length > 0)
  })
  const shown = createMemo(() => visible().reduce((n, g) => n + g.tools.length, 0))
  const endpoint = () => list()?.endpoint ?? ''
  const configSnippet = (): string =>
    JSON.stringify(
      { mcpServers: { devtools: { type: 'http', url: endpoint() } } },
      null,
      2,
    )

  async function copy(text: string, label: string): Promise<void> {
    const ok = await copyText(text)
    showToast(ok ? `${label} copied` : 'clipboard blocked — select and copy manually', ok ? 'ok' : 'warn')
  }

  const toggle = (key: string): void => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <PanelPage>
      <PanelHeader
        title="MCP"
        description="every tool this hub aggregates — app RPC, hub docks, and devframe services — on one endpoint"
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Reload tools"
      />

      <StatStrip items={[
        { value: tools().length, label: 'tools' },
        { value: groups().length, label: 'groups' },
        { value: list()?.ok ? 'ready' : 'down', label: 'endpoint', tone: list()?.ok ? 'text-ok-ink' : 'text-bad-ink' },
        { value: calls(), label: 'calls this session' },
      ]} />

      <div class="flex flex-col gap-1.5 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
        <div class={row}>
          <span class={sectionLabel}>endpoint</span>
          <span class={tonePill(access.readOnly() ? 'warn' : 'ok')}>{access.role()}</span>
          <button class={`${btn} ml-auto`} disabled={!endpoint()} onClick={() => void copy(endpoint(), 'endpoint')}>
            Copy URL
          </button>
          <button class={btn} disabled={!endpoint()} onClick={() => void copy(configSnippet(), 'client config')}>
            Copy client config
          </button>
        </div>
        <span class={`${hint} break-all font-mono`}>{endpoint() || '—'}</span>
        <span class={hint}>
          {access.can('mcp:call')
            ? 'Point any MCP client at this URL; the playground below calls it the same way.'
            : 'Read-only session — you can browse tools, but tools/call is disabled.'}
        </span>
      </div>

      <div class={row}>
        <input
          class={`${field} max-w-xs flex-1`}
          type="search"
          placeholder="Filter tools by name or description…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <Show when={query().trim()}>
          <span class={hint}>{`${shown()} of ${tools().length} match`}</span>
          <button class={chip} onClick={() => setQuery('')}>clear</button>
        </Show>
        <span class={`${hint} ml-auto`}>{msg()}</span>
      </div>

      <Show when={!busy() && tools().length === 0}>
        <EmptyState title="No MCP tools" hint={list()?.error ?? 'The hub did not advertise any tools on this endpoint.'} />
      </Show>

      <Show when={tools().length > 0 && shown() === 0}>
        <EmptyState title="No match" hint={`Nothing matches “${query()}”.`} />
      </Show>

      <For each={visible()}>{(group) => (
        <section class="flex flex-col gap-2">
          <button
            class="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
            aria-expanded={!collapsed()[group.key]}
            onClick={() => toggle(group.key)}
          >
            <span class={`${hint} w-3`} aria-hidden>{collapsed()[group.key] ? '▸' : '▾'}</span>
            <span class={sectionLabel}>{group.label}</span>
            <span class={`${hint} rounded-full border border-solid border-line px-1.5`}>{group.tools.length}</span>
          </button>
          <Show when={!collapsed()[group.key]}>
            <div class={grid}>
              <For each={group.tools}>{(tool) => (
                <button class={`${tile} ${selected() === tool.name ? tileOn : ''}`} onClick={() => pick(tool)}>
                  <span class="truncate font-mono text-[12px] font-semibold text-ink" title={tool.name}>{tool.name}</span>
                  <span class="line-clamp-2 text-[11px] leading-snug text-ink-muted">{tool.description ?? 'no description'}</span>
                  <span class={hint}>{Object.keys(tool.inputSchema?.properties ?? {}).length} args
                    {tool.inputSchema?.required?.length ? ` · ${tool.inputSchema.required.length} required` : ''}</span>
                </button>
              )}</For>
            </div>
          </Show>
        </section>
      )}</For>

      <Show when={current()}>
        {(tool) => (
          <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-3">
            <div class={row}>
              <span class="font-mono text-[13px] font-semibold text-ink">{tool().name}</span>
              <span class={`${chip} cursor-default`}>tools/call</span>
              <button
                class={`${btnPrimary} ml-auto`}
                disabled={calling() || !access.can('mcp:call')}
                title={access.can('mcp:call') ? undefined : 'read-only session'}
                onClick={() => void call()}
              >
                {calling() ? 'calling…' : 'Call tool'}
              </button>
            </div>

            <Show when={schemaProps().length > 0} fallback={<span class={hint}>this tool takes no arguments</span>}>
              <div class={row}>
                <For each={schemaProps()}>{(entry) => {
                  const [key, prop] = entry
                  const required = tool().inputSchema?.required?.includes(key)
                  return (
                    <span class={`${chip} cursor-default font-mono`} title={prop.description ?? key}>
                      {key}{prop.type ? `: ${prop.type}` : ''}{required ? ' *' : ''}
                    </span>
                  )
                }}</For>
              </div>
            </Show>

            <label class="flex flex-col gap-1">
              <span class={sectionLabel}>arguments (JSON)</span>
              <textarea
                class={`${field} min-h-28 font-mono`}
                spellcheck={false}
                value={argsText()}
                onInput={(e) => setArgsText(e.currentTarget.value)}
              />
            </label>

            <Show when={result()}>
              {(r) => (
                <div class="flex flex-col gap-1.5">
                  <div class={row}>
                    <span class={tonePill(r().ok && !r().isError ? 'ok' : 'bad')}>
                      {r().ok ? (r().isError ? 'tool error' : 'ok') : 'failed'}
                    </span>
                    <span class={hint}>{fmtMs(r().durationMs)}</span>
                    <button class={`${btn} ml-auto`} onClick={() => void copy(r().error ?? r().result, 'result')}>
                      Copy result
                    </button>
                  </div>
                  <pre class="m-0 max-h-72 overflow-auto rounded-lg border border-solid border-line bg-surface-sunken p-2 font-mono text-[11px] leading-relaxed text-ink-muted">{r().error ?? r().result ?? '(empty result)'}</pre>
                  <Show when={!r().ok || r().isError}>
                    <SendToAgent
                      api={p.api}
                      page={`mcp:${tool().name}`}
                      selection={{ mode: 'page', cssPath: `mcp:${tool().name}` }}
                      placeholder={`e.g. fix ${tool().name} returning an error`}
                    />
                  </Show>
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
    </PanelPage>
  )
}
