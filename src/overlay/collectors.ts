import type { PanelApi } from '../ui/api'

type RuntimeKind = 'network' | 'console' | 'vital' | 'state'

interface QueuedEvent {
  kind: RuntimeKind
  at: number
  data: Record<string, unknown>
}

const FLUSH_MS = 500
const MAX_BATCH = 40
const SNAPSHOT_MS = 5_000
const MAX_TEXT = 2_048
const SLOW_MS = 300

let started = false
const queue: QueuedEvent[] = []

function enqueue(kind: RuntimeKind, data: Record<string, unknown>): void {
  if (queue.length >= 400) queue.shift()
  queue.push({ kind, at: Date.now(), data })
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return clip(value)
  if (value instanceof Error) return clip(`${value.name}: ${value.message}`)
  try {
    const seen = new WeakSet<object>()
    return clip(
      JSON.stringify(value, (_key, inner) => {
        if (typeof inner === 'bigint') return `${inner}n`
        if (typeof inner === 'function') return '[fn]'
        if (inner && typeof inner === 'object') {
          if (seen.has(inner)) return '[circular]'
          seen.add(inner)
        }
        return inner
      }) ?? String(value),
    )
  } catch {
    return '[unserializable]'
  }
}

function flush(api: PanelApi): void {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)
  api.call('push-runtime-event', { events: batch }).catch(() => {})
}

function captureFetch(): void {
  const original = window.fetch
  if (typeof original !== 'function') return
  window.fetch = (function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const startedAt = performance.now()
    const request = input instanceof Request ? input : undefined
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const promise = original.call(window, input, init)
    promise.then(
      (res) => {
        const durationMs = Math.round(performance.now() - startedAt)
        const length = Number(res.headers.get('content-length') ?? 0)
        enqueue('network', {
          transport: 'fetch',
          method,
          url,
          status: res.status,
          ok: res.ok,
          durationMs,
          slow: durationMs >= SLOW_MS,
          bytes: Number.isFinite(length) ? length : 0,
          contentType: res.headers.get('content-type') ?? '',
        })
      },
      (err) => {
        enqueue('network', {
          transport: 'fetch',
          method,
          url,
          status: 0,
          ok: false,
          durationMs: Math.round(performance.now() - startedAt),
          slow: false,
          bytes: 0,
          error: err instanceof Error ? err.message : String(err),
        })
      },
    )
    return promise
  }) as typeof fetch
}

function captureXhr(): void {
  const proto = XMLHttpRequest.prototype
  const open = proto.open
  const send = proto.send
  proto.open = function patchedOpen(
    this: XMLHttpRequest & { __method?: string; __url?: string; __startedAt?: number },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__method = method.toUpperCase()
    this.__url = String(url)
    return (open as (...args: unknown[]) => void).apply(this, [method, url, ...rest])
  }
  proto.send = function patchedSend(
    this: XMLHttpRequest & { __method?: string; __url?: string; __startedAt?: number },
    ...args: unknown[]
  ) {
    this.__startedAt = performance.now()
    const finish = (): void => {
      const durationMs = Math.round(performance.now() - (this.__startedAt ?? performance.now()))
      enqueue('network', {
        transport: 'xhr',
        method: this.__method ?? 'GET',
        url: this.__url ?? '',
        status: this.status,
        ok: this.status >= 200 && this.status < 400,
        durationMs,
        slow: durationMs >= SLOW_MS,
        bytes: Number(this.getResponseHeader('content-length') ?? 0) || 0,
      })
    }
    this.addEventListener('loadend', finish, { once: true })
    return (send as (...a: unknown[]) => void).apply(this, args)
  }
}

function captureConsole(): void {
  const levels = ['error', 'warn', 'log', 'info', 'debug'] as const
  for (const level of levels) {
    const original = console[level]
    if (typeof original !== 'function') continue
    console[level] = (...args: unknown[]) => {
      try {
        enqueue('console', {
          level,
          message: args.map(safeString).join(' '),
          stack: level === 'error' ? (args.find((a) => a instanceof Error) as Error | undefined)?.stack : undefined,
        })
      } catch {
        // never let collection break the host call
      }
      return original.apply(console, args)
    }
  }
}

function captureVitals(): void {
  if (typeof PerformanceObserver !== 'function') return
  const observe = (type: string, handler: (entry: PerformanceEntry) => void): void => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) handler(entry)
      })
      observer.observe({ type, buffered: true } as PerformanceObserverInit)
    } catch {
      // type unsupported in this browser
    }
  }

  observe('paint', (entry) => enqueue('vital', { metric: entry.name, value: Math.round(entry.startTime) }))
  observe('largest-contentful-paint', (entry) =>
    enqueue('vital', { metric: 'lcp', value: Math.round(entry.startTime) }),
  )
  observe('layout-shift', (entry) => {
    const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
    if (!shift.hadRecentInput) enqueue('vital', { metric: 'cls', value: Number(shift.value.toFixed(4)) })
  })

  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (nav) {
    for (const [metric, value] of [
      ['ttfb', nav.responseStart - nav.requestStart],
      ['domContentLoaded', nav.domContentLoadedEventEnd - nav.startTime],
      ['load', nav.loadEventEnd - nav.startTime],
    ] as const) {
      if (value > 0) enqueue('vital', { metric, value: Math.round(value) })
    }
  }
}

function storageSummary(area: Storage): { key: string; type: string; length: number }[] {
  const out: { key: string; type: string; length: number }[] = []
  try {
    for (let i = 0; i < area.length && out.length < 200; i++) {
      const key = area.key(i)
      if (key === null) continue
      const value = area.getItem(key) ?? ''
      out.push({ key, type: value.startsWith('{') || value.startsWith('[') ? 'json' : 'text', length: value.length })
    }
  } catch {
    // storage can be blocked by the browser
  }
  return out
}

function snapshotState(reason: string): void {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  const custom = (window as Window & { __DEVTOOLS_STATE__?: unknown }).__DEVTOOLS_STATE__
  enqueue('state', {
    reason,
    route: `${location.pathname}${location.hash}`,
    domNodes: document.getElementsByTagName('*').length,
    localStorage: storageSummary(localStorage),
    sessionStorage: storageSummary(sessionStorage),
    heapKb: memory ? Math.round(memory.usedJSHeapSize / 1024) : undefined,
    custom: custom === undefined ? undefined : safeString(custom),
  })
}

/** Patch the page once and stream what it does into the devtools ring buffers. */
export function startCollectors(api: PanelApi): void {
  if (started) return
  started = true

  try {
    captureFetch()
    captureXhr()
    captureConsole()
    captureVitals()
    snapshotState('initial')
    window.addEventListener('storage', () => snapshotState('storage'))
    setInterval(() => snapshotState('interval'), SNAPSHOT_MS)
    setInterval(() => flush(api), FLUSH_MS)
    window.addEventListener('pagehide', () => flush(api))
  } catch {
    // the overlay must never take the host app down with it
  }
}
