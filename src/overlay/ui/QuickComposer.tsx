import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { btn, btnPrimary, chip, chipOn, field, hint, row } from '../../ui/bits'
import { PinsIcon, PanelIcon } from '../../ui/icons'
import { showToast } from '../../ui/toast'
import { readDraft, stashDraft } from '../../ui/draft-stash'
import { pageUrl, type PanelApi } from '../api'
import { globalFramework } from '../frameworks'

interface RouteHit {
  path: string
  kind?: string
}

export interface QuickComposerProps {
  api: PanelApi
  /** Current page path — the default target and the first route suggestion. */
  route: string
  viewer: boolean
  pinsOn: boolean
  hub: string
  onPins(): void
  onClose(): void
  onSubmitted(): void
}

const QUICK_STARTS = ['Improve the UX/UI here: ', 'Fix a bug here: ', 'Add tests for this page: ']

/** Same-origin paths already linked from the page, when the project has no route scanner. */
function fallbackRoutes(route: string): RouteHit[] {
  const paths = new Set<string>([route])
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    try {
      const url = new URL(a.href)
      if (url.origin !== location.origin || /(^|\/)__/.test(url.pathname)) continue
      paths.add(url.pathname)
    } catch {
      /* ignore malformed hrefs */
    }
  }
  return [...paths].slice(0, 12).map((path) => ({ path }))
}

export default function QuickComposer(p: QuickComposerProps) {
  let ta!: HTMLTextAreaElement
  const [text, setText] = createSignal('')
  const [kind, setKind] = createSignal<'comment' | 'idea'>('comment')
  const [routes, setRoutes] = createSignal<RouteHit[]>([])
  const [mention, setMention] = createSignal<{ start: number; query: string }>()
  const [cursor, setCursor] = createSignal(0)
  const [msg, setMsg] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const page = pageUrl()

  onMount(() => {
    const draft = readDraft(page)
    if (draft?.body) setText(draft.body)
    ta.focus()
    void loadRoutes()
  })

  async function loadRoutes(): Promise<void> {
    try {
      const res = (await p.api.call('list-routes', {})) as { routes: { path: string; kind: string }[] }
      const hits = res.routes.length ? res.routes.map((r) => ({ path: r.path, kind: r.kind })) : fallbackRoutes(p.route)
      setRoutes(mergeRoute(p.route, hits))
    } catch {
      setRoutes(fallbackRoutes(p.route))
    }
  }

  function mergeRoute(route: string, hits: RouteHit[]): RouteHit[] {
    const seen = new Set<string>()
    return [{ path: route }, ...hits].filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)))
  }

  const suggestions = createMemo(() => routes().filter((r) => r.path !== p.route).slice(0, 4))

  const mentionList = createMemo(() => {
    const m = mention()
    if (!m) return []
    const q = m.query.toLowerCase()
    return routes()
      .filter((r) => r.path.toLowerCase().includes(q))
      .slice(0, 6)
  })

  function syncMention(): void {
    const pos = ta.selectionStart ?? 0
    const before = ta.value.slice(0, pos)
    const at = before.lastIndexOf('@')
    if (at < 0) return setMention(undefined)
    const token = before.slice(at + 1)
    const boundary = at === 0 || /\s/.test(before[at - 1]!)
    if (!boundary || /\s/.test(token)) return setMention(undefined)
    setMention({ start: at, query: token })
    setCursor(0)
  }

  function insertRoute(path: string): void {
    const m = mention()
    if (!m) return
    const pos = ta.selectionStart ?? ta.value.length
    const token = `@${path} `
    ta.value = ta.value.slice(0, m.start) + token + ta.value.slice(pos)
    setText(ta.value)
    setMention(undefined)
    const next = m.start + token.length
    ta.setSelectionRange(next, next)
    ta.focus()
    stashDraft(page, { body: ta.value, skills: [] })
  }

  function append(text: string): void {
    ta.value = ta.value ? `${ta.value.replace(/\s+$/, '')}\n${text}` : text
    setText(ta.value)
    ta.focus()
    stashDraft(page, { body: ta.value, skills: [] })
  }

  function onKey(e: KeyboardEvent): void {
    const list = mentionList()
    if (mention() && list.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setCursor((c) => (c + step + list.length) % list.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertRoute(list[cursor()]!.path)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(undefined)
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!busy()) void submit()
    }
  }

  async function submit(): Promise<void> {
    const body = text().trim()
    if (!body) {
      setMsg('write something first')
      return
    }
    if (p.viewer) {
      setMsg('read-only session — the viewer role cannot submit')
      return
    }
    setBusy(true)
    setMsg('submitting…')
    const mentioned = /@(\/[^\s]*)/.exec(body)?.[1]
    try {
      await p.api.call('submit-comment', {
        body,
        page,
        kind: kind(),
        selection: {
          mode: 'page',
          framework: globalFramework(),
          cssPath: mentioned ?? p.route,
          textPreview: page,
        },
        skills: [],
      })
      stashDraft(page, { body: '', skills: [] })
      showToast(kind() === 'comment' ? 'comment queued — the agent will pick it up' : 'idea saved', 'ok')
      p.onSubmitted()
    } catch (err) {
      setMsg(`failed: ${String(err)}`)
      setBusy(false)
    }
  }

  return (
    <div
      class="fixed bottom-20 left-14 z-[2147483001] flex w-[min(430px,calc(100vw-80px))] flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-3 text-ink shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
      role="dialog"
      aria-label="Comment on this page"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !mention()) {
          e.stopPropagation()
          p.onClose()
        }
      }}
    >
      <div class={row}>
        <span class="text-[12px] font-semibold text-ink">Comment</span>
        <span class={`${chip} cursor-default max-w-44 truncate font-mono`} title={p.route}>
          {p.route}
        </span>
        <button
          class={`${btn} ml-auto`}
          aria-pressed={p.pinsOn}
          title="Show or hide annotation pins"
          onClick={p.onPins}
        >
          <PinsIcon />
        </button>
        <a class={`${btn} no-underline`} href={p.hub} target="_blank" rel="noreferrer" title="Open the comments panel">
          <PanelIcon />
        </a>
        <button class={btn} onClick={p.onClose} aria-label="Close the comment box">
          ✕
        </button>
      </div>

      <Show when={p.viewer}>
        <span class={`${hint} rounded-lg border border-solid border-warn/40 bg-warn/10 px-2 py-1 text-warn-ink`}>
          read-only session — comments can be read but not written
        </span>
      </Show>

      <textarea
        ref={ta}
        class={`${field} min-h-20 resize-y`}
        placeholder="What should change? Type @ to point at a route, ⌘/Ctrl+Enter to send"
        value={text()}
        disabled={p.viewer}
        onInput={(e) => {
          setText(e.currentTarget.value)
          stashDraft(page, { body: e.currentTarget.value, skills: [] })
          syncMention()
        }}
        onClick={syncMention}
        onKeyUp={(e) => {
          if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) syncMention()
        }}
        onKeyDown={onKey}
      />

      <Show when={mention() && mentionList().length > 0}>
        <div class="flex max-h-36 flex-col overflow-auto rounded-lg border border-solid border-line bg-surface p-1" role="listbox" aria-label="Route suggestions">
          <For each={mentionList()}>
            {(r, i) => (
              <button
                class={`flex cursor-pointer items-center gap-2 rounded-md border border-solid border-transparent px-2 py-1 text-left text-[11px] ${
                  i() === cursor() ? 'border-line-strong bg-control text-ink' : 'text-ink-muted hover:bg-control'
                }`}
                role="option"
                aria-selected={i() === cursor()}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertRoute(r.path)
                }}
              >
                <span class="font-mono">{r.path}</span>
                <Show when={r.kind}>
                  <span class={`${hint} ml-auto uppercase`}>{r.kind}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class={row}>
        <span class={hint}>suggestions</span>
        <For each={[p.route, ...suggestions().map((r) => r.path)].slice(0, 3)}>
          {(path) => (
            <button
              class={chip}
              onClick={() => {
                const pos = ta.selectionStart ?? ta.value.length
                const before = ta.value.slice(0, pos)
                ta.value = `${before}${before && !/\s$/.test(before) ? ' ' : ''}@${path} ${ta.value.slice(pos)}`
                setText(ta.value)
                ta.focus()
                stashDraft(page, { body: ta.value, skills: [] })
              }}
              title={`Mention ${path}`}
            >
              @{path}
            </button>
          )}
        </For>
      </div>

      <div class={row}>
        <For each={QUICK_STARTS}>
          {(s) => (
            <button class={chip} onClick={() => append(s)} title="Add this prompt">
              {s.replace(/:\s*$/, '')}
            </button>
          )}
        </For>
      </div>

      <div class={row}>
        <button class={`${chip} ${kind() === 'comment' ? chipOn : ''}`} onClick={() => setKind('comment')}>
          comment
        </button>
        <button class={`${chip} ${kind() === 'idea' ? chipOn : ''}`} onClick={() => setKind('idea')}>
          idea
        </button>
        <span class={`${hint} mr-auto truncate`} role="status">
          {msg()}
        </span>
        <button class={btnPrimary} disabled={busy() || p.viewer} onClick={() => void submit()}>
          {busy() ? 'sending…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
