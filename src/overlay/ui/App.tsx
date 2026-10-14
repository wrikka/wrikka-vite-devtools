import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { globalFramework } from '../frameworks'
import { capturePage, pageUrl, type Comment, type PanelApi, type Selection } from '../api'
import { startPick } from '../picker'
import { stashPage } from '../../ui/page-stash'
import Pill, { type PillMode } from './Pill'
import Panel from './Panel'
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

function pageSelection(): Selection {
  return { mode: 'page', framework: globalFramework(), cssPath: 'html', tagName: 'html', textPreview: pageUrl() }
}

export default function App(p: AppProps) {
  const [mode, setMode] = createSignal<PillMode>('element')
  const [comments, setComments] = createSignal<Comment[]>([])
  const [pinsOn, setPinsOn] = createSignal(true)
  const [composer, setComposer] = createSignal<ComposerState | undefined>()

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

  function onComment(): void {
    if (composer()) {
      setComposer(undefined)
      return
    }
    const m = mode()
    if (m === 'page') {
      openComposerFor(pageSelection())
      return
    }
    startPick({
      hostRoot: p.root,
      onPick: (_target, info) =>
        openComposerFor({
          mode: m,
          framework: info.framework,
          componentLabel: m === 'component' ? info.componentLabel : undefined,
          tagName: info.tagName,
          cssPath: info.cssPath,
          textPreview: info.textPreview,
          attributes: info.attributes,
        }),
      onCancel: () => {},
    })
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
        onPins={() => setPinsOn((v) => !v)}
      />
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
    </>
  )
}
