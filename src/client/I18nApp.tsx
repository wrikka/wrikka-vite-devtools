import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { chip, grid, hint, meter, row, tab, tabBar, tabOn, tile, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { shortPath } from './format'

interface Locale {
  locale: string
  file: string
  keys: number
  missing: string[]
  coverage: number
}

interface I18nReport {
  root: string
  detected: boolean
  used: string[]
  locales: Locale[]
  unused: { locale: string; key: string }[]
  hardcoded: { file: string; text: string }[]
}

type View = 'coverage' | 'missing' | 'unused' | 'hardcoded'

const VIEWS: { key: View; label: string }[] = [
  { key: 'coverage', label: 'coverage' },
  { key: 'missing', label: 'missing keys' },
  { key: 'unused', label: 'unused keys' },
  { key: 'hardcoded', label: 'hardcoded copy' },
]

function coverageClass(value: number): string {
  if (value < 80) return 'bg-bad'
  if (value < 95) return 'bg-warn'
  return 'bg-ok'
}

export interface I18nPanelProps {
  api: PanelApi
  root(): string
}

export default function I18nApp(p: I18nPanelProps) {
  const [report, setReport] = createSignal<I18nReport>()
  const [busy, setBusy] = createSignal(true)
  const [msg, setMsg] = createSignal('reading locale catalogs…')
  const [view, setView] = createSignal<View>('coverage')
  const [locale, setLocale] = createSignal<string>()

  onMount(load)

  async function load(): Promise<void> {
    setBusy(true)
    try {
      const res = (await p.api.call('audit-i18n', {})) as I18nReport
      setReport(res)
      setLocale(res.locales[0]?.locale)
      const missing = res.locales.reduce((n, l) => n + l.missing.length, 0)
      setMsg(`${res.locales.length} locales · ${res.used.length} keys used · ${missing} missing · ${res.hardcoded.length} hardcoded strings`)
    } catch (err) {
      setMsg(`audit failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const active = createMemo(() => report()?.locales.find((l) => l.locale === locale()) ?? report()?.locales[0])
  const unused = createMemo(() => {
    const all = report()?.unused ?? []
    const only = active()?.locale
    return only ? all.filter((u) => u.locale === only) : all
  })

  return (
    <PanelPage>
      <PanelHeader title="i18n" description="per-locale coverage, missing keys, and copy that bypasses translation" busy={busy()} refresh={() => void load()} refreshLabel="Re-audit" />

      <StatStrip items={[
        { value: report()?.locales.length ?? 0, label: 'locales' },
        { value: report()?.used.length ?? 0, label: 'keys used' },
        { value: report()?.locales.reduce((n, l) => n + l.missing.length, 0) ?? 0, label: 'missing keys', tone: (report()?.locales.reduce((n, l) => n + l.missing.length, 0) ?? 0) > 0 ? 'text-bad-ink' : 'text-ink-faint' },
        { value: report()?.hardcoded.length ?? 0, label: 'hardcoded strings', tone: (report()?.hardcoded.length ?? 0) > 0 ? 'text-warn-ink' : 'text-ink-faint' },
      ]} />

      <p class={hint}>{msg()}</p>

      <Show when={!report()?.detected}>
        <EmptyState
          title="No locale catalog detected"
          hint="The audit looks for JSON catalogs under locales/, i18n/, lang/, langs/, messages/ or translations/."
        />
      </Show>

      <div class={tabBar} role="tablist" aria-label="i18n views">
        <For each={VIEWS}>{(v) => (
          <button class={`${tab} ${view() === v.key ? tabOn : ''}`} role="tab" aria-selected={view() === v.key} onClick={() => setView(v.key)}>
            {v.label}
            <span class={hint}>
              {v.key === 'coverage' ? report()?.locales.length ?? 0 : v.key === 'missing' ? active()?.missing.length ?? 0 : v.key === 'unused' ? unused().length : report()?.hardcoded.length ?? 0}
            </span>
          </button>
        )}</For>
      </div>

      <Show when={view() === 'coverage'}>
        <Show when={!busy() && (report()?.locales.length ?? 0) === 0}>
          <EmptyState title="Nothing to chart" hint="No catalogs were parsed." />
        </Show>
        <div class={grid}>
          <For each={report()?.locales ?? []}>{(l) => (
            <button
              class={`${tile} ${active()?.locale === l.locale ? 'border-accent' : ''}`}
              aria-pressed={active()?.locale === l.locale}
              onClick={() => setLocale(l.locale)}
            >
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{l.locale}</span>
                <span class={`${hint} shrink-0`}>{l.keys} keys</span>
              </div>
              <span class={`${hint} truncate font-mono`} title={l.file}>{shortPath(l.file, 3)}</span>
              <div class="flex items-center gap-2">
                <div class={`${meter} flex-1`} role="presentation">
                  <div class={`h-full rounded-full ${coverageClass(l.coverage)}`} style={{ width: `${Math.min(100, l.coverage)}%` }} />
                </div>
                <span class={`${hint} w-10 text-right tabular-nums`}>{l.coverage}%</span>
              </div>
              <div class={row}>
                <Show when={l.missing.length > 0} fallback={<span class={tonePill('ok')}>complete</span>}>
                  <span class={tonePill('bad')}>{l.missing.length} missing</span>
                </Show>
              </div>
            </button>
          )}</For>
        </div>
      </Show>

      <Show when={view() === 'missing'}>
        <Show when={!busy() && (active()?.missing.length ?? 0) === 0}>
          <EmptyState title="No missing keys" hint={`${active()?.locale ?? 'This locale'} covers every key the code calls.`} />
        </Show>
        <div class="flex flex-col gap-1">
          <For each={active()?.missing ?? []}>{(key) => (
            <div class="flex items-center gap-2 rounded-lg border border-solid border-line bg-surface-raised px-2 py-1">
              <span class={tonePill('bad')}>missing</span>
              <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-ink" title={key}>{key}</span>
            </div>
          )}</For>
        </div>
        <Show when={(active()?.missing.length ?? 0) > 0}>
          <SendToAgent
            api={p.api}
            page={active()?.file ?? 'locales'}
            selection={{ mode: 'page', cssPath: active()?.file }}
            placeholder={`e.g. add the missing ${active()?.locale} keys`}
          />
        </Show>
      </Show>

      <Show when={view() === 'unused'}>
        <Show when={!busy() && unused().length === 0}>
          <EmptyState title="No unused keys" hint="Every catalog key is referenced by a `t()` call." />
        </Show>
        <div class={row}>
          <For each={unused()}>{(u) => <span class={`${chip} cursor-default font-mono`} title={u.key}>{u.key}</span>}</For>
        </div>
      </Show>

      <Show when={view() === 'hardcoded'}>
        <Show when={!busy() && (report()?.hardcoded.length ?? 0) === 0}>
          <EmptyState title="No hardcoded copy found" hint="JSX text nodes of 12+ characters all live in catalogs." />
        </Show>
        <div class="flex flex-col gap-1">
          <For each={report()?.hardcoded ?? []}>{(h) => (
            <div class="flex items-start gap-2 rounded-lg border border-solid border-line bg-surface-raised px-2 py-1">
              <span class={tonePill('warn')}>literal</span>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-[12px] text-ink" title={h.text}>“{h.text}”</span>
                <span class={`${hint} truncate font-mono`} title={h.file}>{h.file}</span>
              </div>
            </div>
          )}</For>
        </div>
        <Show when={(report()?.hardcoded.length ?? 0) > 0}>
          <SendToAgent
            api={p.api}
            page={report()?.hardcoded[0]?.file ?? 'src'}
            selection={{ mode: 'page', cssPath: report()?.hardcoded[0]?.file }}
            placeholder="e.g. move these strings into the locale catalogs"
          />
        </Show>
      </Show>
    </PanelPage>
  )
}
