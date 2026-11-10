import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, chip, field, grid, hint, row, sectionLabel, tile, tileOn, tonePill } from '../ui/bits'
import { useAccess } from '../ui/access-store'
import { copyText, showToast } from '../ui/toast'
import { EmptyState, PanelHeader, PanelPage, PanelSection, StatStrip } from './PanelKit'
import McpCallCard from './McpCallCard'
import { defaultArgs, groupTools, type CallResult, type McpTool } from './mcp-utils'

interface ToolList {
  ok: boolean
  endpoint: string
  error?: string
  tools: McpTool[]
}

export interface McpAppProps {
  api: PanelApi
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

      <PanelSection
        label="endpoint"
        hint={access.can('mcp:call') ? 'any MCP client can call it the same way' : 'read-only session — tools/call is disabled'}
        actions={
          <>
            <span class={tonePill(access.readOnly() ? 'warn' : 'ok')}>{access.role()}</span>
            <button class={btn} disabled={!endpoint()} onClick={() => void copy(endpoint(), 'endpoint')}>
              Copy URL
            </button>
            <button class={btn} disabled={!endpoint()} onClick={() => void copy(configSnippet(), 'client config')}>
              Copy client config
            </button>
          </>
        }
      >
        <span class={`${hint} break-all font-mono`}>{endpoint() || '—'}</span>
      </PanelSection>

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
            class="-mx-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-1 py-0.5 text-left transition-colors hover:bg-control/60 focus-visible:bg-control focus-visible:outline-none"
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
          <McpCallCard
            api={p.api}
            tool={tool()}
            args={argsText()}
            onArgs={setArgsText}
            result={result()}
            calling={calling()}
            canCall={access.can('mcp:call')}
            onCall={() => void call()}
          />
        )}
      </Show>
    </PanelPage>
  )
}
