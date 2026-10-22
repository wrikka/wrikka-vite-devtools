import type { Comment, Idea } from './protocol'

export interface PromptContext {
  cwd: string
  driver: string
}

function selectionBlock(c: Comment): string {
  const s = c.selection
  const lines = [`- mode: ${s.mode}`]
  if (s.framework) lines.push(`- framework: ${s.framework}`)
  if (s.componentLabel) lines.push(`- component: ${s.componentLabel}`)
  if (s.tagName) lines.push(`- element: <${s.tagName}>`)
  if (s.cssPath) lines.push(`- css path: ${s.cssPath}`)
  if (s.textPreview) lines.push(`- visible text: ${JSON.stringify(s.textPreview)}`)
  if (s.attributes) lines.push(`- attributes: ${s.attributes}`)
  return lines.join('\n')
}

export function buildCommentPrompt(c: Comment, ctxInfo: PromptContext): string {
  const parts = [
    `You are working in the project at ${ctxInfo.cwd} (started by the wrikka-vite-devtools comment overlay, driver: ${ctxInfo.driver}).`,
    '',
    `## Request (page: ${c.page})`,
    c.body,
    '',
    '## Selection',
    selectionBlock(c),
  ]
  if (c.capturePath) parts.push('', '## Capture', `A PNG screenshot of the page is saved at ${c.capturePath} — open it for visual context.`)
  if (c.skills.length > 0) {
    parts.push('', '## Skills', 'Load and follow these skills before changing anything:')
    for (const skill of c.skills) parts.push(`- /${skill}`)
  }
  parts.push(
    '',
    '## Rules',
    '- Make the smallest change that satisfies the request; stay inside the selected component/page when possible.',
    '- Do not commit or push; leave the edits in the working tree.',
    '- After editing, run the project typecheck/lint if a script exists (`bun run typecheck`, `bun run lint`).',
    '- End your reply with exactly one line: `SUMMARY: <what you changed, max 120 chars>`.',
  )
  return parts.join('\n')
}

export function buildIdeasPrompt(ctxInfo: PromptContext, page: string, focus?: string): string {
  return [
    `You are a product ideation agent inspecting the project at ${ctxInfo.cwd} (driver: ${ctxInfo.driver}).`,
    `The user is viewing page: ${page}.`,
    focus ? `User focus: ${focus}` : '',
    '',
    'Propose 6 concrete feature ideas for this project. Base them on the real code you can read (routes, components, data model).',
    'Answer with ONLY a JSON array — no prose, no markdown fences — of objects shaped like:',
    '{"title": "...", "detail": "2-3 sentences of what to build and where", "impact": "High|Medium|Low"}',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

const IMPACTS = ['High', 'Medium', 'Low'] as const

export function parseIdeas(raw: string): Idea[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): Idea | null => {
        if (typeof item !== 'object' || item === null) return null
        const { title, detail, impact } = item as Record<string, unknown>
        if (typeof title !== 'string' || typeof detail !== 'string') return null
        const safeImpact = IMPACTS.includes(impact as (typeof IMPACTS)[number]) ? (impact as Idea['impact']) : 'Medium'
        return { title, detail, impact: safeImpact }
      })
      .filter((idea): idea is Idea => idea !== null)
  } catch {
    return []
  }
}
