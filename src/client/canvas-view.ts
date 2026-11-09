import { createSignal, onCleanup } from 'solid-js'
import { fitTransform, focusTransform, zoomAt, type Board, type BoardFrame, type Transform } from './canvas-board'

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 }

/** Board transform plus pan/zoom gestures and resize tracking for the Canvas viewport. */
export function createCanvasView() {
  let el: HTMLDivElement | undefined
  let observer: ResizeObserver | undefined
  let pan: { x: number; y: number; tx: number; ty: number } | undefined

  const [transform, setTransform] = createSignal<Transform>(IDENTITY)
  const [size, setSize] = createSignal({ width: 0, height: 0 })

  function measure(): { width: number; height: number } {
    const rect = el?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }

  function attach(node: HTMLDivElement): void {
    el = node
    setSize(measure())
    observer = new ResizeObserver(() => setSize(measure()))
    observer.observe(node)
  }

  onCleanup(() => observer?.disconnect())

  function fit(board: Board | undefined): void {
    if (!board) return
    setTransform(fitTransform(board, measure()))
  }

  function zoomTo(next: number): void {
    const { width, height } = measure()
    setTransform(zoomAt(transform(), next, width / 2, height / 2))
  }

  function focus(frame: BoardFrame): void {
    setTransform(focusTransform(frame, measure()))
  }

  function wheel(e: WheelEvent): void {
    e.preventDefault()
    const rect = el!.getBoundingClientRect()
    const next = transform().scale * Math.exp(-e.deltaY * 0.0015)
    setTransform(zoomAt(transform(), next, e.clientX - rect.left, e.clientY - rect.top))
  }

  function pointerDown(e: PointerEvent): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-frame]')) return
    pan = { x: e.clientX, y: e.clientY, tx: transform().tx, ty: transform().ty }
    el?.setPointerCapture(e.pointerId)
  }

  function pointerMove(e: PointerEvent): void {
    if (!pan) return
    setTransform({ ...transform(), tx: pan.tx + (e.clientX - pan.x), ty: pan.ty + (e.clientY - pan.y) })
  }

  function pointerUp(e: PointerEvent): void {
    pan = undefined
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }

  return { attach, transform, size, fit, zoomTo, focus, wheel, pointerDown, pointerMove, pointerUp }
}
