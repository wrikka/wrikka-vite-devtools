import type { PanelApi } from './api'
import { globalFramework } from './frameworks'

export interface PageCommentInput {
  body: string
  /** Full page URL the comment anchors to (`pageUrl()`). */
  page: string
  /** Route used when the body has no @mention — normally the current path. */
  route: string
  kind?: 'comment' | 'idea'
}

/**
 * Shared `submit-comment` payload for the quick composer and the chat panel:
 * a page-scoped comment whose cssPath is the first @/route mention or the
 * current route.
 */
export async function submitPageComment(api: PanelApi, input: PageCommentInput): Promise<void> {
  const mentioned = /@(\/[^\s]*)/.exec(input.body)?.[1]
  await api.call('submit-comment', {
    body: input.body,
    page: input.page,
    kind: input.kind ?? 'comment',
    selection: {
      mode: 'page',
      framework: globalFramework(),
      cssPath: mentioned ?? input.route,
      textPreview: input.page,
    },
    skills: [],
  })
}
