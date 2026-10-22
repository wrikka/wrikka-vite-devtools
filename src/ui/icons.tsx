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
