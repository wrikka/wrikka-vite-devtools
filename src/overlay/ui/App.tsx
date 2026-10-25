import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { pageUrl, type Comment, type PanelApi } from '../api'
import { stashPage } from '../../ui/page-stash'
import { Toaster } from '../../ui/toast'
import Pill from './Pill'
import Pins from './Pins'
import QuickComposer from './QuickComposer'

export interface AppProps {
  api: PanelApi
  hub: string
}

/**
 * The in-page affordance is one icon. Clicking it opens a comment box that
 * targets the current route; `@` mentions resolve against scanned routes.
 */
export default function App(p: AppProps) {
  const [open, setOpen] = createSignal(false)
  const [comments, setComments] = createSignal<Comment[]>([])
  const [pinsOn, setPinsOn] = createSignal(true)
  const [viewer, setViewer] = createSignal(false)

  const route = (): string => location.pathname || '/'
  const active = () => comments().filter((c) => c.status === 'queued' || c.status === 'running').length
  const running = () => comments().some((c) => c.status === 'running')

  onMount(() => {
    stashPage(pageUrl())
    void poll()
    void loadRole()
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

  async function loadRole(): Promise<void> {
    try {
      const meta = (await p.api.call('get-meta', {})) as { role?: string }
      setViewer(meta.role === 'viewer')
    } catch {
      /* meta is static; a failure just keeps the operator default */
    }
  }

  function submitted(): void {
    setOpen(false)
    void poll()
  }

  return (
    <>
      <Pins comments={comments()} visible={pinsOn()} />
      <Pill open={open()} active={active()} running={running()} onToggle={() => setOpen((v) => !v)} />
      <Show when={open()}>
        <QuickComposer
          api={p.api}
          route={route()}
          viewer={viewer()}
          pinsOn={pinsOn()}
          hub={`${p.hub}?page=${encodeURIComponent(pageUrl())}`}
          onPins={() => setPinsOn((v) => !v)}
          onClose={() => setOpen(false)}
          onSubmitted={submitted}
        />
      </Show>
      <Toaster />
    </>
  )
}
