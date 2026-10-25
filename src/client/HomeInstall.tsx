import { For, Show, createMemo, createSignal } from 'solid-js'
import { btn, codeBlock, hint, row, sectionLabel, tab, tabBar, tabOn } from '../ui/bits'
import { copyText, showToast } from '../ui/toast'
import { hubBase, panelUrl } from './panel-catalog'

type TabId = 'terminal' | 'vite' | 'mcp' | 'links'

const TABS: { id: TabId; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'vite', label: 'Vite config' },
  { id: 'mcp', label: 'MCP client' },
  { id: 'links', label: 'Panel URLs' },
]

export interface HomeInstallProps {
  /** Endpoint the hub advertises; falls back to the conventional local path. */
  endpoint?: string
}

function mcpConfig(endpoint: string): string {
  return JSON.stringify({ mcpServers: { 'wrikka-devtools': { type: 'http', url: endpoint } } }, null, 2)
}

export default function HomeInstall(p: HomeInstallProps) {
  const [tab, setTab] = createSignal<TabId>('terminal')
  const endpoint = () => p.endpoint ?? 'http://localhost:5173/__devtools/__mcp'

  const code = createMemo(() => {
    if (tab() === 'terminal')
      return [
        '# 1 · add the plugin',
        'bun add -D wrikka-vite-devtools',
        '',
        '# 2 · start your app — the hub mounts itself',
        'bun run dev',
        '',
        '# 3 · open the dock rail',
        'http://localhost:5173/__devtools/',
      ].join('\n')
    if (tab() === 'vite')
      return [
        "import { defineConfig } from 'vite'",
        "import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'",
        '',
        'export default defineConfig({',
        '  plugins: [',
        '    useWrikkaViteDevtools({',
        "      plugins: 'all',",
        "      dock: { mode: 'edge', position: 'left' },",
        '    }),',
        '  ],',
        '})',
      ].join('\n')
    return mcpConfig(endpoint())
  })

  async function copy(text: string, label: string): Promise<void> {
    const ok = await copyText(text)
    showToast(ok ? `${label} copied` : `could not copy ${label.toLowerCase()}`, ok ? 'ok' : 'bad')
  }

  const links = createMemo(() => [
    { label: 'Home', path: panelUrl('home') },
    { label: 'Comments', path: panelUrl('') },
    { label: 'MCP endpoint', path: endpoint() },
    { label: 'Hub index', path: `${hubBase()}__index.json` },
  ])

  return (
    <div class="flex flex-col gap-2 rounded-xl border border-solid border-line bg-surface-raised p-3">
      <div class={row}>
        <span class={sectionLabel}>install &amp; configure</span>
        <span class={`${hint} ml-auto`}>one plugin line, then every panel is live</span>
      </div>

      <div class={`${tabBar} w-fit`} role="tablist" aria-label="Install targets">
        <For each={TABS}>
          {(t) => (
            <button
              class={`${tab} ${tab() === t.id ? tabOn : ''}`}
              role="tab"
              aria-selected={tab() === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          )}
        </For>
      </div>

      <Show
        when={tab() !== 'links'}
        fallback={
          <div class="flex flex-col gap-1">
            <For each={links()}>
              {(l) => (
                <div class="flex items-center gap-2 rounded-lg border border-solid border-line bg-surface-sunken px-2.5 py-1.5">
                  <span class="w-24 shrink-0 text-[11px] font-semibold text-ink">{l.label}</span>
                  <code class="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-muted">{l.path}</code>
                  <button class={`${btn} shrink-0`} onClick={() => void copy(l.path, l.label)}>
                    copy
                  </button>
                </div>
              )}
            </For>
          </div>
        }
      >
        <div class="relative">
          <pre class={codeBlock}>{code()}</pre>
          <button class={`${btn} absolute top-2 right-2`} onClick={() => void copy(code(), TABS.find((t) => t.id === tab())!.label)}>
            copy
          </button>
        </div>
        <Show when={tab() === 'terminal'}>
          <span class={hint}>Use the package manager the project already uses — npm, pnpm and yarn take the same plugin.</span>
        </Show>
        <Show when={tab() === 'mcp'}>
          <span class={hint}>
            Paste into Claude Desktop, Cursor or any HTTP MCP client. The endpoint authenticates with the dev server origin,
            so it only answers loopback clients.
          </span>
        </Show>
      </Show>
    </div>
  )
}
