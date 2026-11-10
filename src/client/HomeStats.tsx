import { createMemo, Show } from 'solid-js'
import type { Comment } from '../protocol'
import { hint, panelCard, sectionLabel, type Tone } from '../ui/bits'
import { BarList } from '../ui/charts'
import { StatStrip, type StatItem } from './PanelKit'

export interface HomeStatsProps {
  docks: number
  backend?: string
  mcpTools?: number
  mcpOk?: boolean
  routes?: number
  routesDetected?: string
  comments: Comment[]
  openCount: number
}

const STATUS_ORDER = ['queued', 'running', 'done', 'failed'] as const
const STATUS_TONE: Record<string, Tone> = {
  queued: 'warn',
  running: 'info',
  done: 'ok',
  failed: 'bad',
}

/** Comment timestamps binned across their own min..max span — a shape, not a clock. */
function commentSpark(list: Comment[], bins = 16): number[] {
  const times = list.map((c) => Date.parse(c.createdAt)).filter((t) => Number.isFinite(t))
  if (times.length < 2) return []
  const min = Math.min(...times)
  const max = Math.max(...times)
  if (max === min) return times.map(() => 1)
  const out = Array.from({ length: bins }, () => 0)
  for (const t of times) {
    const i = Math.min(bins - 1, Math.floor(((t - min) / (max - min)) * bins))
    out[i] = (out[i] ?? 0) + 1
  }
  return out
}

/** Headline stat cards — every number comes from a call Home already makes. */
export default function HomeStats(p: HomeStatsProps) {
  const items = createMemo<StatItem[]>(() => [
    { value: p.docks, label: 'docks', hint: p.backend },
    {
      value: p.mcpTools ?? '—',
      label: 'MCP tools',
      hint: p.mcpOk ? 'reachable' : 'endpoint down',
      tone: p.mcpOk ? undefined : 'text-bad-ink',
    },
    {
      value: p.routes ?? '—',
      label: 'routes',
      hint: p.routesDetected === 'none' ? 'no router detected' : p.routesDetected,
      tone: p.routesDetected === 'none' ? 'text-ink-faint' : undefined,
    },
    {
      value: p.comments.length,
      label: p.openCount > 0 ? `${p.openCount} open` : 'comments',
      hint: p.comments.length > 0 ? 'captured by the overlay' : undefined,
      tone: p.openCount > 0 ? 'text-warn-ink' : undefined,
      spark: commentSpark(p.comments),
    },
  ])

  return <StatStrip items={items()} />
}

/** Comment-status mix card, sized to sit in the right-hand column next to onboarding. */
export function CommentPipeline(p: { comments: Comment[] }) {
  const bars = createMemo(() =>
    STATUS_ORDER.map((status) => ({
      label: status,
      value: p.comments.filter((c) => c.status === status).length,
      tone: STATUS_TONE[status],
    })).filter((b) => b.value > 0),
  )
  return (
    <Show when={bars().length > 0}>
      <section class={panelCard}>
        <div class="flex items-center gap-2">
          <span class={sectionLabel}>comment pipeline</span>
          <span class={`${hint} ml-auto`}>{p.comments.length} captured</span>
        </div>
        <BarList items={bars()} />
      </section>
    </Show>
  )
}
