import 'virtual:uno.css'
import { connectDevframe } from 'devframe/client'
import { mountComments } from './comments-panel'
import type { ClientApi } from './dom'

const metaOut = document.querySelector<HTMLPreElement>('#meta-out')!
const runnerInfo = document.querySelector<HTMLElement>('#runner-info')!
const commentsSection = document.querySelector<HTMLElement>('#comments')!
const section = document.querySelector<HTMLElement>('#scan')!
const form = document.querySelector<HTMLFormElement>('#scan-form')!
const input = document.querySelector<HTMLInputElement>('#scan-path')!

function render(target: HTMLElement, data: unknown) {
  target.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
}

const demo = (await connectDevframe()).scope('devfra-plugins')
const rpc = demo.rpc as unknown as {
  call(id: string, args?: unknown): Promise<any>
  streaming: { subscribe<T>(channel: string, id: string): AsyncIterable<T> }
}
const api: ClientApi = {
  call: (id, args) => rpc.call(id, args),
  subscribe: (channel, id) => rpc.streaming.subscribe<string>(channel, id),
}

try {
  render(metaOut, await api.call('get-meta'))
} catch (err) {
  render(metaOut, `meta unavailable: ${String(err)}`)
}

try {
  const info = await api.call('runner-info')
  runnerInfo.textContent = `driver: ${info.driver ?? 'none'} — installed: ${info.available.join(', ') || 'none'}`
} catch (err) {
  runnerInfo.textContent = `runner unavailable: ${String(err)}`
}

mountComments(commentsSection, api)

async function runScan(path: string) {
  const note = document.createElement('p')
  note.className = 'text-xs text-neutral-500'
  const list = document.createElement('ul')
  list.className = 'list-disc pl-5 text-sm'
  section.replaceChildren(form, note, list)
  try {
    const result = await api.call('scan-dir', { path, limit: 30 })
    note.textContent = `${result.dir} — ${result.entries.length} entries${result.truncated ? ' (truncated)' : ''}`
    for (const entry of result.entries) {
      const li = document.createElement('li')
      li.textContent = `${entry.kind === 'dir' ? '[d]' : '[f]'} ${entry.name}${entry.size != null ? ` (${entry.size} B)` : ''}`
      list.append(li)
    }
  } catch (err) {
    note.textContent = `scan unavailable (static build has no live backend): ${String(err)}`
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  runScan(input.value || '.')
})

runScan('.')
