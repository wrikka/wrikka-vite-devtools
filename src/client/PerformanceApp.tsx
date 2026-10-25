import { For, Show, createMemo } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { grid, hint, row, sectionLabel, tile, tonePill, type Tone } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { EmptyState, PanelHeader, PanelPage, StatStrip } from './PanelKit'
import { fmtMs, fmtWhen } from './format'
import { bool, createRuntimeFeed, num, str } from './runtimeFeed'

interface Grade {
  label: string
  tone: Tone
}

const TIMING_METRICS = [
  { key: 'first-contentful-paint', label: 'FCP', budget: '≤ 1.8s good' },
  { key: 'lcp', label: 'LCP', budget: '≤ 2.5s good' },
  { key: 'cls', label: 'CLS', budget: '≤ 0.1 good' },
  { key: 'ttfb', label: 'TTFB', budget: '≤ 800ms good' },
  { key: 'domContentLoaded', label: 'DOMContentLoaded', budget: 'no budget' },
  { key: 'load', label: 'load', budget: 'no budget' },
]

function grade(metric: string, value: number): Grade {
  if (metric === 'lcp') {
    return value <= 2500 ? { label: 'good', tone: 'ok' } : value <= 4000 ? { label: 'needs work', tone: 'warn' } : { label: 'poor', tone: 'bad' }
  }
  if (metric === 'first-contentful-paint') {
    return value <= 1800 ? { label: 'good', tone: 'ok' } : value <= 3000 ? { label: 'needs work', tone: 'warn' } : { label: 'poor', tone: 'bad' }
  }
  if (metric === 'cls') {
    return value <= 0.1 ? { label: 'good', tone: 'ok' } : value <= 0.25 ? { label: 'needs work', tone: 'warn' } : { label: 'poor', tone: 'bad' }
  }
  if (metric === 'ttfb') {
    return value <= 800 ? { label: 'good', tone: 'ok' } : value <= 1800 ? { label: 'needs work', tone: 'warn' } : { label: 'poor', tone: 'bad' }
  }
  return { label: 'timing', tone: 'info' }
}

export default function PerformanceApp(p: { api: PanelApi }) {
  const feed = createRuntimeFeed(p.api, undefined, 500)

  const vitals = createMemo(() => {
    const seen = new Map<string, number>()
    let cls = 0
    for (const ev of feed.events()) {
      if (ev.kind !== 'vital') continue
      const metric = str(ev.data, 'metric')
      const value = num(ev.data, 'value')
      if (metric === 'cls') {
        cls += value
        continue
      }
      // LCP keeps growing while the page settles, so the newest (largest) is the useful one.
      if (metric === 'lcp') seen.set(metric, Math.max(seen.get(metric) ?? 0, value))
      else if (!seen.has(metric) && metric !== 'first-paint') seen.set(metric, value)
    }
    if (cls > 0) seen.set('cls', Number(cls.toFixed(3)))
    return TIMING_METRICS.filter((m) => seen.has(m.key)).map((m) => {
      const value = seen.get(m.key) ?? 0
      return { ...m, value, grade: grade(m.key, value) }
    })
  })

  const slowRequests = createMemo(() =>
    feed.events()
      .filter((ev) => ev.kind === 'network' && (bool(ev.data, 'slow') || num(ev.data, 'durationMs') >= 1000))
      .sort((a, b) => num(b.data, 'durationMs') - num(a.data, 'durationMs'))
      .slice(0, 8),
  )

  const headline = createMemo(() => {
    const byKey = new Map(vitals().map((v) => [v.key, v]))
    return {
      lcp: byKey.get('lcp'),
      cls: byKey.get('cls'),
      ttfb: byKey.get('ttfb'),
    }
  })

  const poor = createMemo(() => vitals().filter((v) => v.grade.tone === 'bad').length)

  return (
    <PanelPage>
      <PanelHeader
        title="Performance"
        description="Web Vitals and slow requests measured in the page"
        busy={feed.busy()}
        refresh={() => void feed.reload()}
        refreshLabel="Refresh"
      />

      <StatStrip
        items={[
          {
            value: headline().lcp ? fmtMs(headline().lcp?.value) : '—',
            label: 'LCP',
            tone: headline().lcp?.grade.tone === 'ok' ? 'text-ok-ink' : headline().lcp?.grade.tone === 'bad' ? 'text-bad-ink' : 'text-warn-ink',
          },
          {
            value: headline().cls?.value.toFixed(3) ?? '—',
            label: 'CLS',
            tone: headline().cls?.grade.tone === 'ok' ? 'text-ok-ink' : headline().cls?.grade.tone === 'bad' ? 'text-bad-ink' : 'text-warn-ink',
          },
          { value: headline().ttfb ? fmtMs(headline().ttfb?.value) : '—', label: 'TTFB' },
          { value: slowRequests().length, label: 'slow requests', tone: slowRequests().length > 0 ? 'text-warn-ink' : undefined },
        ]}
      />

      <p class={hint}>{feed.msg()}</p>

      <Show
        when={vitals().length > 0}
        fallback={
          <EmptyState
            title="No vitals yet"
            hint="Reload the app once so the overlay can observe paint and navigation timing, then come back."
          />
        }
      >
        <div class={grid}>
          <For each={vitals()}>{(v) => (
            <div class={tile}>
              <div class={row}>
                <span class="font-mono text-[12px] font-semibold text-ink">{v.label}</span>
                <span class={`${tonePill(v.grade.tone)} ml-auto`}>{v.grade.label}</span>
              </div>
              <span class="text-[18px] font-semibold leading-none tabular-nums text-ink">
                {v.key === 'cls' ? v.value.toFixed(3) : fmtMs(v.value)}
              </span>
              <span class={hint}>{v.budget}</span>
            </div>
          )}</For>
        </div>
      </Show>

      <Show when={slowRequests().length > 0}>
        <div class="flex flex-col gap-1.5 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
          <span class={sectionLabel}>slowest requests</span>
          <For each={slowRequests()}>{(ev) => (
            <div class={row}>
              <span class={tonePill(num(ev.data, 'durationMs') >= 1000 ? 'bad' : 'warn')}>
                {fmtMs(num(ev.data, 'durationMs'))}
              </span>
              <span class="min-w-0 flex-1 truncate font-mono text-[11px] text-ink" title={str(ev.data, 'url')}>
                {str(ev.data, 'url')}
              </span>
              <span class={`${hint} shrink-0`}>{fmtWhen(ev.at)}</span>
            </div>
          )}</For>
        </div>
      </Show>

      <Show when={poor() > 0 || slowRequests().length > 0}>
        <SendToAgent
          api={p.api}
          page="/"
          selection={{ mode: 'page', cssPath: '/' }}
          placeholder={
            poor() > 0
              ? `e.g. improve LCP (${fmtMs(headline().lcp?.value)}) and explain what blocks paint`
              : 'e.g. why are these requests slow — find the bottleneck'
          }
        />
      </Show>
    </PanelPage>
  )
}
