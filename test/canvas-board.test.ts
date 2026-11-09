import { describe, expect, it } from 'bun:test'
import {
  COMP_H,
  MAX_PREVIEWS,
  MIN_SCALE,
  PAGE_H,
  PAGE_W,
  PREVIEW_H,
  PREVIEW_MIN_SCALE,
  PREVIEW_W,
  buildBoard,
  fitTransform,
  focusTransform,
  frameInView,
  pickPreviews,
  previewScale,
  previewUrl,
  previewable,
  zoomAt,
  type ComponentInput,
  type RouteInput,
} from '../src/client/canvas-board'

const route = (path: string, over: Partial<RouteInput> = {}): RouteInput => ({
  path,
  file: `src/routes${path === '/' ? '/index' : path}.tsx`,
  kind: 'page',
  ...over,
})

const comp = (name: string, over: Partial<ComponentInput> = {}): ComponentInput => ({
  name,
  file: `src/components/${name}.tsx`,
  kind: 'component',
  refs: 3,
  loc: 80,
  ...over,
})

describe('buildBoard', () => {
  it('wraps pages after four columns', () => {
    const board = buildBoard(['/', '/a', '/b', '/c', '/d'].map((p) => route(p)), [])
    const fifth = board.frames[4]!
    expect(board.frames[0]!.x).toBe(0)
    expect(board.frames[4]!.x).toBe(board.frames[0]!.x)
    expect(fifth.y).toBeGreaterThan(board.frames[0]!.y)
    expect(board.frames[3]!.y).toBe(board.frames[0]!.y)
  })

  it('puts the component band below every page', () => {
    const board = buildBoard([route('/'), route('/about')], [comp('Button'), comp('Card')])
    const pages = board.frames.filter((f) => f.kind === 'page')
    const cards = board.frames.filter((f) => f.kind === 'component')
    const lowestPage = Math.max(...pages.map((f) => f.y + f.h))
    const highestCard = Math.min(...cards.map((f) => f.y))
    expect(highestCard).toBeGreaterThan(lowestPage)
    expect(board.pageCount).toBe(2)
    expect(board.componentCount).toBe(2)
  })

  it('skips component rows whose kind is page', () => {
    const board = buildBoard([], [comp('Home', { kind: 'page' }), comp('Header')])
    expect(board.componentCount).toBe(1)
    expect(board.frames.map((f) => f.label)).toEqual(['Header'])
  })

  it('sizes the board to the widest band and the full height', () => {
    const board = buildBoard([route('/')], [comp('A'), comp('B'), comp('C')])
    const right = Math.max(...board.frames.map((f) => f.x + f.w))
    const bottom = Math.max(...board.frames.map((f) => f.y + f.h))
    expect(board.width).toBeGreaterThanOrEqual(right)
    expect(board.height).toBeGreaterThanOrEqual(bottom)
    expect(board.frames[0]!.w).toBe(PAGE_W)
    expect(board.frames[0]!.h).toBe(PAGE_H)
    expect(board.frames[1]!.h).toBe(COMP_H)
  })

  it('keeps a lowercased haystack for filtering', () => {
    const board = buildBoard([route('/Settings', { title: 'Settings Page' })], [])
    expect(board.frames[0]!.text).toContain('settings page')
  })
})

describe('fitTransform', () => {
  it('centres a small board and never zooms past 100%', () => {
    const board = buildBoard([route('/')], [])
    const t = fitTransform(board, { width: 2000, height: 1200 })
    expect(t.scale).toBe(1)
    expect(t.tx).toBe((2000 - PAGE_W) / 2)
  })

  it('clamps to the minimum scale when the board is huge', () => {
    const board = buildBoard(
      Array.from({ length: 40 }, (_, i) => route(`/p${i}`)),
      Array.from({ length: 60 }, (_, i) => comp(`C${i}`)),
    )
    const t = fitTransform(board, { width: 300, height: 200 })
    expect(t.scale).toBe(MIN_SCALE)
  })

  it('returns an identity transform with no viewport', () => {
    const board = buildBoard([], [])
    expect(fitTransform(board, { width: 0, height: 0 })).toEqual({ scale: 1, tx: 0, ty: 0 })
  })
})

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const before = { scale: 1, tx: 40, ty: 20 }
    const cx = 300
    const cy = 200
    const worldX = (cx - before.tx) / before.scale
    const after = zoomAt(before, 2, cx, cy)
    expect(after.tx + worldX * after.scale).toBeCloseTo(cx)
    expect(after.ty + ((cy - before.ty) / before.scale) * after.scale).toBeCloseTo(cy)
  })

  it('clamps the scale into range', () => {
    expect(zoomAt({ scale: 1, tx: 0, ty: 0 }, 99, 0, 0).scale).toBe(2.5)
    expect(zoomAt({ scale: 1, tx: 0, ty: 0 }, 0.01, 0, 0).scale).toBe(MIN_SCALE)
  })
})

describe('focusTransform', () => {
  it('centres the frame in the viewport', () => {
    const board = buildBoard([route('/')], [])
    const frame = board.frames[0]!
    const view = { width: 800, height: 600 }
    const t = focusTransform(frame, view)
    const left = t.tx + frame.x * t.scale
    const top = t.ty + frame.y * t.scale
    expect(left + (frame.w * t.scale) / 2).toBeCloseTo(view.width / 2)
    expect(top + (frame.h * t.scale) / 2).toBeCloseTo(view.height / 2)
  })
})

describe('previews', () => {
  it('carries route params onto the frame', () => {
    const board = buildBoard([route('/users/$id', { params: ['id'] })], [])
    expect(board.frames[0]!.path).toBe('/users/$id')
    expect(board.frames[0]!.params).toEqual(['id'])
  })

  it('previews only static page routes', () => {
    const board = buildBoard(
      [
        route('/'),
        route('/users/$id', { params: ['id'] }),
        route('/dash', { kind: 'layout' }),
        route('/__devtools/x'),
      ],
      [comp('Card')],
    )
    expect(board.frames.map(previewable)).toEqual([true, false, false, false, false])
  })

  it('joins the host base and suppresses the overlay', () => {
    expect(previewUrl('/about')).toBe('/about?__wrikka-overlay=off')
    expect(previewUrl('/about', '/app/')).toBe('/app/about?__wrikka-overlay=off')
    expect(previewUrl('/', '/app', 3)).toBe('/app/?__wrikka-overlay=off&__wrikka-r=3')
  })

  it('scales the preview to cover the artboard', () => {
    expect(previewScale(PREVIEW_W, PREVIEW_H)).toBe(1)
    expect(previewScale(320, 160)).toBeCloseTo(320 / PREVIEW_W)
    expect(previewScale(0, 100)).toBe(0)
    expect(previewScale(100, -1)).toBe(0)
  })

  it('treats frames just past the margin as off-screen', () => {
    const frame = buildBoard([route('/')], []).frames[0]!
    const view = { width: 800, height: 600 }
    const off = { scale: 1, tx: -PAGE_W - 161, ty: 0 }
    const near = { scale: 1, tx: -PAGE_W - 120, ty: 0 }
    expect(frameInView(frame, off, view)).toBe(false)
    expect(frameInView(frame, near, view)).toBe(true)
    expect(frameInView(frame, off, view, 200)).toBe(true)
    expect(frameInView(frame, { scale: 1, tx: 0, ty: -PAGE_H - 500 }, view)).toBe(false)
  })

  it('caps previews and keeps the selection first', () => {
    const routes = Array.from({ length: 9 }, (_, i) => route(`/p${i}`))
    const board = buildBoard(routes, [])
    const view = { width: 20000, height: 20000 }
    const transform = { scale: 1, tx: 0, ty: 0 }
    expect(pickPreviews(board.frames, transform, view)).toHaveLength(MAX_PREVIEWS)
    const selected = board.frames[8]!.id
    expect(pickPreviews(board.frames, transform, view, MAX_PREVIEWS, selected)[0]).toBe(selected)
  })

  it('stays wireframe until the board is zoomed in', () => {
    const board = buildBoard([route('/')], [])
    const view = { width: 800, height: 600 }
    const transform = { scale: PREVIEW_MIN_SCALE - 0.01, tx: 0, ty: 0 }
    expect(pickPreviews(board.frames, transform, view)).toEqual([])
  })
})
