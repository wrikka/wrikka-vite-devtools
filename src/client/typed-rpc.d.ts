import type { RpcDefinitionsToFunctionsWithNamespace } from 'devframe/types'
import type { getMeta, scanDir } from '../rpc'
import type { createCommentRpc } from '../rpc/comments'
import type { createAgentRpc } from '../rpc/agents'
import type { createSkillsRpc } from '../rpc/skills'
import type { createCaptureRpc } from '../rpc/capture'
import type { createIdeasRpc } from '../rpc/ideas'

type CommentDefs = ReturnType<typeof createCommentRpc>
type AgentDefs = ReturnType<typeof createAgentRpc>
type SkillDefs = ReturnType<typeof createSkillsRpc>
type CaptureDefs = ReturnType<typeof createCaptureRpc>
type IdeaDefs = ReturnType<typeof createIdeasRpc>

declare module 'devframe' {
  interface DevframeRpcClientFunctions
    extends RpcDefinitionsToFunctionsWithNamespace<
      'wrikka-vite-devtools',
      [
        typeof getMeta,
        typeof scanDir,
        CommentDefs['listComments'],
        CommentDefs['submitComment'],
        CommentDefs['updateComment'],
        CommentDefs['deleteComment'],
        AgentDefs['runAgentRpc'],
        AgentDefs['cancelAgentRpc'],
        AgentDefs['runnerInfo'],
        SkillDefs['listSkills'],
        CaptureDefs['saveCapture'],
        CaptureDefs['listCaptures'],
        IdeaDefs['generateIdeas'],
      ]
    > {}
}

export {}
