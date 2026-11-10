import { Show, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { hint, tonePill } from '../ui/bits'
import { PANEL_GLYPHS } from '../ui/panel-icons'
import type { PanelApi } from '../ui/api'
import { useAccess } from '../ui/access-store'
import { CATEGORY_LABEL, CATEGORY_TINT, hubBase, panelForHash } from './panel-catalog'
import { openDock } from './hub-link'

export interface ShellProps {
  hash: () => string
  api: PanelApi
  children: JSX.Element
}

/**
 * Slim chrome above every panel: the hub rail already lists the docks, so this
 * only carries a way back to Home, the current panel's identity, and the role.
 */
export default function Shell(p: ShellProps) {
  const panel = () => panelForHash(p.hash())
  const isHome = () => p.hash().replace(/^#\//, '') === 'home'
  const title = () => (isHome() ? 'Home' : (panel()?.title ?? 'Comments'))
  const routeKey = () => {
    const key = p.hash().replace(/^#\//, '')
    return key === 'comments' ? '' : key
  }
  const glyph = () => PANEL_GLYPHS[isHome() ? 'home' : routeKey()]
  const access = useAccess(p.api)
  return (
    <div class="flex min-h-screen flex-col">
      <header class="sticky top-0 z-20 flex items-center gap-1.5 border-b border-solid border-line bg-surface/95 px-3 py-1.5 backdrop-blur">
        <button
          class="flex cursor-pointer items-center gap-1 rounded-md border border-solid border-transparent px-1.5 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-control hover:text-ink focus-visible:bg-control focus-visible:text-ink focus-visible:outline-none aria-[current=page]:bg-control aria-[current=page]:text-ink"
          aria-current={isHome() ? 'page' : undefined}
          onClick={() => void openDock('home', 'home')}
          title="Back to Home"
        >
          <span aria-hidden>⌂</span> Home
        </button>
        <span class="text-[11px] text-ink-faint" aria-hidden>
          /
        </span>
        <span class="flex size-4.5 shrink-0 items-center justify-center overflow-hidden">
          <Show
            when={glyph()}
            fallback={
              <span
                class={`flex size-full items-center justify-center rounded text-[8px] font-bold ${panel() ? CATEGORY_TINT[panel()!.category] : 'bg-control text-ink-muted'}`}
                aria-hidden
              >
                {panel()?.monogram ?? '·'}
              </span>
            }
          >
            <span class="flex size-full items-center justify-center text-ink-muted" aria-hidden>
              <Dynamic component={glyph()!} />
            </span>
          </Show>
        </span>
        <span class="text-[12px] font-semibold text-ink" title={panel()?.description}>
          {title()}
        </span>
        <Show when={panel()}>
          {(info) => <span class={`${hint} hidden sm:inline`}>{CATEGORY_LABEL[info().category]}</span>}
        </Show>
        <span
          class={`${tonePill(access.readOnly() ? 'warn' : 'ok')} ml-auto`}
          title={access.readOnly() ? 'Read-only session: write actions are disabled' : 'Full access session'}
        >
          {access.role()}
        </span>
        <a
          class={`${hint} no-underline transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none`}
          href={hubBase()}
          target="_blank"
          rel="noreferrer"
          title="Open the hub in a new tab"
        >
          hub ↗
        </a>
      </header>
      <main class="min-w-0 flex-1">{p.children}</main>
    </div>
  )
}
