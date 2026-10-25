import { z } from 'zod'

export const SelectionSchema = z.object({
  mode: z.enum(['element', 'component', 'page']),
  framework: z.string().optional(),
  componentLabel: z.string().optional(),
  tagName: z.string().optional(),
  cssPath: z.string().optional(),
  textPreview: z.string().optional(),
  attributes: z.string().optional(),
})
export type Selection = z.infer<typeof SelectionSchema>

export const CommentStatusSchema = z.enum(['queued', 'running', 'done', 'failed'])
export const CommentKindSchema = z.enum(['comment', 'idea'])

/** A session's ability to mutate: operator runs agents and edits, viewer only reads. */
export const RoleSchema = z.enum(['operator', 'viewer'])
export type Role = z.infer<typeof RoleSchema>

export const CommentSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  page: z.string(),
  kind: CommentKindSchema,
  status: CommentStatusSchema,
  body: z.string(),
  selection: SelectionSchema,
  skills: z.array(z.string()),
  capturePath: z.string().optional(),
  streamId: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  resultSummary: z.string().optional(),
})
export type Comment = z.infer<typeof CommentSchema>

export const CommentsStateSchema = z.object({ items: z.array(CommentSchema) })
export type CommentsState = z.infer<typeof CommentsStateSchema>

export const IdeaSchema = z.object({
  title: z.string(),
  detail: z.string(),
  impact: z.enum(['High', 'Medium', 'Low']),
})
export type Idea = z.infer<typeof IdeaSchema>
