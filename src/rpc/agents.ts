import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import type { CommentStore } from '../comment-store'
import type { AgentDriver, DriverPreference } from '../agent-runner'
import { detectDrivers, lastSummary, pickDriver, runOnce } from '../agent-runner'
import { buildCommentPrompt } from '../prompts'

/** Structural slice of `us.rpc.streaming.create('agent-logs')`. */
export interface LogsStream {
  write(chunk: string): void
  close(): void
  error(err?: unknown): void
  signal: AbortSignal
}
export interface LogsChannel {
  start(opts?: { id?: string }): LogsStream
}

export interface AgentRpcDeps {
  store: CommentStore
  channel: LogsChannel
  preference: DriverPreference
}

export function createAgentRpc(deps: AgentRpcDeps) {
  const running = new Set<string>()
  const controllers = new Map<string, AbortController>()
  const resolveDriver = (): AgentDriver | undefined => pickDriver(deps.preference)

  function cancel(commentId: string): boolean {
    const controller = controllers.get(commentId)
    if (!controller) return false
    controller.abort()
    return true
  }

  async function run(commentId: string): Promise<{ started: boolean; streamId?: string; reason?: string }> {
    if (running.has(commentId)) {
      const existing = deps.store.get(commentId)
      return { started: false, streamId: existing?.streamId, reason: 'already running' }
    }
    const comment = deps.store.get(commentId)
    if (!comment) return { started: false, reason: 'comment not found' }
    const driver = resolveDriver()
    if (!driver) {
      deps.store.update(commentId, { status: 'failed', resultSummary: 'no agent CLI found (install claude, codex, or opencode)' })
      return { started: false, reason: 'no agent CLI found' }
    }

    const streamId = `comment-${commentId}-${Date.now()}`
    const controller = new AbortController()
    running.add(commentId)
    controllers.set(commentId, controller)
    deps.store.update(commentId, { status: 'running', streamId, resultSummary: undefined })
    const stream = deps.channel.start({ id: streamId })
    stream.signal.addEventListener('abort', () => controller.abort(), { once: true })
    stream.write(`[${driver}] working on comment ${commentId} in ${process.cwd()}\n`)

    void runOnce(driver, buildCommentPrompt(comment, { cwd: process.cwd(), driver }), {
      cwd: process.cwd(),
      onChunk: (text) => {
        try {
          stream.write(text)
        } catch {
          /* stream closed by consumers — keep running */
        }
      },
      signal: controller.signal,
      timeoutMs: 15 * 60_000,
    })
      .then((result) => {
        const cancelled = controller.signal.aborted
        stream.write(`\n[${driver}] exit ${result.exitCode ?? 'null'} ${cancelled ? 'CANCELLED' : result.ok ? 'ok' : 'FAILED'}\n`)
        stream.close()
        deps.store.update(commentId, {
          status: cancelled ? 'failed' : result.ok ? 'done' : 'failed',
          resultSummary: cancelled
            ? 'cancelled by user'
            : (result.ok ? lastSummary(result.output) : result.error ?? lastSummary(result.output)).slice(0, 1000),
        })
      })
      .catch((err: unknown) => {
        stream.error(err)
        deps.store.update(commentId, { status: 'failed', resultSummary: String(err).slice(0, 500) })
      })
      .finally(() => {
        running.delete(commentId)
        controllers.delete(commentId)
      })

    return { started: true, streamId }
  }

  const runAgentRpc = defineRpcFunction({
    name: 'run-agent',
    type: 'action',
    jsonSerializable: true,
    agent: { description: 'Start (or report on) an agent-CLI run for a queued comment; logs stream on channel agent-logs' },
    args: [z.object({ commentId: z.string() })],
    returns: z.object({ started: z.boolean(), streamId: z.string().optional(), reason: z.string().optional() }),
    handler: async ({ commentId }) => run(commentId),
  })

  const cancelAgentRpc = defineRpcFunction({
    name: 'cancel-agent',
    type: 'action',
    jsonSerializable: true,
    agent: { description: 'Abort the running agent CLI for a comment; marks it failed (cancelled by user)' },
    args: [z.object({ commentId: z.string() })],
    returns: z.object({ cancelled: z.boolean() }),
    handler: async ({ commentId }) => ({ cancelled: cancel(commentId) }),
  })

  const runnerInfo = defineRpcFunction({
    name: 'runner-info',
    type: 'static',
    jsonSerializable: true,
    args: [],
    agent: { description: 'Which agent CLI driver is active and which CLIs are installed' },
    returns: z.object({ preference: z.string(), driver: z.string().nullable(), available: z.array(z.string()) }),
    handler: async () => ({
      preference: deps.preference,
      driver: resolveDriver() ?? null,
      available: detectDrivers(),
    }),
  })

  return { runAgentRpc, cancelAgentRpc, runnerInfo, run, cancel }
}
