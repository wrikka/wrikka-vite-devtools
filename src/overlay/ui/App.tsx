import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { globalFramework, type ElementInfo } from '../frameworks'
import { capturePage, pageUrl, type Comment, type PanelApi, type Selection } from '../api'
import { startPick } from '../picker'
import { stashPage } from '../../ui/page-stash'
import Pill, { type PillMode } from './Pill'
import Panel from './Panel'
import Menu, { type MenuAction } from './Menu'
import SearchPanel, { type SearchScope } from './SearchPanel'
import Composer from '../../ui/Composer'
import Pins from './Pins'

export interface AppProps {
  api: PanelApi
  root: ShadowRoot
  hub: string
}

interface ComposerState {
  selection: Selection
  prefill?: string
}

interface SearchState {
  query: string
  scope: SearchScope
}

function pageSelection(): Selection {
  return { mode: 'page', framework: globalFramework(), cssPath: 'html', tagName: 'html', textPreview: pageUrl() }
}

/** The most source-like identifier of a picked element, best guess first. */
function deriveQuery(info: ElementInfo): string {
  if (info.componentLabel) return info.componentLabel
  const attr = (name: string): string | undefined =>
    new RegExp(`(?:^|\\s)${name}=(\\S+)`).exec(info.attributes)?.[1]
  const testid = attr('data-testid')
  if (testid) return testid
  const id = attr('id')
  if (id) return id
  const token = (attr('class') ?? '').split(/\s+/).filter((t) => t.length >= 4)[0]
  if (token) return token
  return info.tagName
}

export default function App(p: AppProps) {
  const [mode, setMode] = createSignal<PillMode>('element')
  const [comments, setComments] = createSignal<Comment[]>([])
  const [pinsOn, setPinsOn] = createSignal(true)
  const [composer, setComposer] = createSignal<ComposerState | undefined>()
  const [menu, setMenu] = createSignal<{ x: number; y: number; info: ElementInfo } | undefined>()
  const [search, setSearch] = createSignal<SearchState | undefined>()

  const active = () => comments().filter((c) => c.status === 'queued' || c.status === 'running').length
  const running = () => comments().some((c) => c.status === 'running')

  onMount(() => {
    stashPage(pageUrl())
    void poll()
    const timer = setInterval(() => void poll(), 5000)
    onCleanup(() => clearInterval(timer))
  })

  async function poll(): Promise<void> {
    try {
      const { items } = (await p.api.call('list-comments')) as { items: Comment[] }
      setComments(items)
    } catch (err) {
      console.warn('[wrikka-vite-devtools] poll failed:', err)
    }
  }

  function openComposerFor(selection: Selection, prefill?: string): void {
    setComposer({ selection, prefill })
  }

  function selectionFor(m: PillMode, info: ElementInfo): Selection {
    return {
      mode: m,
      framework: info.framework,
      componentLabel: m === 'component' ? info.componentLabel : undefined,
      tagName: info.tagName,
      cssPath: info.cssPath,
      textPreview: info.textPreview,
      attributes: info.attributes,
    }
  }

  function pick(after: (info: ElementInfo, point: { x: number; y: number }) => void): void {
    startPick({
      hostRoot: p.root,
      onPick: (_target, info, point) => after(info, point),
      onCancel: () => {},
    })
  }

  /** The search icon opens scope choices; commenting opens the composer straight away. */
  function actions(info: ElementInfo): MenuAction[] {
    const q = deriveQuery(info)
    return [
      { id: 'local', label: `“${q}” anywhere in source`, run: () => runSearch('local', q) },
      { id: 'component', label: `“${q}” in components`, run: () => runSearch('components', q) },
      { id: 'route', label: `“${q}” in routes`, run: () => runSearch('routes', q) },
    ]
  }

  function runSearch(scope: SearchScope, query: string): void {
    setMenu(undefined)
    setSearch({ query, scope })
  }

  function onComment(): void {
    if (composer()) {
      setComposer(undefined)
      return
    }
    if (mode() === 'page') {
      openComposerFor(pageSelection())
      return
    }
    pick((info) => openComposerFor(selectionFor(mode(), info)))
  }

  function onSearch(): void {
    if (mode() === 'page') {
      setSearch({ query: new URL(pageUrl()).pathname.replace(/^\//, '') || pageUrl(), scope: 'routes' })
      return
    }
    pick((info, point) => setMenu({ x: point.x, y: point.y, info }))
  }

  return (
    <>
      <Pins comments={comments()} visible={pinsOn()} />
      <Pill
        mode={mode()}
        onMode={setMode}
        active={active()}
        running={running()}
        composerOpen={composer() !== undefined}
        pinsOn={pinsOn()}
        hub={`${p.hub}?page=${encodeURIComponent(pageUrl())}`}
        onComment={onComment}
        onSearch={onSearch}
        onPins={() => setPinsOn((v) => !v)}
      />
      <Show when={menu()} keyed>
        {(m) => <Menu x={m.x} y={m.y} actions={actions(m.info)} onClose={() => setMenu(undefined)} />}
      </Show>
      <Show when={composer()} keyed>
        {(state) => (
          <Panel title="New comment" onClose={() => setComposer(undefined)}>
            <Composer
              api={p.api}
              selection={state.selection}
              page={pageUrl()}
              prefill={state.prefill}
              capture={capturePage}
              onClose={() => setComposer(undefined)}
            />
          </Panel>
        )}
      </Show>
      <Show when={search()} keyed>
        {(s) => (
          <Panel title="Search source" onClose={() => setSearch(undefined)}>
            <SearchPanel api={p.api} query={s.query} scope={s.scope} onScope={(scope) => setSearch({ query: s.query, scope })} />
          </Panel>
        )}
      </Show>
    </>
  )
}
