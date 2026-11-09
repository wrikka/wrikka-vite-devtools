import { describe, expect, it } from 'bun:test'
import { bucketize, gaugeDash, ratio, sparkPoints } from '../src/ui/chart-math'

describe('ratio', () => {
  it('clamps to the 0..1 range', () => {
    expect(ratio(50, 100)).toBe(0.5)
    expect(ratio(250, 100)).toBe(1)
    expect(ratio(-5, 100)).toBe(0)
  })

  it('reads an unusable max as empty', () => {
    expect(ratio(10, 0)).toBe(0)
    expect(ratio(10, -1)).toBe(0)
    expect(ratio(Number.NaN, 100)).toBe(0)
  })
})

describe('sparkPoints', () => {
  it('draws nothing for an empty series', () => {
    expect(sparkPoints([], 100, 20)).toBe('')
  })

  it('maps the maximum to the top inset and the minimum to the bottom', () => {
    expect(sparkPoints([0, 10], 100, 20, 2)).toBe('2,18 98,2')
  })

  it('draws a flat series through the middle', () => {
    expect(sparkPoints([5, 5], 100, 20, 2)).toBe('2,10 98,10')
  })

  it('keeps a single sample visible as a level segment', () => {
    expect(sparkPoints([5], 100, 20, 2)).toBe('2,10 98,10')
  })
})

describe('gaugeDash', () => {
  it('fills a 270 degree arc by percentage', () => {
    const g = gaugeDash(50, 100, 10)
    expect(g.pct).toBe(0.5)
    expect(g.total).toBeCloseTo(2 * Math.PI * 10 * 0.75)
    expect(g.filled).toBeCloseTo(g.total / 2)
  })

  it('caps the fill at the full arc', () => {
    expect(gaugeDash(400, 100, 10).pct).toBe(1)
    expect(gaugeDash(400, 100, 10).filled).toBeCloseTo(gaugeDash(400, 100, 10).total)
  })
})

describe('bucketize', () => {
  it('counts values into edge buckets, open at both ends', () => {
    const buckets = bucketize([10, 150, 500, 5000], [100, 300, 1000])
    expect(buckets.map((b) => b.label)).toEqual(['<100', '100–300', '300–1000', '1000+'])
    expect(buckets.map((b) => b.count)).toEqual([1, 1, 1, 1])
  })

  it('puts an exact edge value in the upper bucket', () => {
    expect(bucketize([100, 300], [100, 300]).map((b) => b.count)).toEqual([0, 1, 1])
  })

  it('sorts edges and handles no edges', () => {
    expect(bucketize([50], [300, 100]).map((b) => b.label)).toEqual(['<100', '100–300', '300+'])
    expect(bucketize([1, 2], [])).toEqual([{ label: 'all', count: 2 }])
  })

  it('returns empty buckets for no samples', () => {
    expect(bucketize([], [10]).map((b) => b.count)).toEqual([0, 0])
  })
})
