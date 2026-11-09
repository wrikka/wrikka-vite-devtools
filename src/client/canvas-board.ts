/**
 * Board geometry for the Canvas panel: one frame per route (a "page" artboard)
 * and one card per component export, laid out in two bands. Pure math only, so
 * the layout is testable without a DOM.
 */

export type FrameKind = 'page' | 'component'

export interface BoardFrame {
  id: string
  kind: FrameKind
  /** Route path or component name — the big label on the frame. */
  label: string
  file: string
  /** Route path for pages, empty for component cards. */
  path: string
  /** Route params, e.g. `['handle']` — a parameterised route has no static preview. */
  params: string[]
  /** Component metrics; 0 for page frames. */
  refs: number
  loc: number
  /** Route kind / component kind, shown as the small badge. */
  badge: string
  /** Secondary line: page title, or refs + lines for a component. */
  note: string
  x: number
  y: number
  w: number
  h: number
  /** Pre-lowered haystack for the filter box. */
  text: string
}

export interface Board {
  frames: BoardFrame[]
  width: number
  height: number
  pageCount: number
  componentCount: number
}

export interface RouteInput {
  path: string
  file: string
  kind: string
  title?: string
  params?: string[]
}

export interface ComponentInput {
  file: string
  name: string
  kind: string
  refs: number
  loc: number
}

export const PAGE_W = 320
export const PAGE_H = 200
export const COMP_W = 200
export const COMP_H = 96
const PAGE_GAP = 32
const COMP_GAP = 24
const PAGE_COLS = 4
const COMP_COLS = 6
const BAND_GAP = 88

function pageFrame(r: RouteInput, index: number): BoardFrame {
  const col = index % PAGE_COLS
  const rowAt = Math.floor(index / PAGE_COLS)
  const label = r.path || '/'
  const note = r.title ? r.title : 'no static title'
  return {
    id: `page:${label}:${r.file}`,
    kind: 'page',
    label,
    file: r.file,
    path: label,
    params: r.params ?? [],
    refs: 0,
    loc: 0,
    badge: r.kind,
    note,
    x: col * (PAGE_W + PAGE_GAP),
    y: rowAt * (PAGE_H + PAGE_GAP),
    w: PAGE_W,
    h: PAGE_H,
    text: `${label} ${r.file} ${r.kind} ${note}`.toLowerCase(),
  }
}

function componentFrame(c: ComponentInput, index: number, top: number): BoardFrame {
  const col = index % COMP_COLS
  const rowAt = Math.floor(index / COMP_COLS)
  const note = `${c.refs} refs · ${c.loc} lines`
  return {
    id: `component:${c.file}#${c.name}`,
    kind: 'component',
    label: c.name,
    file: c.file,
    path: '',
    params: [],
    refs: c.refs,
    loc: c.loc,
    badge: c.kind,
    note,
    x: col * (COMP_W + COMP_GAP),
    y: top + rowAt * (COMP_H + COMP_GAP),
    w: COMP_W,
    h: COMP_H,
    text: `${c.name} ${c.file} ${c.kind} ${note}`.toLowerCase(),
  }
}

function bandHeight(count: number, size: number, gap: number, cols: number): number {
  if (count === 0) return 0
  return Math.ceil(count / cols) * size + (Math.ceil(count / cols) - 1) * gap
}

/**
 * Pages first, then components in their own band. Components of kind `page`
 * are skipped: every page already has a route artboard above them.
 */
export function buildBoard(routes: RouteInput[], components: ComponentInput[]): Board {
  const pages = routes.map(pageFrame)
  const cards = components.filter((c) => c.kind !== 'page')
  const pagesBand = bandHeight(pages.length, PAGE_H, PAGE_GAP, PAGE_COLS)
  const top = pagesBand > 0 ? pagesBand + BAND_GAP : 0
  const frames = [...pages, ...cards.map((c, i) => componentFrame(c, i, top))]

  const pageWidth = pages.length > 0 ? Math.min(pages.length, PAGE_COLS) * (PAGE_W + PAGE_GAP) - PAGE_GAP : 0
  const compWidth = cards.length > 0 ? Math.min(cards.length, COMP_COLS) * (COMP_W + COMP_GAP) - COMP_GAP : 0
  const compBand = bandHeight(cards.length, COMP_H, COMP_GAP, COMP_COLS)

  return {
    frames,
    width: Math.max(pageWidth, compWidth),
    height: pagesBand + (compBand > 0 ? BAND_GAP + compBand : 0),
    pageCount: pages.length,
    componentCount: cards.length,
  }
}

export interface Viewport {
  width: number
  height: number
}

export interface Transform {
  scale: number
  tx: number
  ty: number
}

export const MIN_SCALE = 0.2
export const MAX_SCALE = 2.5
const FIT_PADDING = 48
const FIT_MAX = 1

export function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

/** Centre the whole board in the viewport, never zooming past 100% to do it. */
export function fitTransform(board: Board, view: Viewport): Transform {
  if (board.width <= 0 || board.height <= 0 || view.width <= 0 || view.height <= 0) {
    return { scale: 1, tx: 0, ty: 0 }
  }
  const raw = Math.min(
    (view.width - FIT_PADDING * 2) / board.width,
    (view.height - FIT_PADDING * 2) / board.height,
    FIT_MAX,
  )
  const scale = clampScale(raw)
  return {
    scale,
    tx: (view.width - board.width * scale) / 2,
    ty: (view.height - board.height * scale) / 2,
  }
}

/** Zoom to one frame: it fills the viewport but stays readable. */
export function focusTransform(frame: BoardFrame, view: Viewport): Transform {
  if (view.width <= 0 || view.height <= 0) return { scale: 1, tx: 0, ty: 0 }
  const scale = clampScale(
    Math.min((view.width - FIT_PADDING * 2) / frame.w, (view.height - FIT_PADDING * 2) / frame.h, 1.5),
  )
  return {
    scale,
    tx: (view.width - frame.w * scale) / 2 - frame.x * scale,
    ty: (view.height - frame.h * scale) / 2 - frame.y * scale,
  }
}

/** Keep the point under the cursor fixed while the scale changes. */
export function zoomAt(transform: Transform, nextScale: number, cx: number, cy: number): Transform {
  const scale = clampScale(nextScale)
  const k = scale / transform.scale
  return { scale, tx: cx - (cx - transform.tx) * k, ty: cy - (cy - transform.ty) * k }
}

/**
 * Live previews: a page artboard shows a real 1280x800 render of its route.
 * Below `PREVIEW_MIN_SCALE` the board is too dense to justify booting the host
 * app, so the wireframe stands in until the user zooms in.
 */
export const PREVIEW_W = 1280
export const PREVIEW_H = 800
export const PREVIEW_MIN_SCALE = 0.4
export const MAX_PREVIEWS = 6

/** Same-origin URL of a host route, joined onto the project's Vite base. */
export function routeUrl(path: string, hostBase = '/'): string {
  const base = hostBase.endsWith('/') ? hostBase : `${hostBase}/`
  return `${base}${path.startsWith('/') ? path.slice(1) : path}`
}

/** Same-origin render of a host route, with the devtools dock suppressed. */
export function previewUrl(path: string, hostBase = '/', rev?: number): string {
  const query = rev === undefined ? '__wrikka-overlay=off' : `__wrikka-overlay=off&__wrikka-r=${rev}`
  return `${routeUrl(path, hostBase)}?${query}`
}

/** Only static page routes can render unattended; params, layout shells and devtools paths cannot. */
export function previewable(frame: BoardFrame): boolean {
  if (frame.kind !== 'page' || frame.params.length > 0) return false
  if (frame.badge === 'layout' || frame.badge === 'not-found') return false
  return frame.path.startsWith('/') && !frame.path.startsWith('/__')
}

/** Cover the artboard: fill the width, crop the overflow vertically. */
export function previewScale(innerW: number, innerH: number): number {
  if (innerW <= 0 || innerH <= 0) return 0
  return Math.max(innerW / PREVIEW_W, innerH / PREVIEW_H)
}

export function frameInView(
  frame: BoardFrame,
  transform: Transform,
  view: Viewport,
  margin = 160,
): boolean {
  const left = frame.x * transform.scale + transform.tx
  const top = frame.y * transform.scale + transform.ty
  const right = left + frame.w * transform.scale
  const bottom = top + frame.h * transform.scale
  return (
    right > -margin &&
    left < view.width + margin &&
    bottom > -margin &&
    top < view.height + margin
  )
}

/**
 * Which frames get an iframe right now: the selected page first, then the ones
 * nearest the viewport centre, capped so a dense board never boots the host app
 * a dozen times at once.
 */
export function pickPreviews(
  frames: BoardFrame[],
  transform: Transform,
  view: Viewport,
  max = MAX_PREVIEWS,
  selected?: string,
): string[] {
  if (transform.scale < PREVIEW_MIN_SCALE) return []
  const cx = view.width / 2
  const cy = view.height / 2
  return frames
    .filter((f) => previewable(f) && frameInView(f, transform, view))
    .map((f) => {
      const centerX = (f.x + f.w / 2) * transform.scale + transform.tx
      const centerY = (f.y + f.h / 2) * transform.scale + transform.ty
      return { id: f.id, selected: f.id === selected, ring: (centerX - cx) ** 2 + (centerY - cy) ** 2 }
    })
    .sort((a, b) => Number(b.selected) - Number(a.selected) || a.ring - b.ring)
    .slice(0, max)
    .map((f) => f.id)
}
