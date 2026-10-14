export interface Draft {
  body: string
  skills: string[]
}

const PREFIX = 'wrikka-vite-devtools:draft:'

/**
 * The composer lives in a dock iframe that remounts on every tab switch, so the
 * message would be lost. Drafts are kept per target page on the shared origin.
 */
export function stashDraft(page: string, draft: Draft): void {
  try {
    if (draft.body) localStorage.setItem(PREFIX + page, JSON.stringify(draft))
    else localStorage.removeItem(PREFIX + page)
  } catch {
    // storage can be blocked in embedded contexts; the draft is simply not kept
  }
}

export function readDraft(page: string): Draft | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + page)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<Draft>
    return { body: parsed.body ?? '', skills: Array.isArray(parsed.skills) ? parsed.skills : [] }
  } catch {
    return undefined
  }
}
