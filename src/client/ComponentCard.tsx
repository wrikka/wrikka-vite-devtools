import { For, Show } from 'solid-js'
import type { ComponentRow } from '../rpc/components'
import type { PanelApi } from '../ui/api'
import { chip, hint, kindTone, link, meter, meterTone, row, tile, tileOn, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'

const LOC_LIMIT = 250

export interface ComponentCardProps {
  api: PanelApi
  root(): string
  row: ComponentRow
  expanded: boolean
  onToggle(): void
}

/** One export: identity + LOC health, expanding into refs, exports and the agent hand-off. */
export default function ComponentCard(p: ComponentCardProps) {
  const r = () => p.row
  const locWidth = () => `${Math.min(100, Math.round((r().loc / LOC_LIMIT) * 100))}%`
  return (
    <div class={`${tile} ${p.expanded ? tileOn : ''}`}>
      <button
        class="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-0 text-left"
        aria-expanded={p.expanded}
        onClick={p.onToggle}
      >
        <div class="flex items-start gap-2">
          <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={r().name}>
            {r().name}
          </span>
          <span class={tonePill(kindTone(r().kind))}>{r().kind}</span>
        </div>
        <span class={`${hint} truncate font-mono`} title={r().file}>
          {r().file}
        </span>
        <div class={row}>
          <Show when={r().refs === 0}>
            <span class={tonePill('bad')}>unreferenced</span>
          </Show>
          <Show when={r().loc > LOC_LIMIT}>
            <span class={tonePill('warn')}>split</span>
          </Show>
          <span class={`${hint} ml-auto`}>
            {r().refs} refs · {r().loc} lines
          </span>
        </div>
        <div class={meter} role="presentation">
          <div class={`h-full rounded-full ${meterTone(r().loc)}`} style={{ width: locWidth() }} />
        </div>
      </button>
      <Show when={p.expanded}>
        <div class="flex flex-col gap-1.5 border-t border-solid border-line pt-2">
          <p class={`${hint} m-0`}>
            {r().refs === 0
              ? 'No other file mentions this name — it is either dead code or reached only dynamically.'
              : `Referenced by ${r().refs} other file(s).`}
            {r().loc > LOC_LIMIT
              ? ` At ${r().loc} lines this file is past the ${LOC_LIMIT}-line limit.`
              : ''}
          </p>
          <div class={row}>
            <span class={hint}>exports:</span>
            <For each={r().exports}>{(name) => <span class={chip}>{name}</span>}</For>
          </div>
          <a
            class={`${link} w-fit text-[11px]`}
            href={`vscode://file/${p.root()}/${r().file}`}
            aria-label={`Open ${r().file} in the editor`}
          >
            open in editor
          </a>
          <SendToAgent
            api={p.api}
            page={r().file}
            selection={{ mode: 'component', componentLabel: r().name, cssPath: r().file }}
            placeholder={`e.g. split ${r().name} into smaller pieces`}
          />
        </div>
      </Show>
    </div>
  )
}
