import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { Idea, Selection } from '../protocol'
import type { PanelApi } from '../ui/api'
import { btn, btnActive } from '../ui/bits'
import Composer from '../ui/Composer'
import Ideas from '../ui/Ideas'
import Inbox from '../ui/Inbox'
import { ideaPrefill } from '../ui/prefill'
import { readStashedPage } from '../ui/page-stash'
import Diagnostics from './Diagnostics'
import TargetForm from './TargetForm'

type Tab = 'inbox' | 'new' | 'ideas' | 'diagnostics'
const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'new', label: 'New comment' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'diagnostics', label: 'Diagnostics' },
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
      <nav class="flex flex-wrap gap-1 border-b border-solid border-[#3a3d46] bg-[#17181d] p-2" role="tablist">
        <For each={TABS}>
          {(t) => (
            <button
              class={`${btn} ${tab() === t.id ? btnActive : ''}`}
              role="tab"
              aria-selected={tab() === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.id === 'inbox' && open() > 0 ? `${t.label} (${open()})` : t.label}
            </button>
          )}
        </For>
      </nav>
      <main class="flex-1 p-3">
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
          <Show when={page()} fallback={<p class="text-[12px] text-[#9aa0ab]">Set the target page url in the “New comment” tab first.</p>}>
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
