import { toPng } from 'html-to-image'

export type { PanelApi } from '../ui/api'
export type { Comment, Idea, Selection } from '../protocol'

export function pageUrl(): string {
  return window.location.href
}

export async function capturePage(): Promise<string> {
  return toPng(document.body, { backgroundColor: '#ffffff', cacheBust: true })
}
