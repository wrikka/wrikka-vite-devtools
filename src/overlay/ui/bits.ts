// Shared UnoCSS class strings — plain repeated utilities, no shortcuts.
export const btn =
  'cursor-pointer rounded-md border border-solid border-[#3a3d46] bg-[#26282f] px-2 py-0.5 text-[12px] text-[#e8e9ed] hover:bg-[#343741]'
export const btnActive = 'border-[#4c6ef5] bg-[#343741]'
export const btnPrimary =
  'cursor-pointer rounded-md border border-solid border-[#4c6ef5] bg-[#4c6ef5] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#5a7bf7] disabled:cursor-default disabled:opacity-50'
export const hint = 'text-[11px] text-[#9aa0ab]'
export const field =
  'w-full rounded-lg border border-solid border-[#3a3d46] bg-[#26282f] p-2 text-[12px] text-[#e8e9ed]'
export const chip = 'cursor-pointer rounded-full border border-solid border-[#3a3d46] bg-[#26282f] px-2 py-0.5 text-[11px] text-[#e8e9ed]'
export const chipOn = 'border-[#4c6ef5] bg-[#4c6ef5] text-white'
export const row = 'flex flex-wrap items-center gap-1.5'
export const card = 'flex flex-col gap-1 rounded-lg border border-solid border-[#3a3d46] p-2'

const statusColors: Record<string, string> = {
  queued: 'bg-[#5c5f2e]',
  running: 'bg-[#2f5aa8]',
  done: 'bg-[#2e6b45]',
  failed: 'bg-[#7c2d3a]',
}

export function statusPill(status: string): string {
  return `w-fit rounded border border-solid border-[#3a3d46] px-1.5 text-[10px] font-bold uppercase ${statusColors[status] ?? 'bg-[#26282f]'}`
}
