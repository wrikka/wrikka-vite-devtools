/**
 * The one palette both UIs share: the in-page overlay (shadow root) and the hub
 * client. Feed it to `presetWind4({ theme: { colors } })`; utilities then read
 * `bg-surface`, `text-ink-muted`, `border-line`, never an inline hex.
 */
export const themeColors: Record<string, string | Record<string, string>> = {
  surface: { DEFAULT: '#15161b', raised: '#1c1e25', sunken: '#101115' },
  line: { DEFAULT: '#2f333d', strong: '#454a57' },
  ink: { DEFAULT: '#e9ebef', muted: '#a2a9b4', faint: '#707887' },
  control: { DEFAULT: '#262a33', hover: '#333845' },
  accent: { DEFAULT: '#5b7cfa', hover: '#7089ff', ink: '#c3ceff', soft: '#212c4d' },
  ok: { DEFAULT: '#2f7a52', ink: '#7fd6ab' },
  warn: { DEFAULT: '#7a6a24', ink: '#dccf72' },
  info: { DEFAULT: '#2f5aa8', ink: '#93b8f7' },
  bad: { DEFAULT: '#8f3243', ink: '#f2968f' },
}
