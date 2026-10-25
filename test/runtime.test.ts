import { beforeEach, describe, expect, it } from 'bun:test'
import { bool, num, percentile, str } from '../src/client/runtimeFeed'
import { clearEvents, pushEvents, readEvents } from '../src/rpc/runtime'

function batch(count: number, startAt = 1) {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'network' as const,
    at: startAt + i,
    data: { url: `/api/${i}` },
  }))
}

beforeEach(() => {
  clearEvents()
})

describe('pushEvents', () => {
  it('accepts every event when the ring is not full', () => {
    expect(pushEvents(batch(10))).toEqual({ accepted: 10, dropped: 0 })
    expect(readEvents('network')).toHaveLength(10)
  })

  it('drops the oldest events past the per-kind cap', () => {
    expect(pushEvents(batch(305))).toEqual({ accepted: 305, dropped: 5 })
    const kept = readEvents('network')
    expect(kept).toHaveLength(300)
    expect(kept[0]?.at).toBe(305)
    expect(kept.at(-1)?.at).toBe(6)
  })

  it('keeps each kind in its own ring', () => {
    pushEvents(batch(3))
    pushEvents([{ kind: 'vital', at: 9, data: { name: 'LCP', value: 1200 } }])
    expect(readEvents('network')).toHaveLength(3)
    expect(readEvents('vital')).toHaveLength(1)
    expect(readEvents()).toHaveLength(4)
  })
})

describe('readEvents', () => {
  it('merges kinds newest first and honours since', () => {
    pushEvents(batch(3, 10))
    pushEvents([{ kind: 'console', at: 12, data: { level: 'warn' } }])
    const merged = readEvents(undefined, 10)
    expect(merged.map((e) => e.at)).toEqual([12, 12, 11])
    expect(merged.every((e) => e.at > 10)).toBe(true)
  })

  it('clamps the limit to the supported window', () => {
    pushEvents(batch(5))
    expect(readEvents('network', undefined, 0)).toHaveLength(1)
    expect(readEvents('network', undefined, 10_000)).toHaveLength(5)
  })
})

describe('clearEvents', () => {
  it('reports how many events it removed and empties the ring', () => {
    pushEvents(batch(4))
    pushEvents([{ kind: 'state', at: 99, data: { route: '/x' } }])
    expect(clearEvents()).toBe(5)
    expect(readEvents()).toHaveLength(0)
  })

  it('clears a single kind when asked', () => {
    pushEvents(batch(4))
    pushEvents([{ kind: 'state', at: 99, data: { route: '/x' } }])
    expect(clearEvents('network')).toBe(4)
    expect(readEvents('network')).toHaveLength(0)
    expect(readEvents('state')).toHaveLength(1)
  })
})

describe('runtime event field readers', () => {
  it('reads only the expected primitive type', () => {
    const data = { url: '/api', ms: 12.5, ok: true, bad: Number.NaN }
    expect(str(data, 'url')).toBe('/api')
    expect(str(data, 'ms')).toBe('')
    expect(num(data, 'ms')).toBe(12.5)
    expect(num(data, 'bad')).toBe(0)
    expect(bool(data, 'ok')).toBe(true)
    expect(bool(data, 'url')).toBe(false)
  })
})

describe('percentile', () => {
  it('returns 0 for an empty list', () => {
    expect(percentile([], 95)).toBe(0)
  })

  it('uses nearest-rank on a sorted copy', () => {
    const values = [500, 100, 300, 200, 400]
    expect(percentile(values, 50)).toBe(300)
    expect(percentile(values, 95)).toBe(500)
    expect(percentile(values, 0)).toBe(100)
    expect(values).toEqual([500, 100, 300, 200, 400])
  })
})
