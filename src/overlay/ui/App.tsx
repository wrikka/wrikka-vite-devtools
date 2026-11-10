import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { pageUrl, type Comment, type PanelApi } from '../api'
import { stashPage } from '../../ui/page-stash'
import { Toaster } from '../../ui/toast'
import { applyChatShift, clearChatShift } from '../page-shift'
import { registerChatControl } from '../chat-control'
import Pill from './Pill'
import ChatPill from './ChatPill'
import Pins from './Pins'
import QuickComposer from './QuickComposer'
import ChatPanel from './ChatPanel'

export interface AppProps {
  api: PanelApi
  hub: string
}

/**
 * The in-page affordance is one icon. Clicking it opens a comment box that
 * targets the current route; `@` mentions resolve against scanned routes.
 * The chat pill opens a sidebar that pushes the page right and turns the
 * comment thread into a conversation with the agent.
 */
export default function App(p: AppProps) {
  const [open, setOpen] = createSignal(false)
  const [comments, setComments] = createSignal<Comment[]>([])
  const [pinsOn, setPinsOn] = createSignal(true)
  const [viewer, setViewer] = createSignal(false)
  const [chatOpen, setChatOpen] = createSignal(false)
  const [chatMounted, setChatMounted] = createSignal(false)
  const [chatFull, setChatFull] = createSignal(false)
  let chatTimer: ReturnType<typeof setTimeout> | undefined

  const route = (): string => location.pathname || '/'
  const active = () => comments().filter((c) => c.status === 'queued' || c.status === 'running').length
  const running = () => comments().some((c) => c.status === 'running')

  onMount(() => {
    stashPage(pageUrl())
    registerChatControl({ open: openChat, close: closeChat })
    void poll()
    void loadRole()
    const timer = setInterval(() => void poll(), 5000)
    onCleanup(() => {
      clearInterval(timer)
      registerChatControl(undefined)
      clearTimeout(chatTimer)
    })
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

  function openChat(): void {
    clearTimeout(chatTimer)
    setChatMounted(true)
    setChatOpen(true)
    setChatFull(false)
    applyChatShift()
  }

  function closeChat(): void {
    if (!chatOpen()) return
    setChatOpen(false)
    setChatFull(false)
    clearChatShift()
    // The panel stays mounted (parked off-screen left) until the slide finishes.
    chatTimer = setTimeout(() => setChatMounted(false), 340)
  }

  // Fullscreen drops the page shift and covers the viewport; docking restores it.
  function toggleChatFull(): void {
    const next = !chatFull()
    setChatFull(next)
    if (next) clearChatShift()
    else applyChatShift()
  }

  function toggleChat(): void {
    if (chatOpen()) closeChat()
    else openChat()
  }

  return (
    <>
      <Pins comments={comments()} visible={pinsOn()} />
      <Pill open={open()} active={active()} running={running()} onToggle={() => setOpen((v) => !v)} />
      <ChatPill open={chatOpen()} active={active()} running={running()} onToggle={toggleChat} />
      <Show when={open()}>
        <QuickComposer
          api={p.api}
          route={route()}
          viewer={viewer()}
          pinsOn={pinsOn()}
          chatOpen={chatOpen()}
          hub={`${p.hub}?page=${encodeURIComponent(pageUrl())}`}
          onPins={() => setPinsOn((v) => !v)}
          onChat={openChat}
          onClose={() => setOpen(false)}
          onSubmitted={submitted}
        />
      </Show>
      <Show when={chatMounted()}>
        <ChatPanel
          api={p.api}
          route={route()}
          viewer={viewer()}
          comments={comments()}
          open={chatOpen()}
          full={chatFull()}
          onToggleFull={toggleChatFull}
          onClose={closeChat}
          onSubmitted={() => void poll()}
        />
      </Show>
      <Toaster />
    </>
  )
}
