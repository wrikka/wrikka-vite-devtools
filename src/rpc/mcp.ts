import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { devServerOrigin, projectContext } from './context'
import { assertCan } from './access'

const REQUEST_TIMEOUT_MS = 20_000
const MAX_RESULT_CHARS = 40_000

export interface McpTool {
  name: string
  description?: string
  inputSchema?: unknown
}

interface JsonRpcResponse {
  jsonrpc?: string
  id?: number | string
  result?: { tools?: McpTool[]; content?: unknown; isError?: boolean; [key: string]: unknown }
  error?: { code?: number; message?: string }
}

/** `<origin><base>__mcp` for the running dev server. */
function hubEndpoint(): string | undefined {
  return devServerOrigin(`${projectContext.base ?? '/__devtools/'}__mcp`)
}

interface McpPayload {
  endpoint: string
  sessionId?: string
  body: JsonRpcResponse
  raw: string
}

let cachedSession: { endpoint: string; id: string } | undefined
let nextId = 1

/** Streamable HTTP may answer with `text/event-stream`; keep the last data frame. */
function parseBody(body: string, contentType: string): JsonRpcResponse {
  if (!contentType.includes('text/event-stream')) {
    return JSON.parse(body) as JsonRpcResponse
  }
  const frames = body
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line.startsWith('{'))
  const last = frames.at(-1)
  if (!last) throw new Error('MCP returned an empty event stream')
  return JSON.parse(last) as JsonRpcResponse
}

async function post(endpoint: string, payload: unknown): Promise<McpPayload> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    // The hub's MCP guard 403s a request with no Origin; the dev server's own
    // loopback origin is what a browser tab would send.
    origin: new URL(endpoint).origin,
  }
  if (cachedSession?.endpoint === endpoint) headers['mcp-session-id'] = cachedSession.id
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const sessionId = res.headers.get('mcp-session-id') ?? undefined
  if (sessionId) cachedSession = { endpoint, id: sessionId }
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  // Notifications answer 202 with no body; there is nothing to parse.
  if (!text.trim()) {
    return { endpoint, sessionId, body: {}, raw: '' }
  }
  return {
    endpoint,
    sessionId,
    body: parseBody(text, res.headers.get('content-type') ?? ''),
    raw: text,
  }
}

async function openSession(endpoint: string): Promise<void> {
  await post(endpoint, {
    jsonrpc: '2.0',
    id: nextId++,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'wrikka-vite-devtools-mcp-playground', version: '1.0.0' },
    },
  })
  await post(endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' })
}

export function createMcpRpc() {
  const listTools = defineRpcFunction({
    name: 'list-mcp-tools',
    type: 'query',
    jsonSerializable: true,
    args: [],
    agent: { description: 'List the aggregated MCP tools this devtools hub exposes (name, description, input schema)' },
    returns: z.object({
      ok: z.boolean(),
      endpoint: z.string(),
      error: z.string().optional(),
      tools: z.array(
        z.object({ name: z.string(), description: z.string().optional(), inputSchema: z.unknown().optional() }),
      ),
    }),
    handler: async () => {
      const endpoint = hubEndpoint()
      if (!endpoint) return { ok: false, endpoint: '', error: 'Vite dev server is not running', tools: [] }
      try {
        await openSession(endpoint)
        const { body } = await post(endpoint, { jsonrpc: '2.0', id: nextId++, method: 'tools/list', params: {} })
        if (body.error) return { ok: false, endpoint, error: body.error.message ?? 'tools/list failed', tools: [] }
        const tools = (body.result?.tools ?? []).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }))
        return { ok: true, endpoint, tools }
      } catch (err) {
        cachedSession = undefined
        return { ok: false, endpoint, error: err instanceof Error ? err.message : String(err), tools: [] }
      }
    },
  })

  const callTool = defineRpcFunction({
    name: 'call-mcp-tool',
    type: 'action',
    jsonSerializable: true,
    args: [z.object({ name: z.string().min(1).max(200), args: z.string().max(100_000).default('{}') })],
    agent: {
      description:
        'Invoke an aggregated MCP tool through the local hub endpoint; `args` is a JSON object string. Returns the raw JSON result (truncated).',
    },
    returns: z.object({
      ok: z.boolean(),
      isError: z.boolean(),
      durationMs: z.number(),
      result: z.string(),
      error: z.string().optional(),
    }),
    handler: async ({ name, args }) => {
      assertCan('mcp:call')
      const startedAt = Date.now()
      const endpoint = hubEndpoint()
      if (!endpoint) {
        return { ok: false, isError: true, durationMs: 0, result: '', error: 'Vite dev server is not running' }
      }
      const raw = args?.trim() ?? ''
      let parsed: unknown
      try {
        parsed = raw ? JSON.parse(raw) : {}
      } catch (err) {
        return {
          ok: false,
          isError: true,
          durationMs: Date.now() - startedAt,
          result: '',
          error: `arguments are not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
      try {
        if (!cachedSession || cachedSession.endpoint !== endpoint) await openSession(endpoint)
        const { body } = await post(endpoint, {
          jsonrpc: '2.0',
          id: nextId++,
          method: 'tools/call',
          params: { name, arguments: parsed },
        })
        const durationMs = Date.now() - startedAt
        if (body.error) {
          return { ok: false, isError: true, durationMs, result: '', error: body.error.message ?? 'tool call failed' }
        }
        const text = JSON.stringify(body.result ?? null, null, 2)
        return {
          ok: true,
          isError: body.result?.isError === true,
          durationMs,
          result: text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n… truncated` : text,
        }
      } catch (err) {
        cachedSession = undefined
        return {
          ok: false,
          isError: true,
          durationMs: Date.now() - startedAt,
          result: '',
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  })

  return { listTools, callTool }
}
