import { hint, kindTone, panelCard, sectionLabel } from '../ui/bits'
import { BarList } from '../ui/charts'
import Segmented from '../ui/Segmented'
import { StatStrip } from './PanelKit'

export interface RoutesStats {
  routes: number
  dynamic: number
  audited: number
  bad: number
  warn: number
}

export interface RoutesSummaryProps {
  stats: RoutesStats
  counts: Record<string, number>
  kind: string
  onKind(id: string): void
}

const KINDS = ['all', 'layout', 'index', 'page', 'not-found'] as const

/** Headline numbers, the kind distribution, and the kind filter in one band. */
export default function RoutesSummary(p: RoutesSummaryProps) {
  const bars = () =>
    KINDS.filter((k) => k !== 'all').map((k) => ({
      label: k,
      value: p.counts[k] ?? 0,
      tone: kindTone(k),
    }))
  return (
    <>
      <StatStrip
        items={[
          { value: p.stats.routes, label: 'routes' },
          { value: p.stats.dynamic, label: 'with params', hint: 'not fetched' },
          { value: p.stats.audited, label: 'fetched html' },
          {
            value: p.stats.bad,
            label: p.stats.warn > 0 ? `${p.stats.warn} warnings` : 'with issues',
            tone:
              p.stats.bad > 0 ? 'text-bad-ink' : p.stats.warn > 0 ? 'text-warn-ink' : 'text-ink-faint',
          },
        ]}
      />

      <div class={panelCard}>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <span class={sectionLabel}>route kinds</span>
            <BarList items={bars()} emptyLabel="No routes scanned yet." />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class={sectionLabel}>filter</span>
            <Segmented
              items={KINDS.map((k) => ({
                id: k,
                label: k,
                count: k === 'all' ? p.stats.routes : (p.counts[k] ?? 0),
              }))}
              value={p.kind}
              onChange={p.onKind}
              ariaLabel="Filter by route kind"
            />
            <span class={hint}>Counts are route files; the filter below narrows the list.</span>
          </div>
        </div>
      </div>
    </>
  )
}
