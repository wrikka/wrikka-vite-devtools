import type { JSX } from 'solid-js'
import { CommentIcon, ComponentIcon, PageIcon } from './icons'

// Panel launcher glyphs — one per hub panel, same 14px stroke style as icons.tsx.
// Kept in their own file so icons.tsx stays small enough for the overlay bundle rules.
const svg = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': true,
} as const

export function HomeIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  )
}

export function TerminalIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="m5 7 5 5-5 5" />
      <path d="M12 17h7" />
    </svg>
  )
}

export function ActivityIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M3 12h4l2.5-7 4 14 2.5-7H21" />
    </svg>
  )
}

export function GaugeIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="m12 15 4-5" />
    </svg>
  )
}

export function ShieldIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function FlaskIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M9 3h6" />
      <path d="M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-8.5V3" />
      <path d="M7.5 14h9" />
    </svg>
  )
}

export function DatabaseIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <ellipse cx="12" cy="5.5" rx="8" ry="2.5" />
      <path d="M4 5.5V18.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5.5" />
      <path d="M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" />
    </svg>
  )
}

export function ShareIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  )
}

export function GlobeIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
    </svg>
  )
}

export function BracesIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M8 4c-2 0-3 1-3 3v3c0 1.5-.8 2-2 2.5 1.2.5 2 1 2 2.5v3c0 2 1 3 3 3" />
      <path d="M16 4c2 0 3 1 3 3v3c0 1.5.8 2 2 2.5-1.2.5-2 1-2 2.5v3c0 2-1 3-3 3" />
    </svg>
  )
}

export function PackageIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  )
}

export function LayersIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  )
}

export function PaletteIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.5a4.5 4.5 0 0 0 4.5-4.5C22 6.4 17.5 3 12 3z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </svg>
  )
}

export function SignalIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M18.9 5.1a10 10 0 0 1 0 13.8M5.1 18.9a10 10 0 0 1 0-13.8" />
    </svg>
  )
}

export function PlayIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M7 4.5v15l13-7.5-13-7.5z" />
    </svg>
  )
}

export function ServerIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  )
}

export function FrameIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  )
}

/** hash route → glyph, falling back to the panel's category-tinted monogram. */
export const PANEL_GLYPHS: Record<string, () => JSX.Element> = {
  home: HomeIcon,
  '': CommentIcon,
  components: ComponentIcon,
  routes: PageIcon,
  solid: SignalIcon,
  theme: PaletteIcon,
  network: ActivityIcon,
  runs: PlayIcon,
  'mcp-playground': ServerIcon,
  performance: GaugeIcon,
  console: TerminalIcon,
  bundle: PackageIcon,
  env: BracesIcon,
  'visual-diff': LayersIcon,
  tests: FlaskIcon,
  state: DatabaseIcon,
  imports: ShareIcon,
  i18n: GlobeIcon,
  security: ShieldIcon,
  canvas: FrameIcon,
}

