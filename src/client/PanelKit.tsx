import { For, Show, type JSX } from 'solid-js'
import { btn, empty, hint, page, pageHead, stat, statLabel, statRow, statValue, title } from '../ui/bits'

export interface PanelHeaderProps {
  title: string
  description?: string
  busy?: boolean
  refresh?: () => void
  refreshLabel?: string
  children?: JSX.Element
}

export function PanelHeader(p: PanelHeaderProps) {
  return (
    <div class={pageHead}>
      <h1 class={title}>{p.title}</h1>
      <Show when={p.description}>
        <span class={`${hint} mr-auto`}>{p.description}</span>
      </Show>
      {p.children}
      <Show when={p.refresh}>
        <button class={`${btn} ${p.description ? '' : 'ml-auto'}`} disabled={p.busy} onClick={() => p.refresh?.()}>
          {p.busy ? 'working…' : (p.refreshLabel ?? 'Rescan')}
        </button>
      </Show>
    </div>
  )
}

export interface StatItem {
  value: string | number
  label: string
  /** A `text-*` utility, e.g. `text-bad-ink`, for the number itself. */
  tone?: string
}

export function StatStrip(p: { items: StatItem[] }) {
  return (
    <div class={statRow}>
      <For each={p.items}>{(item) => (
        <div class={stat}>
          <span class={`${statValue} ${item.tone ?? ''}`}>{item.value}</span>
          <span class={statLabel}>{item.label}</span>
        </div>
      )}</For>
    </div>
  )
}

export function EmptyState(p: { title: string; hint?: string; children?: JSX.Element }) {
  return (
    <div class={empty}>
      <p class="m-0 text-[13px] text-ink">{p.title}</p>
      <Show when={p.hint}>
        <p class={`${hint} mt-1`}>{p.hint}</p>
      </Show>
      {p.children}
    </div>
  )
}

export function PanelPage(p: { children: JSX.Element }) {
  return <div class={page}>{p.children}</div>
}
