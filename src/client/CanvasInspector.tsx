import { Show } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, field, hint, link, sectionLabel, tonePill } from '../ui/bits'
import { ExternalIcon, RefreshIcon } from '../ui/icons'
import SendToAgent from '../ui/SendToAgent'
import type { BoardFrame } from './canvas-board'

export interface CanvasInspectorProps {
  api: PanelApi
  /** Absolute project root, so editor links resolve. */
  root(): string
  frame?: BoardFrame
  /** Same-origin URL of the real page, when the path has no unfilled params. */
  liveHref?: string
  override: string
  onOverride(value: string): void
  onReload(): void
}

/** Right rail: what the picked frame is, and the one-line instruction that edits it. */
export default function CanvasInspector(p: CanvasInspectorProps) {
  const samplePath = () => p.frame?.path.replace(/\$\w+/g, 'sample').replace(/\[\w+\]/g, 'sample') ?? ''
  return (
    <aside class="flex w-64 shrink-0 flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-2.5">
      <Show
        when={p.frame}
        fallback={<p class={`${hint} m-0`}>Click a frame to inspect it. Double-click zooms to it.</p>}
      >
        {(f) => (
          <>
            <span class="flex items-center gap-1.5">
              <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={f().label}>
                {f().label}
              </span>
              <span class={tonePill(f().kind === 'page' ? 'ok' : 'accent')}>{f().badge}</span>
            </span>
            <span class={`${hint} truncate font-mono`} title={f().file}>
              {f().file}
            </span>
            <p class={`${hint} m-0`}>{f().note}</p>

            <div class="flex flex-wrap items-center gap-2">
              <Show
                when={p.liveHref}
                fallback={<span class={hint}>fill params to open the page</span>}
              >
                {(href) => (
                  <a
                    class={`${link} flex items-center gap-1 text-[11px]`}
                    href={href()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open live <ExternalIcon />
                  </a>
                )}
              </Show>
              <button class={`${btn} flex items-center gap-1`} onClick={p.onReload}>
                <RefreshIcon /> reload preview
              </button>
            </div>

            <Show when={f().params.length > 0}>
              <label class="flex flex-col gap-1">
                <span class={sectionLabel}>Path override</span>
                <input
                  class={`${field} font-mono`}
                  aria-label="Path override for the live preview"
                  placeholder={samplePath()}
                  value={p.override}
                  onInput={(e) => p.onOverride(e.currentTarget.value)}
                />
                <span class={hint}>Fill the route params to preview a real page.</span>
              </label>
            </Show>

            <a
              class={`${link} w-fit text-[11px]`}
              href={`vscode://file/${p.root()}/${f().file}`}
              aria-label={`Open ${f().file} in the editor`}
            >
              open in editor
            </a>
            <div class="mt-auto">
              <SendToAgent
                api={p.api}
                page={f().file}
                selection={
                  f().kind === 'page'
                    ? { mode: 'page', componentLabel: f().label, cssPath: f().file }
                    : { mode: 'component', componentLabel: f().label, cssPath: f().file }
                }
                placeholder={`e.g. rework ${f().label}`}
              />
            </div>
          </>
        )}
      </Show>
    </aside>
  )
}
