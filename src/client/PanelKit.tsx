import { For, Show, type JSX } from 'solid-js'
import {
  btn,
  empty,
  hint,
  page,
  pageHead,
  panelCard,
  sectionLabel,
  stat,
  statLabel,
  statRow,
  statValue,
  title,
} from '../ui/bits'
import { Sparkline } from '../ui/charts'

export interface PanelHeaderProps {
  title: string
  description?: string
  icon?: JSX.Element
  busy?: boolean
  refresh?: () => void
  refreshLabel?: string
  /** Right-aligned slot for panel-level controls, before the refresh button. */
  actions?: JSX.Element
  children?: JSX.Element
}

export function PanelHeader(p: PanelHeaderProps) {
  return (
    <div class={pageHead}>
      <span class="flex items-center gap-1.5">
        <Show when={p.icon}>
          <span class="text-ink-muted">{p.icon}</span>
        </Show>
        <h1 class={title}>{p.title}</h1>
      </span>
      <Show when={p.description}>
        <span class={`${hint} mr-auto`}>{p.description}</span>
      </Show>
      <Show when={p.actions}>
        <span class="ml-auto flex flex-wrap items-center gap-1.5">{p.actions}</span>
      </Show>
      {p.children}
      <Show when={p.refresh}>
        <button
          class={`${btn} ${p.description || p.actions ? '' : 'ml-auto'}`}
          disabled={p.busy}
          onClick={() => p.refresh?.()}
        >
          {p.busy ? 'working…' : (p.refreshLabel ?? 'Rescan')}
        </button>
      </Show>
    </div>
  )
}

export interface StatItem {
  value: string | number
  label: string
  /** Small supporting line, e.g. the worst offender. */
  hint?: string
  /** A `text-*` utility, e.g. `text-bad-ink`, for the number itself. */
  tone?: string
  /** Recent samples drawn as a sparkline under the number. */
  spark?: number[]
  /** Change vs the previous sample. */
  delta?: { value: string; tone?: 'ok' | 'bad' | 'muted' }
}

function deltaTone(tone: 'ok' | 'bad' | 'muted' = 'muted'): string {
  if (tone === 'ok') return 'text-ok-ink'
  if (tone === 'bad') return 'text-bad-ink'
  return 'text-ink-muted'
}

export function StatStrip(p: { items: StatItem[] }) {
  return (
    <div class={statRow}>
      <For each={p.items}>
        {(item) => (
          <div class={stat}>
            <span class="flex items-baseline justify-between gap-2">
              <span class={`${statValue} ${item.tone ?? ''}`}>{item.value}</span>
              <Show when={item.delta}>
                {(delta) => (
                  <span class={`text-[10px] font-semibold tabular-nums ${deltaTone(delta().tone)}`}>
                    {delta().value}
                  </span>
                )}
              </Show>
            </span>
            <span class={statLabel}>{item.label}</span>
            <Show when={item.hint}>
              <span class={`${hint} truncate`}>{item.hint}</span>
            </Show>
            <Show when={item.spark && item.spark.length > 1}>
              <Sparkline values={item.spark!} width={120} height={18} />
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}

export function EmptyState(p: {
  title: string
  hint?: string
  action?: { label: string; onClick(): void }
  children?: JSX.Element
}) {
  return (
    <div class={empty}>
      <p class="m-0 text-[13px] text-ink">{p.title}</p>
      <Show when={p.hint}>
        <p class={`${hint} mt-1`}>{p.hint}</p>
      </Show>
      <Show when={p.action}>
        {(action) => (
          <button class={`${btn} mt-3`} onClick={() => action().onClick()}>
            {action().label}
          </button>
        )}
      </Show>
      {p.children}
    </div>
  )
}

export function PanelPage(p: { children: JSX.Element }) {
  return <div class={page}>{p.children}</div>
}

export interface PanelSectionProps {
  /** Small uppercase label on the left of the section header. */
  label?: string
  /** Muted note on the right of the header, e.g. the scale or scope. */
  hint?: string
  /** Controls pinned to the right of the header, before `hint`. */
  actions?: JSX.Element
  children: JSX.Element
  class?: string
}

/**
 * The standard content card: `panelCard` surface plus a labelled header row.
 * Replaces the hand-rolled `panelCard` + `sectionLabel` pairs panels kept copying.
 */
export function PanelSection(p: PanelSectionProps) {
  return (
    <section class={`${panelCard} ${p.class ?? ''}`}>
      <Show when={p.label || p.hint || p.actions}>
        <div class="flex flex-wrap items-center gap-2">
          <Show when={p.label}>
            <span class={sectionLabel}>{p.label}</span>
          </Show>
          <Show when={p.actions}>
            <span class="ml-auto flex items-center gap-1.5">{p.actions}</span>
          </Show>
          <Show when={p.hint}>
            <span class={`${hint} ${p.actions ? '' : 'ml-auto'}`}>{p.hint}</span>
          </Show>
        </div>
      </Show>
      {p.children}
    </section>
  )
}

/** Pulsing placeholder rows for panels that have nothing to show yet. */
export function Skeleton(p: { lines?: number; class?: string }) {
  const rows = () => Array.from({ length: p.lines ?? 3 }, (_, i) => i)
  return (
    <div class={`flex flex-col gap-2 ${p.class ?? ''}`} aria-hidden>
      <For each={rows()}>
        {(i) => (
          <div
            class={`h-3 animate-pulse rounded-md bg-control ${i % 3 === 2 ? 'w-2/3' : i % 3 === 1 ? 'w-4/5' : 'w-full'}`}
          />
        )}
      </For>
    </div>
  )
}
