/** Types and pure helpers for the MCP playground — no Solid, no RPC. */

export interface PropSchema {
  type?: string
  description?: string
  enum?: unknown[]
}

export interface ToolSchema {
  properties?: Record<string, PropSchema>
  required?: string[]
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: ToolSchema
}

export interface CallResult {
  ok: boolean
  isError: boolean
  durationMs: number
  result: string
  error?: string
}

export interface Group {
  key: string
  label: string
  ico: string
  tools: McpTool[]
}

export function propsOf(tool: McpTool | undefined): [string, PropSchema][] {
  if (!tool) return []
  return Object.entries(tool.inputSchema?.properties ?? {})
}

/** Prefill only what the schema marks required, so a call fails loudly instead of silently. */
export function defaultArgs(tool: McpTool | undefined): string {
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
export function groupTools(tools: McpTool[], appName: string): Group[] {
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
