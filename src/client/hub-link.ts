import { connectDevframe } from 'devframe/client'
import { hubBase } from './panel-catalog'

/** Hub RPC the dock rail listens on; switches the selected dock without a page reload. */
const ACTIVATE = 'hub:docks:activate'

/** Ask the hub to select a dock. Resolves `false` when this page is not framed by the hub. */
export async function activateDock(dockId: string): Promise<boolean> {
  try {
    const client = await connectDevframe()
    await client.call(ACTIVATE, { dockId })
    return true
  } catch {
    return false
  }
}

/** Select the dock when framed; otherwise swap this frame's own hash route. */
export async function openDock(dockId: string, hash: string): Promise<void> {
  if (await activateDock(dockId)) return
  location.hash = hash ? `#/${hash}` : '#/comments'
}

export interface HubIndex {
  base: string
  frames: { id: string; base: string; title: string }[]
}

export interface HubConnection {
  backend: string
  configs?: {
    ui?: { dockPreferences?: { defaultMode?: string; defaultPosition?: string } }
  }
}

/** Hub-level metadata lives beside the frame, not in the scoped RPC. */
export async function fetchHubJson<T>(file: '__index.json' | '__connection.json'): Promise<T | undefined> {
  try {
    const res = await fetch(`${hubBase()}${file}`, { headers: { accept: 'application/json' } })
    if (!res.ok) return undefined
    return (await res.json()) as T
  } catch {
    return undefined
  }
}
