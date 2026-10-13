import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import type { AgentDriver, DriverPreference } from '../agent-runner'
import { pickDriver, runOnce } from '../agent-runner'
import { buildIdeasPrompt, parseIdeas } from '../prompts'
import { IdeaSchema } from '../protocol'

export interface IdeasRpcDeps {
  preference: DriverPreference
}

export function createIdeasRpc(deps: IdeasRpcDeps) {
  const generateIdeas = defineRpcFunction({
    name: 'generate-ideas',
    type: 'action',
    jsonSerializable: true,
    agent: {
      description:
        'Ask an agent CLI to propose feature ideas for this project (page context + optional focus). Returns parsed ideas; can take a minute or more.',
    },
    args: [z.object({ page: z.string().max(500), focus: z.string().max(2000).optional() })],
    returns: z.object({ ideas: z.array(IdeaSchema), driver: z.string().nullable(), raw: z.string().optional() }),
    handler: async ({ page, focus }) => {
      const driver: AgentDriver | undefined = pickDriver(deps.preference)
      if (!driver) return { ideas: [], driver: null, raw: 'no agent CLI found (install claude, codex, or opencode)' }
      const result = await runOnce(driver, buildIdeasPrompt({ cwd: process.cwd(), driver }, page, focus), {
        cwd: process.cwd(),
        timeoutMs: 5 * 60_000,
      })
      const ideas = parseIdeas(result.output)
      return { ideas, driver, raw: ideas.length > 0 || result.ok ? undefined : result.output.slice(0, 2000) }
    },
  })
  return { generateIdeas }
}
