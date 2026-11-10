import { For, Show } from 'solid-js'
import type { PanelApi } from '../ui/api'
import { btn, btnPrimary, chip, field, hint, panelCard, row, sectionLabel, tonePill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'
import { copyText, showToast } from '../ui/toast'
import { fmtMs } from './format'
import { propsOf, type CallResult, type McpTool } from './mcp-utils'

export interface McpCallCardProps {
  api: PanelApi
  tool: McpTool
  args: string
  onArgs(text: string): void
  result?: CallResult
  calling: boolean
  canCall: boolean
  onCall(): void
}

/** The selected tool's call console: schema chips, JSON args, result and retry-to-agent. */
export default function McpCallCard(p: McpCallCardProps) {
  const schemaProps = () => propsOf(p.tool)

  async function copyResult(text: string): Promise<void> {
    const ok = await copyText(text)
    showToast(ok ? 'result copied' : 'clipboard blocked — select and copy manually', ok ? 'ok' : 'warn')
  }

  return (
    <div class={panelCard}>
      <div class={row}>
        <span class="font-mono text-[13px] font-semibold text-ink">{p.tool.name}</span>
        <span class={`${chip} cursor-default`}>tools/call</span>
        <button
          class={`${btnPrimary} ml-auto`}
          disabled={p.calling || !p.canCall}
          title={p.canCall ? undefined : 'read-only session'}
          onClick={() => p.onCall()}
        >
          {p.calling ? 'calling…' : 'Call tool'}
        </button>
      </div>

      <Show when={schemaProps().length > 0} fallback={<span class={hint}>this tool takes no arguments</span>}>
        <div class={row}>
          <For each={schemaProps()}>{(entry) => {
            const [key, prop] = entry
            const required = p.tool.inputSchema?.required?.includes(key)
            return (
              <span class={`${chip} cursor-default font-mono`} title={prop.description ?? key}>
                {key}{prop.type ? `: ${prop.type}` : ''}{required ? ' *' : ''}
              </span>
            )
          }}</For>
        </div>
      </Show>

      <label class="flex flex-col gap-1">
        <span class={sectionLabel}>arguments (JSON)</span>
        <textarea
          class={`${field} min-h-28 font-mono`}
          spellcheck={false}
          value={p.args}
          onInput={(e) => p.onArgs(e.currentTarget.value)}
        />
      </label>

      <Show when={p.result}>
        {(r) => (
          <div class="flex flex-col gap-1.5">
            <div class={row}>
              <span class={tonePill(r().ok && !r().isError ? 'ok' : 'bad')}>
                {r().ok ? (r().isError ? 'tool error' : 'ok') : 'failed'}
              </span>
              <span class={hint}>{fmtMs(r().durationMs)}</span>
              <button class={`${btn} ml-auto`} onClick={() => void copyResult(r().error ?? r().result)}>
                Copy result
              </button>
            </div>
            <pre class="m-0 max-h-72 overflow-auto rounded-lg border border-solid border-line bg-surface-sunken p-2 font-mono text-[11px] leading-relaxed text-ink-muted">{r().error ?? r().result ?? '(empty result)'}</pre>
            <Show when={!r().ok || r().isError}>
              <SendToAgent
                api={p.api}
                page={`mcp:${p.tool.name}`}
                selection={{ mode: 'page', cssPath: `mcp:${p.tool.name}` }}
                placeholder={`e.g. fix ${p.tool.name} returning an error`}
              />
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
