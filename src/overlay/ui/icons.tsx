import type { JSX } from 'solid-js'

// Overlay-local glyphs — same 14px stroke treatment as src/ui/icons.tsx, which
// stays read-only for the hub client. Add overlay-only icons here.
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

export function CloseIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function CopyIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

/** Chat bubble with reply lines — distinct from the plain CommentIcon. */
export function ChatIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
}

/** Little robot head — marks the agent's side of a chat exchange. */
export function AgentIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V5" />
      <circle cx="12" cy="3.5" r="1" />
      <circle cx="9" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <path d="M9 16.5h6" />
    </svg>
  )
}

/** Arrow dropping onto a baseline — "jump to latest". */
export function LatestIcon(): JSX.Element {
  return (
    <svg {...svg}>
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  )
}
