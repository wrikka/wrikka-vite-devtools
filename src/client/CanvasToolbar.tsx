import { btn, chip, chipOn, field, hint, iconBtn } from '../ui/bits'
import { EyeIcon, FitIcon, RefreshIcon, SearchIcon } from '../ui/icons'

export interface CanvasToolbarProps {
  query: string
  onQuery(value: string): void
  scale: number
  onZoomIn(): void
  onZoomOut(): void
  onFit(): void
  onActual(): void
  grid: boolean
  onToggleGrid(): void
  previews: boolean
  onTogglePreviews(): void
  onReload(): void
  status: string
}

/** Filter, zoom, grid and preview controls above the board. */
export default function CanvasToolbar(p: CanvasToolbarProps) {
  return (
    <div class="flex flex-wrap items-center gap-1.5">
      <label class="relative flex items-center">
        <span class="pointer-events-none absolute left-2 text-ink-faint">
          <SearchIcon />
        </span>
        <input
          class={`${field} w-56 pl-7 font-mono`}
          aria-label="Filter the canvas"
          placeholder="filter pages and components"
          value={p.query}
          onInput={(e) => p.onQuery(e.currentTarget.value)}
        />
      </label>

      <span class={`${btn} flex cursor-default items-center gap-0.5 p-0.5`}>
        <button class={iconBtn} aria-label="Zoom out" onClick={p.onZoomOut}>
          −
        </button>
        <span class={`${hint} w-10 text-center tabular-nums`}>{Math.round(p.scale * 100)}%</span>
        <button class={iconBtn} aria-label="Zoom in" onClick={p.onZoomIn}>
          +
        </button>
      </span>

      <button class={`${btn} flex items-center gap-1`} aria-label="Fit the board" onClick={p.onFit}>
        <FitIcon /> fit
      </button>
      <button class={btn} onClick={p.onActual}>
        100%
      </button>
      <button class={`${chip} ${p.grid ? chipOn : ''}`} aria-pressed={p.grid} onClick={p.onToggleGrid}>
        grid
      </button>
      <button
        class={`${chip} flex items-center gap-1`}
        aria-pressed={p.previews}
        aria-label="Toggle live previews"
        onClick={p.onTogglePreviews}
      >
        <EyeIcon /> previews {p.previews ? 'on' : 'off'}
      </button>
      <button class={`${btn} flex items-center gap-1`} onClick={p.onReload}>
        <RefreshIcon /> reload
      </button>

      <span class={`${hint} ml-auto truncate`} role="status">
        {p.status}
      </span>
    </div>
  )
}
