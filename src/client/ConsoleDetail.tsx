import { Show } from 'solid-js'
import { hint, row, sectionLabel, tonePill } from '../ui/bits'
import { LEVEL_TONE, type Filter } from './console-levels'
import { fmtWhen } from './format'

export interface Line {
  id?: number
  at: number
  level: Filter
  source: 'page' | 'agent'
  text: string
  stack?: string
}

/** Expanded view of one console line, with its stack when the page provided one. */
export default function ConsoleDetail(p: { line: Line }) {
  return (
    <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
      <div class={row}>
        <span class={sectionLabel}>line detail</span>
        <span class={tonePill(LEVEL_TONE[p.line.level])}>{p.line.level}</span>
        <Show when={p.line.source === 'agent'}>
          <span class={tonePill('info')}>agent</span>
        </Show>
        <span class={`${hint} ml-auto`}>{fmtWhen(p.line.at)}</span>
      </div>
      <pre class="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-ink">
        {p.line.text}
      </pre>
      <Show when={p.line.stack}>
        <details class="text-[11px] text-ink-muted">
          <summary class="cursor-pointer text-ink-faint">stack trace</summary>
          <pre class="m-0 mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
            {p.line.stack}
          </pre>
        </details>
      </Show>
    </div>
  )
}
