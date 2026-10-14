import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { defineDevframe } from 'devframe'
import pkg from '../package.json'
import { CommentStore } from './comment-store'
import { createAgentRpc } from './rpc/agents'
import { createCaptureRpc } from './rpc/capture'
import { createCommentRpc } from './rpc/comments'
import { createIdeasRpc } from './rpc/ideas'
import { createSkillsRpc } from './rpc/skills'
import { getMeta, scanDir } from './rpc/meta'
import type { DriverPreference } from './agent-runner'

const clientAssets = resolve(import.meta.dirname, 'client')
const overlayScript = resolve(import.meta.dirname, 'overlay/index.mjs')

export interface UseDevfraAgentOptions {
  /** Which agent CLI to drive. `'auto'` picks the first installed of claude → codex → opencode. */
  driver?: DriverPreference
  /** Start the agent the moment a comment is submitted. Default true. */
  autoRun?: boolean
}

export interface DevframeOptions {
  /** Directories scanned by `list-skills` (each holds `<skill>/SKILL.md`). */
  skillsRoots?: string[]
  agent?: UseDevfraAgentOptions
  /** Inject the in-page comment overlay. Default true. */
  overlay?: boolean
}

export function defaultSkillRoots(): string[] {
  const home = homedir()
  return [
    join(home, 'AppData', 'Roaming', 'devin', 'skills'),
    join(home, '.claude', 'skills'),
    join(home, '.qoder', 'skills'),
    join(process.cwd(), 'skills'),
    join(process.cwd(), '.claude', 'skills'),
    join(process.cwd(), '.devin', 'skills'),
  ]
}

export function createDevframeDefinition(options: DevframeOptions = {}) {
  const preference: DriverPreference = options.agent?.driver ?? 'auto'
  const autoRun = options.agent?.autoRun !== false

  return defineDevframe({
    id: 'devfra-plugins',
    name: 'Comment',
    version: pkg.version,
    packageName: pkg.name,
    importMetaUrl: import.meta.url,
    homepage: pkg.homepage ?? 'https://devfra.me',
    description: 'In-page comments and ideas that drive agent CLIs',
    icon: 'ph:chat-circle',
    clientAssets,
    capabilities: { dev: true, build: true },
    dock:
      options.overlay === false
        ? undefined
        : {
            // No bottom-left dock button — the in-page bar and the hub frame
            // page are the UI; the entry stays registered so the page script
            // still runs.
            visibility: 'false',
            clientScript: { importFrom: overlayScript, eager: true },
          },
    async setup(ctx) {
      const us = ctx.scope('devfra-plugins')
      us.rpc.register(getMeta)
      us.rpc.register(scanDir)

      const storageDir = ctx.host.getStorageDir('project')
      const store = new CommentStore(storageDir)
      await store.load()
      const state = await us.rpc.sharedState('comments', { initialValue: { items: store.all() } })
      store.onSync((items) => state.mutate((draft) => void (draft.items = items)))

      const channel = us.rpc.streaming.create<string>('agent-logs', {
        replayWindow: 4096,
        closedStreamRetention: 5 * 60_000,
      })
      const agents = createAgentRpc({ store, channel, preference })
      const comments = createCommentRpc({
        store,
        onNew: (comment) => {
          if (autoRun && comment.kind === 'comment') void agents.run(comment.id)
        },
      })
      const skills = createSkillsRpc({ roots: options.skillsRoots ?? defaultSkillRoots() })
      const capture = createCaptureRpc({ storageDir })
      const ideas = createIdeasRpc({ preference })

      for (const fn of [
        comments.listComments,
        comments.submitComment,
        comments.updateComment,
        comments.deleteComment,
        agents.runAgentRpc,
        agents.cancelAgentRpc,
        agents.runnerInfo,
        skills.listSkills,
        capture.saveCapture,
        capture.listCaptures,
        ideas.generateIdeas,
      ]) {
        us.rpc.register(fn)
      }
    },
  })
}

export default createDevframeDefinition()
