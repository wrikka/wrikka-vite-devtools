import { For, Show, createEffect, createMemo, createSignal, type JSX } from 'solid-js'
import type { Idea, Selection } from '../protocol'
import type { PanelApi } from '../ui/api'
import { chip, hint, tab, tabBar, tabOn } from '../ui/bits'
import Composer from '../ui/Composer'
import Ideas from '../ui/Ideas'
import Inbox from '../ui/Inbox'
import { CommentIcon, ComponentIcon, PanelIcon, PinsIcon } from '../ui/icons'
import { ideaPrefill } from '../ui/prefill'
import { readStashedPage } from '../ui/page-stash'
import Diagnostics from './Diagnostics'
import TargetForm from './TargetForm'

type Tab = 'inbox' | 'new' | 'ideas' | 'diagnostics'
const TABS: { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'inbox', label: 'Inbox', icon: CommentIcon },
  { id: 'new', label: 'New comment', icon: PinsIcon },
  { id: 'ideas', label: 'Ideas', icon: ComponentIcon },
  { id: 'diagnostics', label: 'Diagnostics', icon: PanelIcon },
]

export default function App(p: { api: PanelApi }) {
  const [tab, setTab] = createSignal<Tab>('inbox')
  const [open, setOpen] = createSignal(0)
  const [page, setPage] = createSignal('')
  const [mode, setMode] = createSignal<Selection['mode']>('page')
  const [cssPath, setCssPath] = createSignal('')
  const [prefill, setPrefill] = createSignal<string | undefined>()

  // The pill links here with the target page; the hub drops that query, so fall
  // back to the page the pill stashed on this origin.
  createEffect(() => setPage(new URLSearchParams(location.search).get('page') || readStashedPage()))

  const selection = createMemo<Selection>(() => ({
    mode: mode(),
    cssPath: cssPath() || undefined,
  }))

  function applyIdea(idea: Idea): void {
    setPrefill(ideaPrefill(idea))
    setTab('new')
  }

  return (
    <div class="flex min-h-screen flex-col">
      <header class="border-b border-solid border-line bg-linear-to-br from-accent-soft via-surface-raised to-surface px-4 pt-4 pb-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-xl border border-solid border-line bg-accent-soft text-accent-ink">
            <CommentIcon />
          </span>
          <div class="flex flex-col">
            <h1 class="m-0 text-[15px] font-semibold tracking-tight text-ink">Wrikka devtools</h1>
            <span class={hint}>Point at a node, leave a comment, let the agent run in your repo</span>
          </div>
          <Show when={page()}>
            <span class={`${chip} ml-auto max-w-64 truncate font-mono`} title={page()}>
              {page()}
            </span>
          </Show>
        </div>
        <nav class={`${tabBar} mt-3`} role="tablist" aria-label="Comment workspace">
          <For each={TABS}>
            {(t) => {
              const Icon = t.icon
              return (
                <button
                  class={`${tab} ${tab() === t.id ? tabOn : ''}`}
                  role="tab"
                  aria-selected={tab() === t.id}
                  onClick={() => setTab(t.id)}
                >
                  <Icon />
                  {t.id === 'inbox' && open() > 0 ? `${t.label} (${open()})` : t.label}
                </button>
              )
            }}
          </For>
          <Show when={open() > 0}>
            <span class={`${hint} ml-auto px-2`}>{open()} open</span>
          </Show>
        </nav>
      </header>
      <main class="flex-1 p-4">
        <Show when={tab() === 'inbox'}>
          <Inbox api={p.api} onOpenCount={setOpen} />
        </Show>
        <Show when={tab() === 'new'}>
          <div class="flex flex-col gap-3">
            <TargetForm
              page={() => page()}
              onPage={setPage}
              mode={() => mode()}
              onMode={setMode}
              cssPath={() => cssPath()}
              onCssPath={setCssPath}
            />
            <Show when={page()}>
              <Composer
                api={p.api}
                selection={selection()}
                page={page()}
                prefill={prefill()}
                onClose={() => {
                  setPrefill(undefined)
                  setTab('inbox')
                }}
              />
            </Show>
          </div>
        </Show>
        <Show when={tab() === 'ideas'}>
          <Show when={page()} fallback={<p class={`${hint} py-6 text-center`}>Set the target page url in the “New comment” tab first.</p>}>
            <Ideas api={p.api} page={page()} onApply={applyIdea} />
          </Show>
        </Show>
        <Show when={tab() === 'diagnostics'}>
          <Diagnostics api={p.api} />
        </Show>
      </main>
    </div>
  )
}
