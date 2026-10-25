import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { devServerOrigin } from './context'
import { assertLocalOrigin } from './seo'

const KINDS = ['network', 'console', 'vital', 'state'] as const
type RuntimeKind = (typeof KINDS)[number]

/** Events older than this memory budget are dropped even when the ring is not full. */
const RING_LIMITS: Record<RuntimeKind, number> = {
  network: 300,
  console: 500,
  vital: 200,
  state: 50,
}

const MAX_BATCH = 50
const REPLAY_TIMEOUT_MS = 8_000
const MAX_BODY_PREVIEW = 4_096

export interface RuntimeEvent {
  id: number
  kind: RuntimeKind
  at: number
  data: Record<string, unknown>
}

interface RingBuffer {
  events: RuntimeEvent[]
  total: number
  dropped: number
}

const buffers = new Map<RuntimeKind, RingBuffer>()
let nextId = 1

function bufferOf(kind: RuntimeKind): RingBuffer {
  let ring = buffers.get(kind)
  if (!ring) {
    ring = { events: [], total: 0, dropped: 0 }
    buffers.set(kind, ring)
  }
  return ring
}

/** Exported for unit tests: the ring cap and drop counter are the whole retention policy. */
export function pushEvents(
  incoming: { kind: RuntimeKind; at?: number; data: Record<string, unknown> }[],
): { accepted: number; dropped: number } {
  let accepted = 0
  let dropped = 0
  for (const event of incoming) {
    const ring = bufferOf(event.kind)
    ring.events.push({ id: nextId++, kind: event.kind, at: event.at ?? Date.now(), data: event.data })
    ring.total += 1
    accepted += 1
    while (ring.events.length > RING_LIMITS[event.kind]) {
      ring.events.shift()
      ring.dropped += 1
      dropped += 1
    }
  }
  return { accepted, dropped }
}

export function readEvents(kind?: RuntimeKind, since?: number, limit = 500): RuntimeEvent[] {
  const kinds = kind ? [kind] : [...KINDS]
  const merged: RuntimeEvent[] = []
  for (const k of kinds) {
    for (const event of bufferOf(k).events) {
      if (since !== undefined && event.at <= since) continue
      merged.push(event)
    }
  }
  merged.sort((a, b) => b.at - a.at || b.id - a.id)
  return merged.slice(0, Math.max(1, Math.min(limit, 2000)))
}

export function clearEvents(kind?: RuntimeKind): number {
  let cleared = 0
  for (const k of kind ? [kind] : [...KINDS]) {
    const ring = bufferOf(k)
    cleared += ring.events.length
    ring.events = []
  }
  return cleared
}

function localBase(): string {
  return devServerOrigin('/') ?? 'http://localhost:5173/'
}

export function createRuntimeRpc() {
  const pushRuntimeEvent = defineRpcFunction({
    name: 'push-runtime-event',
    type: 'action',
    jsonSerializable: true,
    args: [
      z.object({
        events: z
          .array(
            z.object({
              kind: z.enum(KINDS),
              at: z.number().optional(),
              data: z.record(z.string(), z.unknown()),
            }),
          )
          .max(MAX_BATCH),
      }),
    ],
    agent: {
      description:
        'Append a batch (max 50) of browser runtime events (network, console, vital, state) to the in-memory ring buffers shown in the Network/Performance/Console/State panels',
    },
    returns: z.object({ accepted: z.number(), dropped: z.number() }),
    handler: ({ events }) => pushEvents(events),
  })

  const getRuntime = defineRpcFunction({
    name: 'get-runtime',
    type: 'query',
    jsonSerializable: true,
    args: [
      z.object({
        kind: z.enum(KINDS).optional(),
        since: z.number().optional(),
        limit: z.number().optional(),
      }),
    ],
    agent: {
      description:
        'Read captured browser runtime events newest-first, optionally filtered by kind and by a `since` timestamp; includes per-kind totals and drop counts',
    },
    returns: z.object({
      kinds: z.record(
        z.string(),
        z.object({ total: z.number(), kept: z.number(), dropped: z.number() }),
      ),
      events: z.array(
        z.object({
          id: z.number(),
          kind: z.enum(KINDS),
          at: z.number(),
          data: z.record(z.string(), z.unknown()),
        }),
      ),
    }),
    handler: ({ kind, since, limit }) => {
      const kinds: Record<string, { total: number; kept: number; dropped: number }> = {}
      for (const k of KINDS) {
        const ring = bufferOf(k)
        kinds[k] = { total: ring.total, kept: ring.events.length, dropped: ring.dropped }
      }
      return { kinds, events: readEvents(kind, since, limit ?? 500) }
    },
  })

  const clearRuntime = defineRpcFunction({
    name: 'clear-runtime',
    type: 'action',
    jsonSerializable: true,
    args: [z.object({ kind: z.enum(KINDS).optional() })],
    agent: {
      description: 'Drop captured runtime events from the ring buffers (all kinds, or one kind)',
    },
    returns: z.object({ cleared: z.number() }),
    handler: ({ kind }) => ({ cleared: clearEvents(kind) }),
  })

  const replayRequest = defineRpcFunction({
    name: 'replay-request',
    type: 'action',
    jsonSerializable: true,
    args: [
      z.object({
        url: z.string(),
        method: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.string().optional(),
      }),
    ],
    agent: {
      description:
        'Replay an HTTP request against the local dev server (same-origin only) and return status, headers, and a truncated body preview',
    },
    returns: z.object({
      ok: z.boolean(),
      status: z.number(),
      durationMs: z.number(),
      headers: z.array(z.object({ name: z.string(), value: z.string() })),
      body: z.string(),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    handler: async ({ url, method, headers, body }) => {
      const startedAt = Date.now()
      const fail = (error: string, target = '') => ({
        ok: false,
        status: 0,
        durationMs: Date.now() - startedAt,
        headers: [],
        body: '',
        truncated: false,
        error: `${target}${target ? ': ' : ''}${error}`,
      })
      const raw = url.trim()
      let target: URL
      try {
        target = assertLocalOrigin(raw || localBase())
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err), raw)
      }
      try {
        const res = await fetch(target, {
          method: (method ?? 'GET').toUpperCase(),
          headers,
          body: body && method && method.toUpperCase() !== 'GET' ? body : undefined,
          redirect: 'follow',
          signal: AbortSignal.timeout(REPLAY_TIMEOUT_MS),
        })
        const seen: { name: string; value: string }[] = []
        res.headers.forEach((value, name) => void seen.push({ name, value }))
        seen.sort((a, b) => a.name.localeCompare(b.name))
        const text = await res.text()
        return {
          ok: res.ok,
          status: res.status,
          durationMs: Date.now() - startedAt,
          headers: seen,
          body: text.slice(0, MAX_BODY_PREVIEW),
          truncated: text.length > MAX_BODY_PREVIEW,
        }
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err), target.toString())
      }
    },
  })

  return { pushRuntimeEvent, getRuntime, clearRuntime, replayRequest }
}
