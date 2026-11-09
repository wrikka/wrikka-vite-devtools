import { For } from 'solid-js'
import { btn, hint, listRow, panelCard, sectionLabel } from '../ui/bits'
import { Gauge } from '../ui/charts'

export interface Step {
  label: string
  detail: string
  done: boolean
  act?: () => void
  actLabel?: string
}

export interface HomeStepsProps {
  steps: Step[]
  cwd?: string
}

function statusTone(ok: boolean): string {
  return ok ? 'bg-ok' : 'bg-bad'
}

/** Boot-path checklist with a readiness gauge and the workspace path. */
export default function HomeSteps(p: HomeStepsProps) {
  const done = () => p.steps.filter((s) => s.done).length
  return (
    <div class={`${panelCard} lg:col-span-2`}>
      <div class="flex items-center gap-2">
        <span class={sectionLabel}>onboarding</span>
        <span class={`${hint} ml-auto tabular-nums`}>
          {done()}/{p.steps.length} ready
        </span>
      </div>
      <div class="flex justify-center py-1">
        <Gauge value={done()} max={p.steps.length} label="readiness" size={68} />
      </div>
      <For each={p.steps}>
        {(s) => (
          <div class={listRow}>
            <span class={`size-2 shrink-0 rounded-full ${statusTone(s.done)}`} aria-hidden />
            <span class="flex min-w-0 flex-col">
              <span class="text-[12px] font-medium text-ink">{s.label}</span>
              <span class={`${hint} truncate`} title={s.detail}>
                {s.detail}
              </span>
            </span>
            {s.act ? (
              <button class={`${btn} ml-auto shrink-0`} onClick={() => s.act?.()}>
                {s.actLabel}
              </button>
            ) : undefined}
          </div>
        )}
      </For>
      <span class={`${hint} px-1`}>{p.cwd ? `cwd: ${p.cwd}` : 'workspace path unavailable'}</span>
    </div>
  )
}
