import { connectDevframe } from 'devframe/client'
import { el, mount } from './dom'
import { startPick } from './picker'
import { describe, globalFramework } from './frameworks'
import { pageUrl, type Comment, type Idea, type OverlayApi, type Selection } from './api'
import { openComposer } from './composer'
import { openInbox } from './inbox'
import { openIdeas } from './ideas-ui'
import { openAnnotations } from './annotations'

declare global {
  interface Window {
    __DEVFRA_OVERLAY__?: boolean
  }
}

type Mode = 'element' | 'component' | 'page'

// The hub dock executor calls the module's `default`; direct injection relies on
// the self-call below. Both paths are guarded so the bar mounts exactly once.
export default async function mountOverlay(): Promise<void> {
  if (window.__DEVFRA_OVERLAY__) return
  window.__DEVFRA_OVERLAY__ = true
  await boot()
}

await mountOverlay()

async function boot(): Promise<void> {
  const scope = (await connectDevframe()).scope('use-devfra')
  const rpc = scope.rpc as unknown as {
    call(id: string, args?: unknown): Promise<any>
    streaming: { subscribe<T>(channel: string, id: string): AsyncIterable<T> }
  }
  const api: OverlayApi = {
    call: (id, args) => rpc.call(id, args),
    subscribe: (channel, id) => rpc.streaming.subscribe<string>(channel, id),
  }

  const root = mount('devfra-overlay-host')
  const badge = el('span', { class: 'badge', hidden: true })
  const mode = el('select', { title: 'what to comment on' }, [
    el('option', { value: 'element' }, ['element']),
    el('option', { value: 'component' }, ['component']),
    el('option', { value: 'page' }, ['page']),
  ])
  const commentBtn = el('button', {}, ['Comment'])
  const ideasBtn = el('button', {}, ['Ideas'])
  const inboxBtn = el('button', {}, ['Inbox'])
  const pinsBtn = el('button', { title: 'show / hide annotation pins' }, ['Pins'])
  const annotations = openAnnotations(root)

  root.append(el('div', { class: 'bar' }, [mode, commentBtn, ideasBtn, inboxBtn, pinsBtn, badge]))

  pinsBtn.addEventListener('click', () => {
    pinsBtn.classList.toggle('off', !annotations.toggle())
  })

  commentBtn.addEventListener('click', () => {
    const m = mode.value as Mode
    if (m === 'page') {
      openComposer(api, root, { selection: { mode: 'page', framework: globalFramework(), cssPath: 'html' } })
      return
    }
    startPick({
      hostRoot: root,
      onPick: (_target, info) => openComposer(api, root, { selection: selectionFrom(info, m) }),
      onCancel: () => {},
    })
  })

  ideasBtn.addEventListener('click', () =>
    openIdeas(api, root, (idea) => openComposer(api, root, { prefill: ideaPrefill(idea), selection: pageSelection() })),
  )
  inboxBtn.addEventListener('click', () => openInbox(api, root, updateBadge))

  function updateBadge(n: number): void {
    badge.hidden = n === 0
    badge.textContent = String(n)
  }

  setInterval(() => void poll(), 5000)
  void poll()

  async function poll(): Promise<void> {
    try {
      const { items } = (await api.call('list-comments')) as { items: Comment[] }
      updateBadge(items.filter((c) => c.status === 'queued' || c.status === 'running').length)
      annotations.refresh(items)
    } catch (err) {
      console.warn('[use-devfra] poll failed:', err)
    }
  }
}

function pageSelection(): Selection {
  return { mode: 'page', framework: globalFramework(), cssPath: 'html', tagName: 'html', textPreview: pageUrl() }
}

function selectionFrom(info: ReturnType<typeof describe>, m: 'element' | 'component'): Selection {
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

function ideaPrefill(idea: Idea): string {
  return `Implement: ${idea.title} — ${idea.detail}`
}
