/**
 * Chart geometry shared by the panels. Pure number-in / string-or-number-out so
 * the shapes are testable without a DOM.
 */

/** Clamp a value into 0..1 of `max`; a non-positive max reads as empty. */
export function ratio(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value / max))
}

/**
 * SVG polyline points for a sparkline inside `width` x `height` with `pad`
 * inset. A flat series draws through the vertical middle; one sample keeps a
 * level segment so the line is visible.
 */
export function sparkPoints(values: number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return ''
  const innerW = Math.max(0, width - pad * 2)
  const innerH = Math.max(0, height - pad * 2)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const y = (v: number) => pad + innerH - (max === min ? innerH / 2 : ((v - min) / (max - min)) * innerH)
  if (values.length === 1) return `${pad},${y(values[0]!)} ${pad + innerW},${y(values[0]!)}`
  return values
    .map((v, i) => `${pad + (i / (values.length - 1)) * innerW},${y(v)}`)
    .join(' ')
}

/** Dash lengths for a 270° arc gauge, plus the 0..1 fill it represents. */
export function gaugeDash(
  value: number,
  max: number,
  radius: number,
): { filled: number; total: number; pct: number } {
  const pct = ratio(value, max)
  const total = 2 * Math.PI * radius * 0.75
  return { filled: total * pct, total, pct }
}

export interface Bucket {
  label: string
  /** Inclusive lower bound; `undefined` for the open first bucket. */
  from?: number
  /** Exclusive upper bound; `undefined` for the open last bucket. */
  to?: number
  count: number
}

/** Count values into `<edge0`, `edge0–edge1`, … `≥edgeLast` buckets. */
export function bucketize(values: number[], edges: number[]): Bucket[] {
  if (edges.length === 0) return [{ label: 'all', count: values.length }]
  const bounds = [...edges].sort((a, b) => a - b)
  const buckets: Bucket[] = []
  buckets.push({ label: `<${bounds[0]}`, to: bounds[0], count: 0 })
  for (let i = 1; i < bounds.length; i += 1)
    buckets.push({ label: `${bounds[i - 1]}–${bounds[i]}`, from: bounds[i - 1], to: bounds[i], count: 0 })
  buckets.push({ label: `${bounds[bounds.length - 1]}+`, from: bounds[bounds.length - 1], count: 0 })
  for (const value of values) {
    const index = buckets.findIndex((b) => b.to !== undefined && value < b.to)
    buckets[index === -1 ? buckets.length - 1 : index]!.count += 1
  }
  return buckets
}
