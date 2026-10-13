import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { globalFramework } from '../frameworks'
import { pageUrl, type Comment, type Idea, type OverlayApi, type Selection } from '../api'
import { startPick } from '../picker'
import Toolbar, { type ToolbarMode } from './Toolbar'
import Panel from './Panel'
import Composer from './Composer'
import Inbox from './Inbox'
import Ideas from './Ideas'
import Pins from './Pins'

export interface AppProps {
  api: OverlayApi
  root: ShadowRoot
}

interface ComposerState {
  selection: Selection
  prefill?: string
}

function pageSelection(): Selection {
  return { mode: 'page', framework: globalFramework(), cssPath: 'html', tagName: 'html', textPreview: pageUrl() }
}

function ideaPrefill(idea: Idea): string {
  return `Implement: ${idea.title} — ${idea.detail}`
}

export default function App(p: AppProps) {
  const [mode, setMode] = createSignal<ToolbarMode>('element')
  const [comments, setComments] = createSignal<Comment[]>([])
  const [badge, setBadge] = createSignal(0)
  const [pinsOn, setPinsOn] = createSignal(true)
  const [composer, setComposer] = createSignal<ComposerState | undefined>()
  const [showInbox, setShowInbox] = createSignal(false)
  const [showIdeas, setShowIdeas] = createSignal(false)

  onMount(() => {
    void poll()
    const timer = setInterval(() => void poll(), 5000)
    onCleanup(() => clearInterval(timer))
  })

  async function poll(): Promise<void> {
    try {
      const { items } = (await p.api.call('list-comments')) as { items: Comment[] }
      setComments(items)
      setBadge(items.filter((c) => c.status === 'queued' || c.status === 'running').length)
    } catch (err) {
      console.warn('[use-devfra] poll failed:', err)
    }
  }

  // one panel at a time — opening any closes the others
  function openComposerFor(selection: Selection, prefill?: string): void {
    setShowInbox(false)
    setShowIdeas(false)
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

  function onIdeas(): void {
    setComposer(undefined)
    setShowInbox(false)
    setShowIdeas((v) => !v)
  }

  function onInbox(): void {
    setComposer(undefined)
    setShowIdeas(false)
    setShowInbox((v) => !v)
  }

  function applyIdea(idea: Idea): void {
    setShowIdeas(false)
    openComposerFor(pageSelection(), ideaPrefill(idea))
  }

  return (
    <>
      <Pins comments={comments()} visible={pinsOn()} />
      <Toolbar
        mode={mode()}
        onMode={setMode}
        badge={badge()}
        active={composer() ? 'comment' : showIdeas() ? 'ideas' : showInbox() ? 'inbox' : null}
        pinsOn={pinsOn()}
        onComment={onComment}
        onIdeas={onIdeas}
        onInbox={onInbox}
        onPins={() => setPinsOn((v) => !v)}
      />
      <Show when={composer()} keyed>
        {(state) => (
          <Panel title="New comment" onClose={() => setComposer(undefined)}>
            <Composer
              api={p.api}
              selection={state.selection}
              prefill={state.prefill}
              onClose={() => setComposer(undefined)}
            />
          </Panel>
        )}
      </Show>
      <Show when={showInbox()}>
        <Panel title="Comments" onClose={() => setShowInbox(false)}>
          <Inbox api={p.api} />
        </Panel>
      </Show>
      <Show when={showIdeas()}>
        <Panel title="Generate ideas" onClose={() => setShowIdeas(false)}>
          <Ideas api={p.api} onApply={applyIdea} />
        </Panel>
      </Show>
    </>
  )
}
