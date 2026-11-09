import type { JSX } from 'solid-js'

// Inline 14px stroke glyphs — no icon runtime, safe for the self-contained overlay bundle.
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

export function CommentIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function PinsIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6z" />
    </svg>
  )
}

export function PanelIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M3 5h18v14H3z" />
      <path d="M9 5v14M15 5v14" />
    </svg>
  )
}

export function SearchIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function ElementIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M10 4v16" />
    </svg>
  )
}

export function ComponentIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 3 3 8l9 5 9-5-9-5z" />
      <path d="m3 14 9 5 9-5" />
    </svg>
  )
}

export function PageIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
      <path d="M14 3v6h6" />
    </svg>
  )
}

export function RefreshIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function ExternalIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M14 3h7v7" />
      <path d="m21 3-9 9" />
      <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </svg>
  )
}

export function EyeIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function FitIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  )
}

export function WarningIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 9v6M12 18h.01" />
    </svg>
  )
}

export function ClockIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function ChevronIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
