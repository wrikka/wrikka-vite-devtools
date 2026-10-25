import { createSignal, onCleanup, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'

export type RuntimeKind = 'network' | 'console' | 'vital' | 'state'

export interface RuntimeEvent {
  id: number
  kind: RuntimeKind
  at: number
  data: Record<string, unknown>
}

export interface RuntimeKindStats {
  total: number
  kept: number
  dropped: number
}

export interface RuntimeSnapshot {
  kinds: Record<string, RuntimeKindStats>
  events: RuntimeEvent[]
}

export function str(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

export function num(data: Record<string, unknown>, key: string): number {
  const value = data[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function bool(data: Record<string, unknown>, key: string): boolean {
  return data[key] === true
}

/**
 * Reads the overlay's ring buffers on an interval. Pass `kind` to narrow the query; omit it to
 * merge every kind (Performance needs vitals and slow requests in one pass).
 */
export function createRuntimeFeed(
  api: PanelApi,
  kind?: RuntimeKind,
  limit = 500,
  pollMs = 2000,
) {
  const [events, setEvents] = createSignal<RuntimeEvent[]>([])
  const [kinds, setKinds] = createSignal<Record<string, RuntimeKindStats>>({})
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('waiting for the page to report…')

  async function reload(silent = false): Promise<void> {
    if (!silent) setBusy(true)
    try {
      const res = (await api.call('get-runtime', { ...(kind ? { kind } : {}), limit })) as RuntimeSnapshot
      setEvents(res.events)
      setKinds(res.kinds)
      const dropped = Object.values(res.kinds).reduce((sum, k) => sum + k.dropped, 0)
      setMsg(
        `${res.events.length} events in view · ${dropped} dropped by ring limits · refreshes every ${pollMs / 1000}s`,
      )
    } catch (err) {
      setMsg(`read failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function clear(): Promise<void> {
    try {
      await api.call('clear-runtime', kind ? { kind } : {})
    } catch {
      // clearing is best-effort; the next reload shows the truth
    }
    await reload(true)
  }

  onMount(() => {
    void reload()
    const timer = setInterval(() => void reload(true), pollMs)
    onCleanup(() => clearInterval(timer))
  })

  return { events, kinds, busy, msg, reload, clear }
}

/** Nearest-rank percentile of a duration list; 0 when empty. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}
