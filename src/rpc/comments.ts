import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import type { CommentStore } from '../comment-store'
import type { Comment } from '../protocol'
import { CommentSchema, SelectionSchema } from '../protocol'

export interface SubmitCommentInput {
  body: string
  page: string
  kind?: 'comment' | 'idea'
  selection: z.infer<typeof SelectionSchema>
  skills?: string[]
  capturePath?: string
}

const SubmitSchema = z.object({
  body: z.string().min(1).max(8000),
  page: z.string().min(1).max(500),
  kind: z.enum(['comment', 'idea']).optional(),
  selection: SelectionSchema,
  skills: z.array(z.string().max(120)).max(20).optional(),
  capturePath: z.string().max(1000).optional(),
})

export interface CommentRpcDeps {
  store: CommentStore
  onNew?: (comment: Comment) => void
}

export function createCommentRpc(deps: CommentRpcDeps) {
  const listComments = defineRpcFunction({
    name: 'list-comments',
    type: 'query',
    jsonSerializable: true,
    args: [],
    agent: { description: 'List all overlay comments/ideas with their agent-run status' },
    returns: z.object({ items: z.array(CommentSchema) }),
    handler: async () => ({ items: deps.store.all() }),
  })

  const submitComment = defineRpcFunction({
    name: 'submit-comment',
    type: 'action',
    jsonSerializable: true,
    agent: {
      description:
        'Submit an in-page comment (selection may be an element, component, or the whole page). With autoRun enabled an agent CLI starts on it immediately.',
    },
    args: [SubmitSchema],
    returns: CommentSchema,
    handler: async (input) => {
      const comment: Comment = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        page: input.page,
        kind: input.kind ?? 'comment',
        status: 'queued',
        body: input.body,
        selection: input.selection,
        skills: input.skills ?? [],
        capturePath: input.capturePath,
      }
      deps.store.add(comment)
      deps.onNew?.(comment)
      return comment
    },
  })

  const updateComment = defineRpcFunction({
    name: 'update-comment',
    type: 'action',
    jsonSerializable: true,
    agent: { description: 'Patch a comment: set status (queued|running|done|failed) and/or resultSummary after working on it' },
    args: [
      z.object({
        id: z.string(),
        status: z.enum(['queued', 'running', 'done', 'failed']).optional(),
        resultSummary: z.string().max(1000).optional(),
      }),
    ],
    returns: z.object({ updated: z.boolean() }),
    handler: async ({ id, status, resultSummary }) => {
      const updated = deps.store.update(id, {
        ...(status ? { status } : {}),
        ...(resultSummary != null ? { resultSummary } : {}),
      })
      return { updated: Boolean(updated) }
    },
  })

  return { listComments, submitComment, updateComment }
}
