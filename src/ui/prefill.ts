import type { Idea } from '../protocol'

/** Turns an accepted idea into the draft body the composer opens with. */
export function ideaPrefill(idea: Idea): string {
  return `Implement: ${idea.title} — ${idea.detail}`
}
