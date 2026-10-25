import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, btnPrimary, field, grid, hint, row, sectionLabel, stat, statLabel, statValue, tile } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage } from './PanelKit'
import { fmtBytes } from './format'

interface Capture {
  name: string
  path: string
}

interface CaptureList {
  files: Capture[]
}

interface CaptureRead {
  name: string
  dataUrl: string
  bytes: number
}

interface DiffResult {
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  pct: number
  sizeMismatch: boolean
  dataUrl: string
  bytesA: number
  bytesB: number
}

export interface VisualDiffAppProps {
  api: PanelApi
}

/** Delta above which a pixel counts as changed — ignores AA and sub-pixel text noise. */
const PIXEL_THRESHOLD = 14

async function decode(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  return img
}

function drawInto(img: HTMLImageElement, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(img, 0, 0, img.width, img.height)
  return ctx.getImageData(0, 0, width, height)
}

function buildDiff(a: ImageData, b: ImageData): { dataUrl: string; changedPixels: number } {
  const canvas = document.createElement('canvas')
  canvas.width = a.width
  canvas.height = a.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  const out = ctx.createImageData(a.width, a.height)
  let changed = 0
  for (let i = 0; i < out.data.length; i += 4) {
    const delta = Math.max(
      Math.abs(a.data[i]! - b.data[i]!),
      Math.abs(a.data[i + 1]! - b.data[i + 1]!),
      Math.abs(a.data[i + 2]! - b.data[i + 2]!),
    )
    if (delta > PIXEL_THRESHOLD) {
      changed += 1
      out.data[i] = 244
      out.data[i + 1] = 63
      out.data[i + 2] = 94
      out.data[i + 3] = Math.min(255, 110 + delta)
    }
  }
  ctx.putImageData(out, 0, 0)
  return { dataUrl: canvas.toDataURL('image/png'), changedPixels: changed }
}

async function compare(a: CaptureRead, b: CaptureRead): Promise<DiffResult> {
  const [imgA, imgB] = await Promise.all([decode(a.dataUrl), decode(b.dataUrl)])
  const width = Math.max(imgA.width, imgB.width)
  const height = Math.max(imgA.height, imgB.height)
  const dataA = drawInto(imgA, width, height)
  const dataB = drawInto(imgB, width, height)
  const { dataUrl, changedPixels } = buildDiff(dataA, dataB)
  return {
    width,
    height,
    changedPixels,
    totalPixels: width * height,
    pct: (changedPixels / (width * height)) * 100,
    sizeMismatch: imgA.width !== imgB.width || imgA.height !== imgB.height,
    dataUrl,
    bytesA: a.bytes,
    bytesB: b.bytes,
  }
}

export default function VisualDiffApp(p: VisualDiffAppProps) {
  const [files, setFiles] = createSignal<Capture[]>([])
  const [baseline, setBaseline] = createSignal('')
  const [candidate, setCandidate] = createSignal('')
  const [preview, setPreview] = createSignal<{ a?: string; b?: string }>({})
  const [diff, setDiff] = createSignal<DiffResult>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('loading captures…')

  onMount(() => void load())

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('list-captures', {})) as CaptureList
      const list = res.files ?? []
      setFiles(list)
      setMsg(list.length === 0 ? 'no captures yet — use the capture button in the overlay' : `${list.length} captures on disk`)
      if (!baseline() || !list.some((f) => f.name === baseline())) setBaseline(list[0]?.name ?? '')
      if (!candidate() || !list.some((f) => f.name === candidate())) setCandidate(list[1]?.name ?? list[0]?.name ?? '')
      setDiff(undefined)
    } catch (err) {
      setMsg(`could not list captures: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function run(): Promise<void> {
    if (!baseline() || !candidate()) {
      setMsg('pick two captures first')
      return
    }
    setBusy(true)
    setDiff(undefined)
    try {
      const [a, b] = (await Promise.all([
        p.api.call('read-capture', { name: baseline() }),
        p.api.call('read-capture', { name: candidate() }),
      ])) as [CaptureRead, CaptureRead]
      setPreview({ a: a.dataUrl, b: b.dataUrl })
      const result = await compare(a, b)
      setDiff(result)
      setMsg(result.changedPixels === 0 ? 'pixel-identical' : `${result.changedPixels} pixels differ`)
    } catch (err) {
      setMsg(`compare failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const canRun = createMemo(() => Boolean(baseline() && candidate()) && !busy())

  return (
    <PanelPage>
      <PanelHeader
        title="Visual Diff"
        description="compare two captures pixel by pixel — red marks where the UI moved"
        busy={busy()}
        refresh={() => void load()}
        refreshLabel="Reload captures"
      />

      <Show when={files().length > 0} fallback={
        <EmptyState
          title="No captures to compare"
          hint="Capture the page from the overlay (or the Capture button in the hub), change the code, capture again, then reload this list."
        />
      }>
        <div class={row}>
          <label class="flex flex-1 flex-col gap-1">
            <span class={sectionLabel}>baseline (before)</span>
            <select class={`${field} font-mono`} value={baseline()} onChange={(e) => setBaseline(e.currentTarget.value)}>
              <For each={files()}>{(f) => <option value={f.name}>{f.name}</option>}</For>
            </select>
          </label>
          <label class="flex flex-1 flex-col gap-1">
            <span class={sectionLabel}>candidate (after)</span>
            <select class={`${field} font-mono`} value={candidate()} onChange={(e) => setCandidate(e.currentTarget.value)}>
              <For each={files()}>{(f) => <option value={f.name}>{f.name}</option>}</For>
            </select>
          </label>
          <button class={`${btnPrimary} self-end`} disabled={!canRun()} onClick={() => void run()}>
            {busy() ? 'comparing…' : 'Compare'}
          </button>
        </div>

        <p class={`${hint} break-all`}>{msg()}</p>

        <Show when={diff()}>
          {(d) => (
            <>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div class={stat}>
                  <span class={`${statValue} ${d().pct > 1 ? 'text-warn-ink' : 'text-ok-ink'}`}>{d().pct.toFixed(2)}%</span>
                  <span class={statLabel}>pixels changed</span>
                </div>
                <div class={stat}>
                  <span class={statValue}>{d().changedPixels.toLocaleString()}</span>
                  <span class={statLabel}>of {d().totalPixels.toLocaleString()}</span>
                </div>
                <div class={stat}>
                  <span class={statValue}>{d().width}×{d().height}</span>
                  <span class={statLabel}>{d().sizeMismatch ? 'viewport changed' : 'viewport matched'}</span>
                </div>
                <div class={stat}>
                  <span class={statValue}>{fmtBytes(Math.abs(d().bytesB - d().bytesA))}</span>
                  <span class={statLabel}>png size delta</span>
                </div>
              </div>

              <div class={grid}>
                <div class={tile}>
                  <span class={sectionLabel}>baseline</span>
                  <span class={`${hint} truncate font-mono`}>{baseline()}</span>
                  <img class="w-full rounded-lg border border-solid border-line" src={preview().a} alt="baseline capture" />
                </div>
                <div class={tile}>
                  <span class={sectionLabel}>candidate</span>
                  <span class={`${hint} truncate font-mono`}>{candidate()}</span>
                  <img class="w-full rounded-lg border border-solid border-line" src={preview().b} alt="candidate capture" />
                </div>
                <div class={tile}>
                  <span class={sectionLabel}>diff overlay</span>
                  <span class={hint}>red = changed pixel</span>
                  <img class="w-full rounded-lg border border-solid border-line bg-surface-sunken" src={d().dataUrl} alt="pixel diff overlay" />
                </div>
              </div>

              <div class={row}>
                <a class={btn} href={d().dataUrl} download={`diff-${candidate() || 'capture'}`}>Download diff</a>
                <Show when={d().changedPixels > 0}>
                  <SendToAgent
                    api={p.api}
                    page={`visual-diff:${baseline()}..${candidate()}`}
                    selection={{ mode: 'page', cssPath: `visual-diff:${baseline()}..${candidate()}` }}
                    placeholder={`e.g. ${d().pct.toFixed(1)}% of pixels moved between these two captures — find the regression`}
                  />
                </Show>
              </div>
            </>
          )}
        </Show>

        <details class="rounded-xl border border-solid border-line bg-surface-raised p-3">
          <summary class={`${sectionLabel} cursor-pointer`}>captures on disk ({files().length})</summary>
          <div class="mt-2 flex flex-col gap-1">
            <For each={files()}>{(f) => (
              <span class="font-mono text-[11px] text-ink">{f.name}</span>
            )}</For>
          </div>
        </details>
      </Show>
    </PanelPage>
  )
}
