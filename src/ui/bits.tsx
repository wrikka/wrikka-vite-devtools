// Shared UnoCSS class strings — semantic tokens from src/ui/theme.ts, no raw hex.
export const btn =
  'cursor-pointer rounded-md border border-solid border-line bg-control px-2 py-0.5 text-[12px] text-ink hover:bg-control-hover'
export const btnActive = 'border-accent bg-control-hover'
export const btnPrimary =
  'cursor-pointer rounded-md border border-solid border-accent bg-accent px-3 py-1 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:cursor-default disabled:opacity-50'
export const hint = 'text-[11px] text-ink-muted'
export const field =
  'w-full rounded-lg border border-solid border-line bg-control p-2 text-[12px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none'
export const chip =
  'cursor-pointer rounded-full border border-solid border-line bg-control px-2 py-0.5 text-[11px] text-ink hover:bg-control-hover'
export const chipOn = 'border-accent bg-accent text-white'
export const row = 'flex flex-wrap items-center gap-1.5'
export const card = 'flex flex-col gap-1 rounded-lg border border-solid border-line bg-surface-raised p-2'
export const link = 'text-accent-ink underline underline-offset-2 hover:text-accent-hover'
export const iconBtn =
  'flex cursor-pointer items-center justify-center rounded-md border border-solid border-transparent p-1.5 text-ink-muted hover:bg-control-hover hover:text-ink'
export const iconBtnOn = 'border-line-strong bg-control text-ink'

/** Page shell shared by every panel in this package's client. */
export const page = 'flex flex-col gap-3 p-4'
export const pageHead = 'flex flex-wrap items-center gap-2'
export const title = 'text-[15px] font-semibold tracking-tight text-ink'
export const eyebrow = 'text-[10px] font-medium uppercase tracking-wider text-ink-faint'

/** Stat strip: a panel's headline numbers before the list. */
export const statRow = 'grid grid-cols-2 gap-2 sm:grid-cols-4'
export const stat = 'flex flex-col gap-1 rounded-xl border border-solid border-line bg-surface-raised px-3 py-2'
export const statValue = 'text-[20px] font-semibold leading-none text-ink tabular-nums'
export const statLabel = 'text-[10px] font-medium uppercase tracking-wider text-ink-faint'

/** Grid of visual cards (Components uses this as its main view). */
export const grid = 'grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3'
export const tile =
  'flex flex-col gap-1.5 rounded-xl border border-solid border-line bg-surface-raised p-3 text-left transition-colors hover:border-line-strong hover:bg-control'
export const tileOn = 'border-accent bg-accent-soft hover:bg-accent-soft hover:border-accent'

/** Segmented tab bar for a panel's top-level views. */
export const tabBar = 'flex flex-wrap items-center gap-1 rounded-xl border border-solid border-line bg-surface-raised p-1'
export const tab =
  'flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-transparent px-2.5 py-1 text-[12px] text-ink-muted hover:bg-control hover:text-ink'
export const tabOn = 'border-line-strong bg-control text-ink'

export const empty =
  'rounded-xl border border-dashed border-line bg-surface-raised/60 px-4 py-8 text-center text-[12px] text-ink-muted'

export const meter = 'h-1 w-full overflow-hidden rounded-full bg-control'
export const sectionLabel = 'text-[11px] font-semibold uppercase tracking-wide text-ink-faint'

/** Hero card: the one place a panel spends a gradient. */
export const hero =
  'flex flex-col gap-3 rounded-2xl border border-solid border-line bg-linear-to-br from-accent-soft via-surface-raised to-surface p-4'
export const codeBlock =
  'm-0 overflow-x-auto rounded-lg border border-solid border-line bg-surface-sunken p-3 font-mono text-[11px] leading-relaxed text-ink-muted'
export const listRow = 'flex items-center gap-2 rounded-lg border border-solid border-line bg-surface-raised px-2.5 py-2'

const statusColors: Record<string, string> = {
  queued: 'bg-warn/20 text-warn-ink',
  running: 'bg-info/20 text-info-ink',
  done: 'bg-ok/20 text-ok-ink',
  failed: 'bg-bad/20 text-bad-ink',
}

export function statusPill(status: string): string {
  return `w-fit rounded border border-solid border-line px-1.5 text-[10px] font-bold uppercase ${statusColors[status] ?? 'bg-control text-ink-muted'}`
}

/** Softer, filled badge for card headers — same semantic tokens, more visual weight. */
export type Tone = 'accent' | 'ok' | 'warn' | 'info' | 'bad'

const toneColors: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-ok/20 text-ok-ink',
  warn: 'bg-warn/20 text-warn-ink',
  info: 'bg-info/20 text-info-ink',
  bad: 'bg-bad/20 text-bad-ink',
}

export function tonePill(tone: Tone): string {
  return `w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneColors[tone]}`
}

/** Which tone a scan kind reads as, so the three panels agree on color. */
export function kindTone(kind: string): Tone {
  if (kind === 'page' || kind === 'index') return 'ok'
  if (kind === 'layout') return 'info'
  if (kind === 'hook' || kind === 'not-found') return 'warn'
  return 'accent'
}

/** A LOC bar that turns warm only once a file nears the 250-line limit. */
export function meterTone(value: number, limit = 250): string {
  if (value > limit) return 'bg-bad'
  if (value > limit * 0.6) return 'bg-warn'
  return 'bg-ok'
}
