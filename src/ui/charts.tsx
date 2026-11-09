import { For, Show } from 'solid-js'
import { barFill, barTrack, hint, metricRow, type Tone } from './bits'
import { gaugeDash, ratio, sparkPoints } from './chart-math'

const toneStroke: Record<Tone, string> = {
  accent: 'text-accent',
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  info: 'text-info-ink',
  bad: 'text-bad-ink',
}

const toneBg: Record<Tone, string> = {
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  info: 'bg-info',
  bad: 'bg-bad',
}

export interface SparklineProps {
  values: number[]
  tone?: Tone
  width?: number
  height?: number
  label?: string
  class?: string
}

/** Polyline sparkline — no axes, no runtime, just the shape of the series. */
export function Sparkline(p: SparklineProps) {
  return (
    <svg
      width={p.width ?? 120}
      height={p.height ?? 24}
      viewBox={`0 0 ${p.width ?? 120} ${p.height ?? 24}`}
      class={`overflow-visible ${toneStroke[p.tone ?? 'accent']} ${p.class ?? ''}`}
      role={p.label ? 'img' : undefined}
      aria-hidden={p.label ? undefined : true}
      aria-label={p.label}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        points={sparkPoints(p.values, p.width ?? 120, p.height ?? 24)}
      />
    </svg>
  )
}

export interface GaugeProps {
  value: number
  max?: number
  label: string
  tone?: Tone
  size?: number
  /** Formats the value and max in the caption, e.g. milliseconds as `1.2 s`. */
  format?(value: number): string
}

/** 270° arc gauge with the percentage in the middle. */
export function Gauge(p: GaugeProps) {
  const size = () => p.size ?? 76
  const center = () => size() / 2
  const radius = () => size() * 0.36
  const stroke = () => Math.max(4, size() * 0.09)
  const dash = () => gaugeDash(p.value, p.max ?? 100, radius())
  const display = () => `${Math.round(dash().pct * 100)}%`
  const rotation = () => `rotate(135 ${center()} ${center()})`
  return (
    <div class="flex items-center gap-2">
      <svg
        width={size()}
        height={size()}
        viewBox={`0 0 ${size()} ${size()}`}
        class={toneStroke[p.tone ?? 'accent']}
        role="img"
        aria-label={`${p.label} ${display()}`}
      >
        <circle
          cx={center()}
          cy={center()}
          r={radius()}
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.15"
          stroke-width={stroke()}
          stroke-dasharray={`${dash().total} ${dash().total * 4}`}
          stroke-linecap="round"
          transform={rotation()}
        />
        <circle
          cx={center()}
          cy={center()}
          r={radius()}
          fill="none"
          stroke="currentColor"
          stroke-width={stroke()}
          stroke-dasharray={`${dash().filled} ${dash().total * 4}`}
          stroke-linecap="round"
          transform={rotation()}
        />
        <text
          x={center()}
          y={center()}
          text-anchor="middle"
          dominant-baseline="central"
          font-size={`${size() * 0.2}`}
          font-weight="600"
          fill="currentColor"
          class="text-ink"
        >
          {display()}
        </text>
      </svg>
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-[12px] text-ink">{p.label}</span>
        <span class={`${hint} tabular-nums`}>
          {p.format ? p.format(p.value) : p.value}
          {p.max === undefined ? '' : ` / ${p.format ? p.format(p.max) : p.max}`}
        </span>
      </span>
    </div>
  )
}

export interface BarItem {
  label: string
  value: number
  tone?: Tone
  /** Tooltip when the label is truncated. */
  hint?: string
}

export interface BarListProps {
  items: BarItem[]
  /** Shared scale; defaults to the largest item so the top bar is always full. */
  max?: number
  format?(value: number): string
  emptyLabel?: string
}

/** Ranked horizontal bars — the compact alternative to a pie or a table. */
export function BarList(p: BarListProps) {
  const listMax = () => Math.max(1, ...p.items.map((i) => i.value))
  return (
    <Show when={p.items.length > 0} fallback={<p class={`${hint} m-0`}>{p.emptyLabel ?? 'No data yet.'}</p>}>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <For each={p.items}>
          {(item) => (
            <li class="flex flex-col gap-1">
              <span class={metricRow}>
                <span class="truncate text-ink-muted" title={item.hint ?? item.label}>
                  {item.label}
                </span>
                <span class="tabular-nums text-ink">
                  {p.format ? p.format(item.value) : item.value}
                </span>
              </span>
              <span class={barTrack}>
                <span
                  class={`${barFill} ${toneBg[item.tone ?? 'accent']}`}
                  style={{ width: `${ratio(item.value, p.max ?? listMax()) * 100}%` }}
                />
              </span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  )
}
