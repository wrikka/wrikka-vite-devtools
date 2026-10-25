import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { chip, chipOn, grid, hint, link, meter, row, tab, tabBar, tabOn, tile, type Tone, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { shortPath } from './format'

type UtilityKind = 'token' | 'allowed' | 'palette' | 'arbitrary' | 'unknown'

interface UtilityRow {
  name: string
  count: number
  files: string[]
  kind: UtilityKind
  dark: boolean
}

interface ThemeReport {
  root: string
  hasTheme: boolean
  tokens: string[]
  scanned: number
  truncated: boolean
  utilities: UtilityRow[]
  violations: UtilityRow[]
}

type View = 'violations' | 'utilities' | 'tokens'

const VIEWS: { key: View; label: string }[] = [
  { key: 'violations', label: 'violations' },
  { key: 'utilities', label: 'all utilities' },
  { key: 'tokens', label: 'tokens' },
]

const KIND_TONE: Record<UtilityKind, Tone> = {
  token: 'ok',
  allowed: 'accent',
  palette: 'bad',
  arbitrary: 'bad',
  unknown: 'warn',
}

export interface ThemePanelProps {
  api: PanelApi
  root(): string
}

/** One tile per utility, so a palette hardcode reads as a red card instead of a table row. */
function UtilityTile(p: { row: UtilityRow; root(): string; api: PanelApi; expanded: boolean; onToggle(): void }) {
  return (
    <div class={tile}>
      <button
        class="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-0 text-left"
        aria-expanded={p.expanded}
        onClick={p.onToggle}
      >
        <div class="flex items-start gap-2">
          <span class="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-ink" title={p.row.name}>
            {p.row.name}
          </span>
          <span class={tonePill(KIND_TONE[p.row.kind])}>{p.row.kind}</span>
        </div>
        <div class={row}>
          <Show when={p.row.dark}>
            <span class={tonePill('warn')}>dark:</span>
          </Show>
          <span class={`${hint} ml-auto`}>{p.row.count} use{p.row.count === 1 ? '' : 's'} · {p.row.files.length} file{p.row.files.length === 1 ? '' : 's'}</span>
        </div>
        <div class={meter} role="presentation">
          <div class={`h-full rounded-full ${KIND_TONE[p.row.kind] === 'bad' ? 'bg-bad' : 'bg-ok'}`} style={{ width: '100%' }} />
        </div>
      </button>
      <Show when={p.expanded}>
        <div class="flex flex-col gap-1.5 border-t border-solid border-line pt-2">
          <p class={`${hint} m-0`}>
            {p.row.kind === 'palette'
              ? 'Stock palette color — map it to the nearest semantic token.'
              : p.row.kind === 'arbitrary'
                ? 'Arbitrary value — bypasses the theme scale.'
                : p.row.kind === 'unknown'
                  ? 'Not declared in the theme and not a known token.'
                  : 'Declared in the theme.'}
          </p>
          <div class="flex flex-col gap-1">
            <For each={p.row.files.slice(0, 6)}>{(file) => (
              <a
                class={`${link} w-fit font-mono text-[11px]`}
                href={`vscode://file/${p.root()}/${file}`}
                title={file}
              >
                {shortPath(file, 3)}
              </a>
            )}</For>
          </div>
          <Show when={p.row.kind === 'palette' || p.row.kind === 'arbitrary'}>
            <SendToAgent
              api={p.api}
              page={p.row.files[0] ?? p.row.name}
              selection={{ mode: 'page', cssPath: p.row.files[0] }}
              placeholder={`e.g. replace ${p.row.name} with a semantic token`}
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default function ThemeApp(p: ThemePanelProps) {
  const [report, setReport] = createSignal<ThemeReport>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('auditing theme usage…')
  const [view, setView] = createSignal<View>('violations')
  const [open, setOpen] = createSignal<string>()

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('audit-theme', {})) as ThemeReport
      setReport(res)
      setMsg(`${res.tokens.length} tokens · ${res.utilities.length} utilities · ${res.violations.length} violations · ${res.scanned} files scanned`)
    } catch (err) {
      setMsg(`audit failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const rows = createMemo<UtilityRow[]>(() => {
    const r = report()
    if (!r) return []
    return view() === 'violations' ? r.violations : r.utilities
  })

  const palette = createMemo(() => (report()?.violations ?? []).filter((v) => v.kind === 'palette').length)

  return (
    <PanelPage>
      <PanelHeader title="Theme & tokens" description="declared tokens vs utilities actually used" busy={busy()} refresh={() => void load()} refreshLabel="Re-audit" />

      <StatStrip items={[
        { value: report()?.tokens.length ?? 0, label: 'theme tokens' },
        { value: report()?.utilities.length ?? 0, label: 'utilities used' },
        { value: report()?.violations.length ?? 0, label: 'violations', tone: (report()?.violations.length ?? 0) > 0 ? 'text-bad-ink' : 'text-ink-faint' },
        { value: palette(), label: 'palette hits', tone: palette() > 0 ? 'text-warn-ink' : 'text-ink-faint' },
      ]} />

      <p class={hint}>{msg()}</p>

      <Show when={!report()?.hasTheme}>
        <EmptyState
          title="No theme declaration found"
          hint="Could not locate a `theme.colors` map or a theme CSS layer — the audit fell back to tokens it could infer."
        />
      </Show>

      <div class={tabBar} role="tablist" aria-label="Theme views">
        <For each={VIEWS}>{(v) => (
          <button class={`${tab} ${view() === v.key ? tabOn : ''}`} role="tab" aria-selected={view() === v.key} onClick={() => setView(v.key)}>
            {v.label}
            <span class={hint}>
              {v.key === 'violations' ? report()?.violations.length ?? 0 : v.key === 'utilities' ? report()?.utilities.length ?? 0 : report()?.tokens.length ?? 0}
            </span>
          </button>
        )}</For>
      </div>

      <Show when={report()?.truncated}>
        <p class={hint}>scan stopped at the file cap — results are partial.</p>
      </Show>

      <Show when={view() === 'tokens'}>
        <div class={row}>
          <For each={report()?.tokens ?? []}>{(token) => <span class={`${chip} cursor-default`}>{token}</span>}</For>
        </div>
      </Show>

      <Show when={view() !== 'tokens'}>
        <Show when={!busy() && rows().length === 0}>
          <EmptyState
            title={view() === 'violations' ? 'No theme violations' : 'No color utilities found'}
            hint="Every color utility in the scan maps to a declared token."
          />
        </Show>
        <div class={grid}>
          <For each={rows()}>{(r) => (
            <UtilityTile
              row={r}
              root={p.root}
              api={p.api}
              expanded={open() === r.name}
              onToggle={() => setOpen(open() === r.name ? undefined : r.name)}
            />
          )}</For>
        </div>
      </Show>
    </PanelPage>
  )
}
