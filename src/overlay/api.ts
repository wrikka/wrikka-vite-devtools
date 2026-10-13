import { toPng } from 'html-to-image'

export interface Selection {
  mode: 'element' | 'component' | 'page'
  framework?: string
  componentLabel?: string
  tagName?: string
  cssPath?: string
  textPreview?: string
  attributes?: string
}

export interface Comment {
  id: string
  createdAt: string
  page: string
  kind: 'comment' | 'idea'
  status: 'queued' | 'running' | 'done' | 'failed'
  body: string
  selection: Selection
  skills: string[]
  capturePath?: string
  streamId?: string
  resultSummary?: string
}

export interface Idea {
  title: string
  detail: string
  impact: 'High' | 'Medium' | 'Low'
}

/** The scoped devframe RPC surface the overlay talks to. */
export interface OverlayApi {
  call(id: string, args?: unknown): Promise<any>
  subscribe(channel: string, id: string): AsyncIterable<string>
}

export function pageUrl(): string {
  return window.location.href
}

export async function capturePage(): Promise<string> {
  return toPng(document.body, { backgroundColor: '#ffffff', cacheBust: true })
}
