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

const statusColors: Record<string, string> = {
  queued: 'bg-warn/20 text-warn-ink',
  running: 'bg-info/20 text-info-ink',
  done: 'bg-ok/20 text-ok-ink',
  failed: 'bg-bad/20 text-bad-ink',
}

export function statusPill(status: string): string {
  return `w-fit rounded border border-solid border-line px-1.5 text-[10px] font-bold uppercase ${statusColors[status] ?? 'bg-control text-ink-muted'}`
}
