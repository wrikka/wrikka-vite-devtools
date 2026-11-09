import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { ComponentsReport } from '../rpc/components'
import type { RoutesReport } from '../rpc/routes'
import type { PanelApi } from '../ui/api'
import { btn, hint, page, pageHead, title } from '../ui/bits'
import CanvasFrame from './CanvasFrame'
import CanvasInspector from './CanvasInspector'
import CanvasToolbar from './CanvasToolbar'
import {
  MAX_PREVIEWS,
  PREVIEW_MIN_SCALE,
  buildBoard,
  pickPreviews,
  previewUrl,
  routeUrl,
  type Board,
  type BoardFrame,
} from './canvas-board'
import { createCanvasView } from './canvas-view'

export interface CanvasPanelProps {
  api: PanelApi
  /** Absolute project root, so editor links resolve. */
  root(): string
}

const PREVIEWS_KEY = 'wrikka.canvas.previews'

function readPreviews(): boolean {
  try {
    return localStorage.getItem(PREVIEWS_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Figma-like board: every route as a page artboard with a live preview, every component as a card. */
export default function CanvasApp(p: CanvasPanelProps) {
  const vp = createCanvasView()
  const [board, setBoard] = createSignal<Board>()
  const [selected, setSelected] = createSignal<string>()
  const [query, setQuery] = createSignal('')
  const [grid, setGrid] = createSignal(true)
  const [previews, setPreviews] = createSignal(readPreviews())
  const [hostBase, setHostBase] = createSignal('/')
  const [rev, setRev] = createSignal(0)
  const [overrides, setOverrides] = createSignal<Record<string, string>>({})
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('mapping routes and components…')

  onMount(() => {
    void loadMeta()
    void load()
  })

  async function loadMeta(): Promise<void> {
    try {
      const meta = (await p.api.call('get-meta', {})) as { hostBase?: string }
      if (meta.hostBase) setHostBase(meta.hostBase)
    } catch {
      // Preview URLs fall back to the site root; the board still works.
    }
  }

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const [routes, components] = await Promise.all([
        p.api.call('list-routes', {}) as Promise<RoutesReport>,
        p.api.call('list-components', {}) as Promise<ComponentsReport>,
      ])
      const next = buildBoard(routes.routes, components.components)
      setBoard(next)
      setRev((n) => n + 1)
      setMsg(`${next.pageCount} pages · ${next.componentCount} components`)
      requestAnimationFrame(() => vp.fit(next))
    } catch (err) {
      setMsg(`scan failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  function focus(id: string): void {
    const frame = board()?.frames.find((f) => f.id === id)
    if (!frame) return
    setSelected(id)
    vp.focus(frame)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') setSelected(undefined)
    if (e.key === '0') vp.fit(board())
    if (e.key === '+' || e.key === '=') vp.zoomTo(vp.transform().scale * 1.2)
    if (e.key === '-') vp.zoomTo(vp.transform().scale / 1.2)
  }

  function togglePreviews(): void {
    const next = !previews()
    setPreviews(next)
    try {
      localStorage.setItem(PREVIEWS_KEY, next ? 'on' : 'off')
    } catch {
      // Persistence is best-effort; the toggle still works for this session.
    }
  }

  function reloadPreviews(): void {
    setRev((n) => n + 1)
  }

  function setOverride(id: string, value: string): void {
    setOverrides((prev) => ({ ...prev, [id]: value }))
  }

  const frames = createMemo(() => board()?.frames ?? [])
  const selectedFrame = createMemo(() => frames().find((f) => f.id === selected()))
  const needle = createMemo(() => query().trim().toLowerCase())

  /** Param routes become previewable once the inspector supplies a concrete path. */
  const pickable = createMemo(() => {
    const map = overrides()
    return frames().map((f) => {
      const override = map[f.id]?.trim()
      return override && f.kind === 'page' ? { ...f, params: [], path: override } : f
    })
  })

  const previewIds = createMemo(() => {
    if (!previews() || vp.size().width === 0) return new Set<string>()
    return new Set(pickPreviews(pickable(), vp.transform(), vp.size(), MAX_PREVIEWS, selected()))
  })

  const status = createMemo(() => {
    if (previews() && frames().length > 0 && vp.transform().scale < PREVIEW_MIN_SCALE)
      return `${msg()} · zoom in for live previews`
    const live = previewIds().size
    return live > 0 ? `${msg()} · ${live} live preview${live === 1 ? '' : 's'}` : msg()
  })

  function previewSrc(f: BoardFrame): string {
    return previewUrl(overrides()[f.id]?.trim() || f.path, hostBase(), rev())
  }

  function liveHref(f: BoardFrame): string | undefined {
    if (f.kind !== 'page') return undefined
    const override = overrides()[f.id]?.trim()
    if (!override && f.params.length > 0) return undefined
    return routeUrl(override || f.path, hostBase())
  }

  const overrideValue = () => {
    const f = selectedFrame()
    return f ? (overrides()[f.id] ?? '') : ''
  }

  return (
    <div class={`${page} h-full`}>
      <div class={pageHead}>
        <h1 class={title}>Canvas</h1>
        <button class={`${btn} ml-auto`} disabled={busy()} onClick={() => void load()}>
          {busy() ? 'scanning…' : 'Rescan'}
        </button>
      </div>

      <CanvasToolbar
        query={query()}
        onQuery={setQuery}
        scale={vp.transform().scale}
        onZoomIn={() => vp.zoomTo(vp.transform().scale * 1.2)}
        onZoomOut={() => vp.zoomTo(vp.transform().scale / 1.2)}
        onFit={() => vp.fit(board())}
        onActual={() => vp.zoomTo(1)}
        grid={grid()}
        onToggleGrid={() => setGrid(!grid())}
        previews={previews()}
        onTogglePreviews={togglePreviews}
        onReload={reloadPreviews}
        status={status()}
      />

      <div class="flex min-h-0 flex-1 gap-2">
        <div
          ref={(node) => vp.attach(node)}
          class="relative h-[calc(100dvh-150px)] min-h-96 flex-1 cursor-grab touch-none overflow-hidden rounded-xl border border-solid border-line bg-surface-sunken active:cursor-grabbing"
          role="application"
          aria-label="Canvas of pages and components"
          tabindex="0"
          onWheel={vp.wheel}
          onPointerDown={vp.pointerDown}
          onPointerMove={vp.pointerMove}
          onPointerUp={vp.pointerUp}
          onPointerCancel={vp.pointerUp}
          onKeyDown={onKeyDown}
        >
          <Show when={grid()}>
            <div
              class="pointer-events-none absolute inset-0 text-line opacity-40"
              style={{
                'background-image':
                  'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                'background-size': `${24 * vp.transform().scale}px ${24 * vp.transform().scale}px`,
                'background-position': `${vp.transform().tx}px ${vp.transform().ty}px`,
              }}
            />
          </Show>
          <div
            class="absolute origin-top-left"
            style={{
              width: `${board()?.width ?? 0}px`,
              height: `${board()?.height ?? 0}px`,
              transform: `translate(${vp.transform().tx}px, ${vp.transform().ty}px) scale(${vp.transform().scale})`,
            }}
          >
            <For each={frames()}>{(f) => (
              <CanvasFrame
                frame={f}
                selected={selected() === f.id}
                dimmed={needle() !== '' && !f.text.includes(needle())}
                preview={previewIds().has(f.id)}
                previewSrc={previewIds().has(f.id) ? previewSrc(f) : undefined}
                onSelect={() => setSelected(f.id)}
                onFocus={() => focus(f.id)}
              />
            )}</For>
          </div>
          <Show when={!busy() && frames().length === 0}>
            <p class={`${hint} absolute inset-0 m-auto h-fit w-fit`}>
              No routes or components found — run this on a project with `src/`.
            </p>
          </Show>
        </div>

        <CanvasInspector
          api={p.api}
          root={p.root}
          frame={selectedFrame()}
          liveHref={selectedFrame() ? liveHref(selectedFrame()!) : undefined}
          override={overrideValue()}
          onOverride={(value) => {
            const f = selectedFrame()
            if (f) setOverride(f.id, value)
          }}
          onReload={reloadPreviews}
        />
      </div>
    </div>
  )
}
