import { toPng } from 'html-to-image'

export type { PanelApi } from '../ui/api'
export type { Comment, Idea, Selection } from '../protocol'

/** One `search-source` hit — mirrors the RPC zod return shape without pulling zod into the bundle. */
export interface SearchMatch {
  file: string
  line: number
  snippet: string
}

export function pageUrl(): string {
  return window.location.href
}

export async function capturePage(): Promise<string> {
  return toPng(document.body, { backgroundColor: '#ffffff', cacheBust: true })
}
